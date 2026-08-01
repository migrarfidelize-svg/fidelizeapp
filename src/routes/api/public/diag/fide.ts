import { createFileRoute } from "@tanstack/react-router";

/**
 * Diagnóstico da Fidê (sem expor segredos).
 * GET /api/public/diag/fide
 * Mostra qual variável de ambiente foi encontrada e o que o Google respondeu.
 */
export const Route = createFileRoute("/api/public/diag/fide")({
  server: {
    handlers: {
      GET: async () => {
        const found =
          (process.env.GEMINI_API_KEY && "GEMINI_API_KEY") ||
          (process.env.GOOGLE_API_KEY && "GOOGLE_API_KEY") ||
          (process.env.GOOGLE_GENERATIVE_AI_API_KEY && "GOOGLE_GENERATIVE_AI_API_KEY") ||
          null;
        const geminiKey =
          process.env.GEMINI_API_KEY ||
          process.env.GOOGLE_API_KEY ||
          process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        const hasLovable = Boolean(process.env.LOVABLE_API_KEY);
        const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

        let google: { status: number | null; ok: boolean; message?: string } = {
          status: null,
          ok: false,
        };

        if (geminiKey) {
          try {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ role: "user", parts: [{ text: "ping" }] }],
                  generationConfig: { maxOutputTokens: 8 },
                }),
              },
            );
            google = {
              status: res.status,
              ok: res.ok,
              message: res.ok ? undefined : (await res.text()).slice(0, 300),
            };
          } catch (e: any) {
            google = { status: null, ok: false, message: `network: ${e?.message ?? "erro"}` };
          }
        }

        return new Response(
          JSON.stringify(
            {
              envVarEncontrada: found,
              chaveGeminiPresente: Boolean(geminiKey),
              tamanhoChave: geminiKey ? geminiKey.length : 0,
              lovableApiKeyPresente: hasLovable,
              modelo: model,
              google,
              online: google.ok || (!geminiKey && hasLovable),
            },
            null,
            2,
          ),
          { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
