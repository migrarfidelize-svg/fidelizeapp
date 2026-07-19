// scripts/export-auth.ts
// Exporta usuários da ORIGEM via Admin API para dumps/auth-users.json.
// Uso: bun run scripts/export-auth.ts
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";

const URL = process.env.SOURCE_SUPABASE_URL;
const KEY = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("SOURCE_SUPABASE_URL e SOURCE_SUPABASE_SERVICE_ROLE_KEY são obrigatórios");

const supa = createClient(URL, KEY, { auth: { persistSession: false } });

async function main() {
  const users: unknown[] = [];
  const perPage = 200;
  for (let page = 1; page < 500; page++) {
    const { data, error } = await supa.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    users.push(...data.users);
    console.log(`[page ${page}] +${data.users.length} (total ${users.length})`);
    if (data.users.length < perPage) break;
  }
  mkdirSync("dumps", { recursive: true });
  writeFileSync("dumps/auth-users.json", JSON.stringify(users, null, 2));
  console.log(`OK — ${users.length} usuários em dumps/auth-users.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
