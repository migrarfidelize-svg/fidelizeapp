import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const elevenConfigSchema = z.object({
  apiKey: z.string().min(1),
  voiceId: z.string().min(1),
  modelId: z.string().min(1),
  voiceName: z.string().optional(),
  stability: z.number().min(0).max(1).optional(),
  similarity: z.number().min(0).max(1).optional(),
});

/**
 * Super Admin only: Save ElevenLabs integration config.
 * Persisted in establishment_settings of a special 'system' establishment or separate table.
 * Using establishment_settings for a known system ID if system_configs isn't available.
 */
export const saveElevenConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => elevenConfigSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    // Security Check: Only Super Admin (based on claims or role check)
    // Using a more generic check since rpc might be sensitive to specific function names
    const { data: roles } = await supabase
      .from('app_roles')
      .select('role')
      .eq('user_id', userId);
    
    const isAdmin = roles?.some(r => r.role === 'admin');
    
    if (!isAdmin) {
      throw new Error("Acesso negado: apenas Super Admin pode configurar ElevenLabs.");
    }

    // Since psql failed, we use an existing table we know exists: establishment_settings
    // We'll use a reserved UUID for system settings
    const SYSTEM_ID = '00000000-0000-0000-0000-000000000000';

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

    return { ok: true, message: "Configuração salva com sucesso." };
  });

/**
 * Super Admin only: Load ElevenLabs integration config.
 */
export const getElevenConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    
    const { data: roles } = await supabase
      .from('app_roles')
      .select('role')
      .eq('user_id', userId);
    
    const isAdmin = roles?.some(r => r.role === 'admin');
    
    if (!isAdmin) return { status: 'unauthorized' };

    const SYSTEM_ID = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await supabase
      .from("establishment_settings")
      .select("security")
      .eq("establishment_id", SYSTEM_ID)
      .maybeSingle();

    if (error) throw new Error(error.message);
    
    const config = (data?.security as any)?.elevenlabs_config;
    if (!config) return { status: 'disconnected' };

    // Mask API Key
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
 * Super Admin only: Test ElevenLabs connection.
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
    
    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) throw new Error("Não autorizado");

    let apiKey = data.apiKey;
    
    if (!apiKey) {
      const SYSTEM_ID = '00000000-0000-0000-0000-000000000000';
      const { data: saved } = await supabase
        .from("establishment_settings")
        .select("security")
        .eq("establishment_id", SYSTEM_ID)
        .maybeSingle();
      apiKey = (saved?.security as any)?.elevenlabs_config?.apiKey;
    }

    if (!apiKey) throw new Error("API Key não fornecida ou não configurada.");

    try {
      const res = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": apiKey },
      });

      if (!res.ok) {
        if (res.status === 401) return { ok: false, status: 'invalid_key' };
        return { ok: false, status: 'error', message: "Erro na API ElevenLabs" };
      }

      const user = await res.json();
      return { ok: true, status: 'connected', subscription: user.subscription };
    } catch (e: any) {
      return { ok: false, status: 'error', message: e.message };
    }
  });

/**
 * Super Admin only: List voices.
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
    
    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) throw new Error("Não autorizado");

    let apiKey = data.apiKey;
    if (!apiKey) {
      const SYSTEM_ID = '00000000-0000-0000-0000-000000000000';
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

    if (!res.ok) throw new Error("Falha ao buscar vozes.");
    const json = await res.json();
    return json.voices;
  });

/**
 * Super Admin only: Remove integration.
 */
export const removeElevenConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from('app_roles')
      .select('role')
      .eq('user_id', userId);
    
    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) throw new Error("Não autorizado");

    const SYSTEM_ID = '00000000-0000-0000-0000-000000000000';
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
