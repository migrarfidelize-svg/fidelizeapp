import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SYSTEM_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Public/Merchant access: Obtém a configuração global da ElevenLabs se estiver ativa.
 * A API Key é mantida no servidor; esta função retorna apenas se está configurada.
 */
export const getGlobalVoiceConfig = createServerFn({ method: "GET" })
  .handler(async ({ context }) => {
    const { supabase } = context;
    
    const { data, error } = await supabase
      .from("establishment_settings")
      .select("security")
      .eq("establishment_id", SYSTEM_ID)
      .maybeSingle();

    if (error || !data) return { isConfigured: false };
    
    const config = (data?.security as any)?.elevenlabs_config;
    if (!config || !config.apiKey) return { isConfigured: false };

    return {
      isConfigured: true,
      voiceId: config.voiceId,
      modelId: config.modelId,
      stability: config.stability,
      similarity: config.similarity
    };
  });

/**
 * Server-only synthesis using global system credentials.
 */
export const synthesizeGlobalEleven = createServerFn({ method: "POST" })
  .validator(z.object({
    text: z.string()
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    
    // 1. Get Global Config
    const { data: settings } = await supabase
      .from("establishment_settings")
      .select("security")
      .eq("establishment_id", SYSTEM_ID)
      .maybeSingle();
    
    const config = (settings?.security as any)?.elevenlabs_config;
    if (!config || !config.apiKey) {
      throw new Error("ElevenLabs global não configurada.");
    }

    // 2. Call ElevenLabs API
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: data.text,
        model_id: config.modelId || "eleven_multilingual_v2",
        voice_settings: {
          stability: config.stability ?? 0.5,
          similarity_boost: config.similarity ?? 0.75,
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
