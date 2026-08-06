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
 * Persisted in public.system_configs table (vault-like storage).
 */
export const saveElevenConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => elevenConfigSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, claims } = context;
    
    // Security Check: Only Super Admin (based on claims or role check)
    // Assuming has_role check is needed
    const { data: isAdmin } = await supabase.rpc('has_role', { 
      _user_id: claims.sub, 
      _role: 'admin' 
    });
    
    if (!isAdmin) {
      throw new Error("Acesso negado: apenas Super Admin pode configurar ElevenLabs.");
    }

    // Save to system_configs
    const { error } = await supabase
      .from("system_configs")
      .upsert({ 
        key: "elevenlabs_config", 
        value: {
          ...data,
          updated_at: new Date().toISOString(),
          updated_by: claims.sub
        }
      }, { onConflict: 'key' });

    if (error) {
      // If table doesn't exist, we might need a migration, but usually it exists in this stack
      throw new Error(`Erro ao salvar configuração: ${error.message}`);
    }

    return { ok: true, message: "Configuração salva com sucesso." };
  });

/**
 * Super Admin only: Load ElevenLabs integration config.
 * Masking API key for frontend safety.
 */
export const getElevenConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, claims } = context;
    
    const { data: isAdmin } = await supabase.rpc('has_role', { 
      _user_id: claims.sub, 
      _role: 'admin' 
    });
    
    if (!isAdmin) return { status: 'unauthorized' };

    const { data, error } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", "elevenlabs_config")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return { status: 'disconnected' };

    const val = data.value as any;
    // Mask API Key
    const maskedKey = val.apiKey ? `${val.apiKey.slice(0, 4)}...${val.apiKey.slice(-4)}` : "";

    return {
      status: 'connected',
      config: {
        ...val,
        apiKey: maskedKey,
        isConfigured: true
      }
    };
  });

/**
 * Super Admin only: Test ElevenLabs connection using a provided or saved key.
 */
export const testElevenConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ apiKey: z.string().optional() }))
  .handler(async ({ data, context }) => {
    const { supabase, claims } = context;
    
    const { data: isAdmin } = await supabase.rpc('has_role', { 
      _user_id: claims.sub, 
      _role: 'admin' 
    });
    
    if (!isAdmin) throw new Error("Não autorizado");

    let apiKey = data.apiKey;
    
    if (!apiKey) {
      const { data: saved } = await supabase
        .from("system_configs")
        .select("value")
        .eq("key", "elevenlabs_config")
        .maybeSingle();
      apiKey = (saved?.value as any)?.apiKey;
    }

    if (!apiKey) throw new Error("API Key não fornecida ou não configurada.");

    try {
      const res = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": apiKey },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) return { ok: false, status: 'invalid_key' };
        return { ok: false, status: 'error', message: err?.detail?.message || "Erro na API" };
      }

      const user = await res.json();
      const usage = user.subscription?.character_count || 0;
      const limit = user.subscription?.character_limit || 0;
      
      if (usage >= limit && limit > 0) return { ok: false, status: 'no_credits' };

      return { ok: true, status: 'connected', subscription: user.subscription };
    } catch (e: any) {
      return { ok: false, status: 'error', message: e.message };
    }
  });

/**
 * Super Admin only: List voices from ElevenLabs.
 */
export const listElevenVoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ apiKey: z.string().optional() }))
  .handler(async ({ data, context }) => {
    const { supabase, claims } = context;
    
    const { data: isAdmin } = await supabase.rpc('has_role', { 
      _user_id: claims.sub, 
      _role: 'admin' 
    });
    if (!isAdmin) throw new Error("Não autorizado");

    let apiKey = data.apiKey;
    if (!apiKey) {
      const { data: saved } = await supabase
        .from("system_configs")
        .select("value")
        .eq("key", "elevenlabs_config")
        .maybeSingle();
      apiKey = (saved?.value as any)?.apiKey;
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
    const { supabase, claims } = context;
    const { data: isAdmin } = await supabase.rpc('has_role', { 
      _user_id: claims.sub, 
      _role: 'admin' 
    });
    if (!isAdmin) throw new Error("Não autorizado");

    await supabase
      .from("system_configs")
      .delete()
      .eq("key", "elevenlabs_config");

    return { ok: true };
  });
