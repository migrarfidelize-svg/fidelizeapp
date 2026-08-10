import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const elevenConfigSchema = z.object({
  apiKey: z.string().trim().min(1).optional(),
  voiceId: z.string().min(1),
  modelId: z.string().min(1),
  enabled: z.boolean().default(true),
  voiceName: z.string().optional(),
  stability: z.number().min(0).max(1).optional(),
  similarity: z.number().min(0).max(1).optional(),
  texts: z.record(z.string()).optional(),
});

/**
 * Super Admin only: Salvar configuração de integração ElevenLabs.
 * Persistido na tabela system_settings (global).
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptSecret } = await import("./integrations/crypt.server");
    
    const { data: existingRow, error: existingError } =
      await (supabaseAdmin as any)
        .from("system_settings")
        .select("value")
        .eq("namespace", "voice")
        .eq("key", "elevenlabs")
        .maybeSingle();

    if (existingError) {
      throw new Error(
        `Erro ao carregar configuração atual: ${existingError.message}`
      );
    }

    const existingConfig =
      (existingRow?.value || {}) as Record<string, any>;

    let encryptedKey = existingConfig.apiKey;

    if (data.apiKey?.trim()) {
      encryptedKey = await encryptSecret(data.apiKey.trim());
    }

    if (!encryptedKey) {
      throw new Error(
        "API Key ElevenLabs não configurada."
      );
    }
    
    const { error } = await (supabaseAdmin as any)
      .from("system_settings")
      .upsert({ 
        namespace: 'voice',
        key: 'elevenlabs',
        value: {
          ...existingConfig,
          ...data,
          apiKey: encryptedKey,
          updated_at: new Date().toISOString(),
          updated_by: userId
        },
        enabled: data.enabled
      }, { onConflict: 'namespace,key' });

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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("system_settings")
      .select("value, enabled")
      .eq("namespace", "voice")
      .eq("key", "elevenlabs")
      .maybeSingle();

    if (error) throw new Error(error.message);
    
    const config = data?.value as any;
    if (!config) return { status: 'disconnected' };

    const isConfigured = !!config.apiKey;

    return {
      status: 'connected',
      config: {
        ...config,
        apiKey: isConfigured ? "••••••••" : "",
        hasApiKey: isConfigured,
        enabled: data.enabled,
        isConfigured: isConfigured
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

    let apiKey = data.apiKey?.trim();
    
    // Se não enviou apiKey no teste, tenta carregar a salva usando supabaseAdmin
    if (!apiKey) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: saved } = await (supabaseAdmin as any)
        .from("system_settings")
        .select("value")
        .eq("namespace", "voice")
        .eq("key", "elevenlabs")
        .maybeSingle();
      
      const encryptedKey = (saved?.value as any)?.apiKey;
      if (encryptedKey) {
        const { decryptSecret } = await import("./integrations/crypt.server");
        apiKey = await decryptSecret(encryptedKey);
      }
    }

    if (!apiKey) throw new Error("API Key não encontrada.");

    try {
      const res = await fetch("https://api.elevenlabs.io/v1/models", {
        headers: { "xi-api-key": apiKey },
      });

      if (!res.ok) {
        if (res.status === 401) return { ok: false, status: 'invalid_key', message: "API Key inválida (401)." };
        if (res.status === 402) return { ok: false, status: 'no_credits', message: "Créditos insuficientes (402)." };
        if (res.status === 403) return { ok: false, status: 'forbidden', message: "Acesso proibido (403)." };
        if (res.status === 429) return { ok: false, status: 'rate_limit', message: "Limite atingido (429)." };
        
        const errData = await res.json().catch(() => ({}));
        return { 
          ok: false, 
          status: 'error', 
          message: errData?.detail?.message || `Erro API (${res.status})` 
        };
      }

      const models = await res.json();
      return { ok: true, status: 'connected', modelsCount: models.length };
    } catch (e: any) {
      return { ok: false, status: 'error', message: `Falha de rede: ${e.message}` };
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

    let apiKey = data.apiKey?.trim();
    if (!apiKey) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: saved } = await (supabaseAdmin as any)
        .from("system_settings")
        .select("value")
        .eq("namespace", "voice")
        .eq("key", "elevenlabs")
        .maybeSingle();
      
      const encryptedKey = (saved?.value as any)?.apiKey;
      if (encryptedKey) {
        const { decryptSecret } = await import("./integrations/crypt.server");
        apiKey = await decryptSecret(encryptedKey);
      }
    }

    if (!apiKey) throw new Error("API Key não configurada.");

    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });

    if (!res.ok) throw new Error("Falha ao carregar vozes.");
    const json = await res.json();
    return json.voices;
  });

/**
 * Super Admin only: Remover configuração global da ElevenLabs.
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("system_settings")
      .delete()
      .eq("namespace", "voice")
      .eq("key", "elevenlabs");

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Gera um áudio de teste usando as configurações globais.
 */
export const generateElevenTestAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ text: z.string() }))
  .handler(async ({ data, context }) => {
    const { synthesizeGlobalEleven } = await import("./voice-system.functions");
    return synthesizeGlobalEleven({ data: { text: data.text } });
  });
