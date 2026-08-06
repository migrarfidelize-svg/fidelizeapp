import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  text: z.string().min(1).max(2000),
  provider: z.enum(["native", "elevenlabs", "auto"]).default("auto"),
  voice_id: z.string().optional(),
  model_id: z.string().optional(),
  params: z.object({
    rate: z.number().optional(),
    pitch: z.number().optional(),
    volume: z.number().optional(),
    stability: z.number().optional(),
    similarity: z.number().optional(),
  }).optional(),
  fallback_enabled: z.boolean().default(true),
});

export const speakGlobal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(data => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    let useEleven = data.provider === "elevenlabs" || (data.provider === "auto" && !!elevenKey);
    
    if (useEleven && elevenKey) {
      try {
        const { synthesizeElevenLabs } = await import("./elevenlabs.functions");
        const res = await synthesizeElevenLabs({
          data: {
            text: data.text,
            voice_id: data.voice_id,
            model_id: data.model_id,
            stability: data.params?.stability,
            similarity_boost: data.params?.similarity,
          }
        });
        if (res.audio) return { ...res, provider: "elevenlabs" };
      } catch (e) {
        if (!data.fallback_enabled) throw e;
      }
    }

    // Fallback to OpenAI if configured
    if (openaiKey && data.fallback_enabled) {
      try {
        const res = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "tts-1",
            input: data.text,
            voice: "alloy",
          }),
        });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          return { audio: Buffer.from(buf).toString("base64"), mime: "audio/mpeg", provider: "openai" };
        }
      } catch {}
    }

    return { audio: null, mime: null, fallback: "native", provider: "none", text: data.text };
  });
