import { createFileRoute } from "@tanstack/react-router";
import { testTurnstileKeys } from "@/lib/captcha.functions";

export const Route = createFileRoute("/api/test-turnstile")({
  server: {
    handlers: {
      GET: async () => {
        const result = await testTurnstileKeys({});
        return Response.json(result);
      },
    },
  },
});
