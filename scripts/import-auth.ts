// scripts/import-auth.ts
// Importa usuários no DESTINO via Admin API preservando id, email, metadados.
// Senhas NÃO são migráveis — usuários farão reset pós-corte.
// Uso: bun run scripts/import-auth.ts   (ou DRY_RUN=1 para simular)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios");
if (URL.includes("lovable")) throw new Error("SUPABASE_URL parece ORIGEM — aborte.");

const dry = process.env.DRY_RUN === "1";
const supa = createClient(URL, KEY, { auth: { persistSession: false } });

type SrcUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  email_confirmed_at?: string | null;
  phone_confirmed_at?: string | null;
  banned_until?: string | null;
  raw_user_meta_data?: Record<string, unknown> | null;
  raw_app_meta_data?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
  created_at?: string;
};

async function main() {
  const users = JSON.parse(readFileSync("dumps/auth-users.json", "utf-8")) as SrcUser[];
  console.log(`[import-auth] ${users.length} usuários. dry=${dry}`);
  let ok = 0, skip = 0, err = 0;
  for (const u of users) {
    if (!u.email && !u.phone) { skip++; continue; }
    if (dry) { ok++; continue; }
    const { error } = await supa.auth.admin.createUser({
      id: u.id,
      email: u.email ?? undefined,
      phone: u.phone ?? undefined,
      email_confirm: Boolean(u.email_confirmed_at),
      phone_confirm: Boolean(u.phone_confirmed_at),
      user_metadata: (u.raw_user_meta_data ?? u.user_metadata ?? {}) as Record<string, unknown>,
      app_metadata: (u.raw_app_meta_data ?? u.app_metadata ?? {}) as Record<string, unknown>,
    });
    if (error) {
      if (String(error.message).toLowerCase().includes("already registered")) { skip++; continue; }
      console.error(`[erro] ${u.email ?? u.phone}: ${error.message}`);
      err++;
    } else ok++;
  }
  console.log(`OK=${ok} SKIP=${skip} ERR=${err}`);
  console.log("Reative os usuários com email de recovery em massa após o corte.");
}

main().catch((e) => { console.error(e); process.exit(1); });
