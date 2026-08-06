import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/test-env")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({
          VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          NODE_ENV: process.env.NODE_ENV,
        }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  }
});
