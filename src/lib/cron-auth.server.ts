/**
 * Autenticação das rotinas automáticas públicas (/api/public/cron/* e hooks).
 *
 * O chamador (pg_cron / monitor externo) precisa enviar a chave publicável do
 * backend no cabeçalho `apikey` (ou `Authorization: Bearer <chave>`).
 * Sem isso, o endpoint responde 401 e nada é executado.
 */
export function authorizeCronRequest(request: Request): Response | null {
  const provided =
    request.headers.get("apikey") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  const expected =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

  if (!expected) {
    return new Response(JSON.stringify({ ok: false, error: "not_configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (provided !== expected) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}
