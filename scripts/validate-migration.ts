// scripts/validate-migration.ts
// Compara ORIGEM e DESTINO após import. Falha se qualquer count divergir.
// Uso: bun run scripts/validate-migration.ts
import { Client } from "pg";

const SRC = process.env.SOURCE_DB_URL;
const DST = process.env.SUPABASE_DB_URL;
if (!SRC || !DST) throw new Error("SOURCE_DB_URL e SUPABASE_DB_URL são obrigatórios");

const TABLES = [
  "api_keys","app_roles","audit_logs","campaigns","consents","coupons","customers",
  "data_requests","email_logs","email_queue","email_templates","establishment_goals",
  "establishment_members","establishment_settings","establishments","help_article_views",
  "help_articles","help_categories","help_feedback","helpdesk_members","kb_articles",
  "kb_categories","kb_feedback","loyalty_cards","notification_templates","payment_logs",
  "payment_provider_credentials","payment_settings","payments","plan_features","plans",
  "profiles","push_logs","push_subscriptions","retention_dispatches","retention_events",
  "retention_settings","rewards","stamps","subscription_events","subscriptions",
  "support_messages","support_quick_replies","support_status_history","support_tickets",
  "system_email_settings","team_invites","ticket_messages","ticket_quick_replies",
  "tickets","webhook_deliveries","webhooks",
];

async function counts(url: string) {
  const c = new Client({ connectionString: url });
  await c.connect();
  const out: Record<string, number> = {};
  for (const t of TABLES) {
    const r = await c.query(`SELECT COUNT(*)::int AS n FROM public.${t}`).catch(() => ({ rows: [{ n: -1 }] }));
    out[t] = r.rows[0].n;
  }
  const users = await c.query(`SELECT COUNT(*)::int AS n FROM auth.users`);
  out["__auth_users"] = users.rows[0].n;
  const storage = await c.query(`SELECT bucket_id, COUNT(*)::int AS n FROM storage.objects GROUP BY 1`);
  for (const r of storage.rows) out[`__storage_${r.bucket_id}`] = r.n;
  await c.end();
  return out;
}

const src = await counts(SRC);
const dst = await counts(DST);
let diffs = 0;
for (const k of Object.keys(src)) {
  const a = src[k], b = dst[k] ?? 0;
  const flag = a === b ? "OK  " : "DIFF";
  if (a !== b) diffs++;
  console.log(`${flag}  ${k.padEnd(40)}  src=${a}  dst=${b}`);
}
console.log(diffs === 0 ? "\n✅ SEM DIVERGÊNCIAS" : `\n❌ ${diffs} divergências — investigar antes do cutover.`);
process.exit(diffs === 0 ? 0 : 1);
