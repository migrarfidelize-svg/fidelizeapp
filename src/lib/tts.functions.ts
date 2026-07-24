import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  text: z.string().min(1).max(400),
  voice: z.enum(["nova", "shimmer", "alloy", "onyx", "ash", "sage", "coral", "verse"]).default("nova"),
  instructions: z.string().max(600).optional(),
});

/**
 * TTS adaptativo:
 * 1. OpenAI direto (se OPENAI_API_KEY definido) — independente da Lovable.
 * 2. Lovable Gateway (se LOVABLE_API_KEY definido) — fallback.
 * 3. { fallback: "web-speech" } — cliente usa a Web Speech API nativa do navegador (100% offline/grátis).
 */
export const synthesizeGreeting = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const openaiKey = process.env.OPENAI_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;

    const defaultInstructions =
      data.instructions ??
      "Fale em português brasileiro, tom suave, charmoso, acolhedor, ritmo calmo e íntimo, quase sussurrado, com carisma.";

    // 1) OpenAI direto
    if (openaiKey) {
      try {
        const res = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini-tts",
            input: data.text,
            voice: data.voice,
            response_format: "mp3",
            instructions: defaultInstructions,
          }),
        });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          return { audio: Buffer.from(buf).toString("base64"), mime: "audio/mpeg" };
        }
      } catch {
        // continua para o próximo provedor
      }
    }

    // 2) Lovable Gateway (fallback)
    if (lovableKey) {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: data.text,
            voice: data.voice,
            response_format: "mp3",
            instructions: defaultInstructions,
          }),
        });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          return { audio: Buffer.from(buf).toString("base64"), mime: "audio/mpeg" };
        }
      } catch {
        // cai para Web Speech
      }
    }

    // 3) Web Speech API no cliente (fallback universal, 100% independente)
    return { audio: null, mime: null, fallback: "web-speech" as const, text: data.text };
  });
