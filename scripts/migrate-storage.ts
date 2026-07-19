// scripts/migrate-storage.ts
// Migra buckets `logos` e `ticket-attachments` da ORIGEM para o DESTINO.
// Uso:
//   bun run scripts/migrate-storage.ts --mode=export
//   bun run scripts/migrate-storage.ts --mode=import
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readdirSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const BUCKETS = ["logos", "ticket-attachments"] as const;
const OUT = "dumps/storage";

const mode = process.argv.find((a) => a.startsWith("--mode="))?.split("=")[1];
if (mode !== "export" && mode !== "import") throw new Error("--mode=export|import");

function client(role: "source" | "dest") {
  const url = role === "source" ? process.env.SOURCE_SUPABASE_URL : process.env.SUPABASE_URL;
  const key = role === "source" ? process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(`Faltam envs para ${role}`);
  if (role === "dest" && url.includes("lovable")) throw new Error("DEST parece ORIGEM — aborte.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function listAll(supa: ReturnType<typeof client>, bucket: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  let offset = 0;
  const limit = 1000;
  for (;;) {
    const { data, error } = await supa.storage.from(bucket).list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if ((item as { id?: string }).id) out.push(path);
      else out.push(...(await listAll(supa, bucket, path)));
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return out;
}

async function doExport() {
  const supa = client("source");
  for (const b of BUCKETS) {
    const files = await listAll(supa, b);
    console.log(`[${b}] ${files.length} objetos`);
    for (const path of files) {
      const { data, error } = await supa.storage.from(b).download(path);
      if (error) { console.error(`skip ${b}/${path}: ${error.message}`); continue; }
      const local = join(OUT, b, path);
      mkdirSync(dirname(local), { recursive: true });
      writeFileSync(local, Buffer.from(await data.arrayBuffer()));
    }
  }
  console.log(`OK — dump em ${OUT}/`);
}

async function doImport() {
  const supa = client("dest");
  for (const b of BUCKETS) {
    await supa.storage.createBucket(b, { public: false }).catch(() => {});
    const root = join(OUT, b);
    let count = 0;
    for (const path of walk(root)) {
      const rel = relative(root, path);
      const { error } = await supa.storage.from(b).upload(rel, readFileSync(path), { upsert: true });
      if (error) { console.error(`upload ${b}/${rel}: ${error.message}`); continue; }
      count++;
    }
    console.log(`[${b}] ${count} enviados`);
  }
}

function* walk(dir: string): Generator<string> {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else yield p;
  }
}

(mode === "export" ? doExport() : doImport()).catch((e) => { console.error(e); process.exit(1); });
