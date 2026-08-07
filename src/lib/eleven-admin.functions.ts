import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const elevenConfigSchema = z.object({
  apiKey: z.string().min(1),
  voiceId: z.string().min(1),
  modelId: z.string().min(1),
  enabled: z.boolean().default(true),
  voiceName: z.string().optional(),
  stability: z.number().min(0).max(1).optional(),
  similarity: z.number().min(0).max(1).optional(),
  texts: z.record(z.string()).optional(),
});

// UUID reservado para configurações globais do sistema Fidelize
const SYSTEM_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Super Admin only: Salvar configuração de integração ElevenLabs.
 * Persistido na coluna security da tabela establishment_settings sob um ID de sistema fixo.
 */
export const saveElevenConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => elevenConfigSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    // Verifica se o usuário é super_admin
    const { data: roles } = await supabase
      .from('app_roles')
      .select('role')
      .eq('user_id', userId);
    
    const isSuperAdmin = roles?.some(r => r.role === 'super_admin');
    
    if (!isSuperAdmin) {
      throw new Error("Acesso negado: apenas Super Administradores podem configurar a ElevenLabs.");
    }

    const { error } = await supabase
      .from("establishment_settings")
      .upsert({ 
        establishment_id: SYSTEM_ID,
        security: {
          elevenlabs_config: {
            ...data,
            updated_at: new Date().toISOString(),
            updated_by: userId
          }
        }
      }, { onConflict: 'establishment_id' });

    if (error) {
      throw new Error(`Erro ao salvar configuração: ${error.message}`);
    }

    return { ok: true, message: "Integração ElevenLabs salva com sucesso." };
  });

/**
 * Super Admin only: Carregar configuração de integração ElevenLabs.
 * A API Key é mascarada para segurança no frontend.
 */
export const getElevenConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    
    const { data: roles } = await supabase
      .from('app_roles')
      .select('role')
      .eq('user_id', userId);
    
    const isSuperAdmin = roles?.some(r => r.role === 'super_admin');
    if (!isSuperAdmin) return { status: 'unauthorized' };

    const { data, error } = await supabase
      .from("establishment_settings")
      .select("security")
      .eq("establishment_id", SYSTEM_ID)
      .maybeSingle();

    if (error) throw new Error(error.message);
    
    const config = (data?.security as any)?.elevenlabs_config;
    if (!config) return { status: 'disconnected' };

    // Mascarar a API Key
    const maskedKey = config.apiKey ? `${config.apiKey.slice(0, 4)}...${config.apiKey.slice(-4)}` : "";

    return {
      status: 'connected',
      config: {
        ...config,
        apiKey: maskedKey,
        isConfigured: true
      }
    };
  });

/**
 * Super Admin only: Testar conexão ElevenLabs.
 */
export const testElevenConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ apiKey: z.string().optional() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    const { data: roles } = await supabase
      .from('app_roles')
      .select('role')
      .eq('user_id', userId);
    
    const isSuperAdmin = roles?.some(r => r.role === 'super_admin');
    if (!isSuperAdmin) throw new Error("Não autorizado");

    let apiKey = data.apiKey;
    
    // Se não enviou apiKey no teste, tenta carregar a salva
    if (!apiKey) {
      const { data: saved } = await supabase
        .from("establishment_settings")
        .select("security")
        .eq("establishment_id", SYSTEM_ID)
        .maybeSingle();
      apiKey = (saved?.security as any)?.elevenlabs_config?.apiKey;
    }

    if (!apiKey) throw new Error("API Key não encontrada.");

    try {
      const res = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": apiKey },
      });

      if (!res.ok) {
        if (res.status === 401) return { ok: false, status: 'invalid_key', message: "API Key inválida." };
        return { ok: false, status: 'error', message: "Erro na resposta da API ElevenLabs." };
      }

      const user = await res.json();
      const usage = user.subscription?.character_count || 0;
      const limit = user.subscription?.character_limit || 0;

      if (limit > 0 && usage >= limit) {
        return { ok: false, status: 'no_credits', message: "Créditos esgotados na ElevenLabs." };
      }

      return { ok: true, status: 'connected', subscription: user.subscription };
    } catch (e: any) {
      return { ok: false, status: 'error', message: e.message };
    }
  });

/**
 * Super Admin only: Listar vozes disponíveis na ElevenLabs.
 */
export const listElevenVoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ apiKey: z.string().optional() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from('app_roles')
      .select('role')
      .eq('user_id', userId);
    
    const isSuperAdmin = roles?.some(r => r.role === 'super_admin');
    if (!isSuperAdmin) throw new Error("Não autorizado");

    let apiKey = data.apiKey;
    if (!apiKey) {
      const { data: saved } = await supabase
        .from("establishment_settings")
        .select("security")
        .eq("establishment_id", SYSTEM_ID)
        .maybeSingle();
      apiKey = (saved?.security as any)?.elevenlabs_config?.apiKey;
    }

    if (!apiKey) throw new Error("API Key não configurada.");

    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });

    if (!res.ok) throw new Error("Falha ao carregar vozes da ElevenLabs.");
    const json = await res.json();
    return json.voices;
  });

/**
 * Super Admin only: Remover integração.
 */
export const removeElevenConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from('app_roles')
      .select('role')
      .eq('user_id', userId);
    
    const isSuperAdmin = roles?.some(r => r.role === 'super_admin');
    if (!isSuperAdmin) throw new Error("Não autorizado");

    const { data: saved } = await supabase
      .from("establishment_settings")
      .select("security")
      .eq("establishment_id", SYSTEM_ID)
      .maybeSingle();
    
    const security = (saved?.security as any) || {};
    delete security.elevenlabs_config;

    await supabase
      .from("establishment_settings")
      .update({ security })
      .eq("establishment_id", SYSTEM_ID);

    return { ok: true };
  });

/**
 * Super Admin only: Gerar áudio de teste ElevenLabs.
 * Usado para validar a configuração atual antes de salvar ou aplicar globalmente.
 */
export const generateElevenTestAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    text: z.string(),
    apiKey: z.string().optional(),
    voiceId: z.string(),
    modelId: z.string(),
    stability: z.number().optional(),
    similarity: z.number().optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    const { data: roles } = await supabase
      .from('app_roles')
      .select('role')
      .eq('user_id', userId);
    
    const isSuperAdmin = roles?.some(r => r.role === 'super_admin');
    if (!isSuperAdmin) throw new Error("Não autorizado");

    let apiKey = data.apiKey;
    if (!apiKey) {
      const { data: saved } = await supabase
        .from("establishment_settings")
        .select("security")
        .eq("establishment_id", SYSTEM_ID)
        .maybeSingle();
      apiKey = (saved?.security as any)?.elevenlabs_config?.apiKey;
    }

    if (!apiKey) throw new Error("API Key não configurada.");

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${data.voiceId}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: data.text,
        model_id: data.modelId,
        voice_settings: {
          stability: data.stability ?? 0.5,
          similarity_boost: data.similarity ?? 0.75,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail?.message || `Erro ElevenLabs: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return {
      audio: base64,
      mime: "audio/mpeg",
    };
  });
