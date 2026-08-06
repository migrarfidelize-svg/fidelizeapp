import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ttsSchema = z.object({
  text: z.string().min(1).max(1000),
  voice_id: z.string().optional(),
  model_id: z.string().optional(),
  stability: z.number().min(0).max(1).optional(),
  similarity_boost: z.number().min(0).max(1).optional(),
});

export const synthesizeElevenLabs = createServerFn({ method: "POST" })
  .validator((d: unknown) => ttsSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY não configurada no servidor.");

    const voiceId = data.voice_id || "21m0pOTjCwobq1Wnu3pd";
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: data.text,
        model_id: data.model_id || "eleven_multilingual_v2",
        voice_settings: {
          stability: data.stability ?? 0.5,
          similarity_boost: data.similarity_boost ?? 0.75,
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

export const getElevenLabsVoices = createServerFn({ method: "GET" })
  .handler(async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("API Key não configurada.");

    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });

    if (!res.ok) throw new Error("Falha ao buscar vozes da ElevenLabs.");
    const data = await res.json();
    return data.voices;
  });

export const testElevenLabsConnection = createServerFn({ method: "GET" })
  .handler(async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return { ok: false, message: "API Key não configurada." };

    const res = await fetch("https://api.elevenlabs.io/v1/user", {
      headers: { "xi-api-key": apiKey },
    });

    if (res.ok) {
      const user = await res.json();
      return { ok: true, subscription: user.subscription };
    }

    return { ok: false, message: "Chave inválida ou erro na API." };
  });
