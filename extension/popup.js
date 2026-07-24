/* Fidelize Migrator - popup.js */
const $ = (id) => document.getElementById(id);
const tabs = document.querySelectorAll(".tab");
const sections = document.querySelectorAll("section");

tabs.forEach((t) => t.addEventListener("click", () => {
  tabs.forEach((x) => x.classList.remove("active"));
  sections.forEach((x) => x.classList.remove("active"));
  t.classList.add("active");
  $("tab-" + t.dataset.tab).classList.add("active");
}));

const state = {
  destUrl: "",
  destKey: "",
  destDbPass: "",
  sqlText: null,
  usersJson: null,
  storageFile: null,
};

/* ---------- Storage ---------- */
chrome.storage.local.get(["destUrl", "destKey", "destDbPass"], (v) => {
  state.destUrl = v.destUrl || "";
  state.destKey = v.destKey || "";
  state.destDbPass = v.destDbPass || "";
  $("destUrl").value = state.destUrl;
  $("destKey").value = state.destKey;
  $("destDbPass").value = state.destDbPass;
});

$("saveDest").addEventListener("click", () => {
  state.destUrl = $("destUrl").value.trim().replace(/\/+$/, "");
  state.destKey = $("destKey").value.trim();
  state.destDbPass = $("destDbPass").value;
  chrome.storage.local.set({
    destUrl: state.destUrl, destKey: state.destKey, destDbPass: state.destDbPass,
  }, () => log("Configurações salvas.", "ok"));
});

/* ---------- Log ---------- */
function log(msg, cls = "") {
  const el = $("log");
  const line = document.createElement("div");
  if (cls) line.className = cls;
  const t = new Date().toLocaleTimeString();
  line.textContent = `[${t}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}
$("clearBtn").addEventListener("click", () => { $("log").innerHTML = ""; });

/* ---------- Files ---------- */
$("sqlFile").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  state.sqlText = await f.text();
  $("sqlStatus").className = "badge ok"; $("sqlStatus").textContent = `${(f.size/1024).toFixed(1)} KB`;
  log(`SQL carregado: ${f.name} (${(f.size/1024).toFixed(1)} KB)`, "ok");
});
$("usersFile").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    state.usersJson = JSON.parse(await f.text());
    if (!Array.isArray(state.usersJson)) throw new Error("JSON precisa ser um array");
    $("usersStatus").className = "badge ok"; $("usersStatus").textContent = `${state.usersJson.length} usuários`;
    log(`Usuários carregados: ${state.usersJson.length}`, "ok");
  } catch (err) {
    log("JSON de usuários inválido: " + err.message, "err");
    $("usersStatus").className = "badge err"; $("usersStatus").textContent = "inválido";
  }
});
$("storageZip").addEventListener("change", (e) => {
  const f = e.target.files[0]; if (!f) return;
  state.storageFile = f;
  $("storageStatus").className = "badge ok"; $("storageStatus").textContent = `${(f.size/1024/1024).toFixed(2)} MB`;
  log(`ZIP de Storage carregado: ${f.name}`, "ok");
});

/* ---------- Supabase helpers ---------- */
function headers() {
  return {
    "apikey": state.destKey,
    "Authorization": `Bearer ${state.destKey}`,
    "Content-Type": "application/json",
  };
}
async function api(path, opts = {}) {
  const url = state.destUrl + path;
  const res = await fetch(url, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return body;
}

/* ---------- Test connection ---------- */
$("testDest").addEventListener("click", async () => {
  state.destUrl = $("destUrl").value.trim().replace(/\/+$/, "");
  state.destKey = $("destKey").value.trim();
  if (!state.destUrl || !state.destKey) { setDest(false, "Preencha URL e Service Key"); return; }
  setDest(null, "Testando...");
  try {
    const r = await fetch(state.destUrl + "/auth/v1/admin/users?page=1&per_page=1", { headers: headers() });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    setDest(true, "Conectado com sucesso (Auth Admin OK)");
    log("Conexão OK com destino.", "ok");
  } catch (err) {
    setDest(false, "Falha: " + err.message);
    log("Erro na conexão: " + err.message, "err");
  }
});
function setDest(ok, msg) {
  const dot = $("destDot"), s = $("destStatus");
  dot.className = "dot" + (ok === true ? " ok" : ok === false ? " err" : "");
  s.textContent = msg;
}

/* ---------- Migration steps ---------- */
const BUCKETS = ["logos", "promotions", "ticket-attachments", "poster-print-orders"];

async function stepStatus(id, cls, txt) {
  const el = $(id); el.className = "badge " + cls; el.textContent = txt;
}

async function step1_verify() {
  await stepStatus("s1", "run", "verificando");
  if (!state.destUrl || !state.destKey) throw new Error("Configure destino.");
  const r = await fetch(state.destUrl + "/auth/v1/admin/users?page=1&per_page=1", { headers: headers() });
  if (!r.ok) throw new Error("Auth Admin retornou " + r.status);
  await stepStatus("s1", "ok", "ok");
}

async function step2_buckets(dry) {
  await stepStatus("s2", "run", "criando");
  for (const b of BUCKETS) {
    if (dry) { log(`(dry) criar bucket ${b}`); continue; }
    try {
      await api("/storage/v1/bucket", { method: "POST", body: JSON.stringify({ id: b, name: b, public: false }) });
      log(`Bucket criado: ${b}`, "ok");
    } catch (err) {
      if (String(err.message).includes("already exists") || String(err.message).includes("Duplicate")) {
        log(`Bucket já existe: ${b}`, "warn");
      } else {
        log(`Falha ao criar bucket ${b}: ${err.message}`, "err");
      }
    }
  }
  await stepStatus("s2", "ok", "ok");
}

async function step3_sql(dry) {
  await stepStatus("s3", "run", "executando");
  if (!state.sqlText) throw new Error("Dump SQL obrigatório.");
  const size = new Blob([state.sqlText]).size;
  const psqlCmd = `PGPASSWORD='${state.destDbPass || "<SENHA>"}' psql "sslmode=require host=db.<PROJECT_REF>.supabase.co port=5432 dbname=postgres user=postgres" -f dump.sql`;
  if (size > 2 * 1024 * 1024) {
    log(`⚠️ SQL de ${(size/1024/1024).toFixed(2)} MB — execute manualmente:`, "warn");
    log(psqlCmd, "warn");
    await stepStatus("s3", "warn", "executar manual");
    return;
  }
  if (dry) { log(`(dry) executaria SQL de ${size} bytes via RPC`); await stepStatus("s3", "ok", "dry"); return; }
  // Tenta via RPC exec_sql (se existir). Caso contrário, orienta psql.
  try {
    await api("/rest/v1/rpc/exec_sql", { method: "POST", body: JSON.stringify({ sql: state.sqlText }) });
    log("SQL executado via RPC exec_sql.", "ok");
    await stepStatus("s3", "ok", "ok");
  } catch (err) {
    log("RPC exec_sql indisponível. Execute manualmente:", "warn");
    log(psqlCmd, "warn");
    log("Depois disso, marque este passo como concluído e continue.", "warn");
    await stepStatus("s3", "warn", "manual");
  }
}

async function step4_users(dry) {
  await stepStatus("s4", "run", "importando");
  if (!state.usersJson || !state.usersJson.length) {
    log("Nenhum arquivo de usuários — pulando (login não funcionará).", "warn");
    await stepStatus("s4", "warn", "pulado"); return;
  }
  let ok = 0, fail = 0;
  for (const u of state.usersJson) {
    if (dry) { log(`(dry) criar user ${u.email || u.phone || u.id}`); ok++; continue; }
    try {
      const body = {
        id: u.id,
        email: u.email,
        phone: u.phone,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: u.user_metadata || u.raw_user_meta_data || {},
        app_metadata: u.app_metadata || u.raw_app_meta_data || {},
        password_hash: u.encrypted_password || undefined,
      };
      // Remove undefined
      Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);
      await api("/auth/v1/admin/users", { method: "POST", body: JSON.stringify(body) });
      ok++;
    } catch (err) {
      fail++;
      log(`Falha user ${u.email || u.id}: ${err.message}`, "err");
    }
  }
  log(`Usuários importados: ${ok} OK, ${fail} falhas`, fail ? "warn" : "ok");
  await stepStatus("s4", fail ? "warn" : "ok", `${ok}/${state.usersJson.length}`);
}

async function step5_storage(dry) {
  await stepStatus("s5", "run", "enviando");
  if (!state.storageFile) {
    log("Sem ZIP de Storage — pulando.", "warn");
    await stepStatus("s5", "warn", "pulado"); return;
  }
  // Unzip usando DecompressionStream (nativo em Chrome) — mas ZIP não é gzip.
  // Vamos usar uma implementação simples de leitura ZIP.
  const buf = new Uint8Array(await state.storageFile.arrayBuffer());
  const entries = parseZip(buf);
  log(`ZIP: ${entries.length} arquivos`);
  let ok = 0, fail = 0;
  for (const e of entries) {
    if (e.isDir || e.size === 0) continue;
    const slash = e.name.indexOf("/");
    if (slash < 0) { log(`Ignorado (sem bucket): ${e.name}`, "warn"); continue; }
    const bucket = e.name.substring(0, slash);
    const path = e.name.substring(slash + 1);
    if (!BUCKETS.includes(bucket)) { log(`Bucket desconhecido: ${bucket}`, "warn"); continue; }
    if (dry) { log(`(dry) upload ${bucket}/${path}`); ok++; continue; }
    try {
      const data = await inflateEntry(e, buf);
      const res = await fetch(`${state.destUrl}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
        method: "POST",
        headers: {
          "apikey": state.destKey,
          "Authorization": `Bearer ${state.destKey}`,
          "x-upsert": "true",
          "Content-Type": guessMime(path),
        },
        body: data,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ok++;
    } catch (err) {
      fail++;
      log(`Falha upload ${e.name}: ${err.message}`, "err");
    }
  }
  log(`Arquivos enviados: ${ok} OK, ${fail} falhas`, fail ? "warn" : "ok");
  await stepStatus("s5", fail ? "warn" : "ok", `${ok} arquivos`);
}

async function step6_validate() {
  await stepStatus("s6", "run", "validando");
  try {
    const tables = ["establishments", "customers", "loyalty_cards", "stamps"];
    for (const t of tables) {
      const r = await fetch(`${state.destUrl}/rest/v1/${t}?select=id&limit=1`, { headers: headers() });
      log(`Tabela ${t}: HTTP ${r.status}`, r.ok ? "ok" : "warn");
    }
    await stepStatus("s6", "ok", "ok");
  } catch (err) {
    await stepStatus("s6", "err", "falha");
    throw err;
  }
}

async function runAll(dry = false) {
  $("runBtn").disabled = true; $("dryBtn").disabled = true;
  try {
    log(dry ? "=== DRY-RUN iniciado ===" : "=== MIGRAÇÃO iniciada ===");
    await step1_verify();
    await step2_buckets(dry);
    await step3_sql(dry);
    await step4_users(dry);
    await step5_storage(dry);
    await step6_validate();
    log("✅ Concluído!", "ok");
  } catch (err) {
    log("❌ Erro: " + err.message, "err");
  } finally {
    $("runBtn").disabled = false; $("dryBtn").disabled = false;
  }
}
$("runBtn").addEventListener("click", () => runAll(false));
$("dryBtn").addEventListener("click", () => runAll(true));

/* ---------- ZIP parsing (minimal, store + deflate) ---------- */
function parseZip(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // Locate End of Central Directory
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("EOCD não encontrado (arquivo não é ZIP válido)");
  const cdSize = dv.getUint32(eocd + 12, true);
  const cdOff = dv.getUint32(eocd + 16, true);
  const entries = [];
  let p = cdOff;
  const end = cdOff + cdSize;
  while (p < end) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const uncompSize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localHdr = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    entries.push({ name, method, compSize, size: uncompSize, localHdr, isDir: name.endsWith("/") });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
async function inflateEntry(e, buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const p = e.localHdr;
  if (dv.getUint32(p, true) !== 0x04034b50) throw new Error("Cabeçalho local inválido");
  const nameLen = dv.getUint16(p + 26, true);
  const extraLen = dv.getUint16(p + 28, true);
  const dataStart = p + 30 + nameLen + extraLen;
  const raw = buf.subarray(dataStart, dataStart + e.compSize);
  if (e.method === 0) return raw;
  if (e.method === 8) {
    // deflate raw
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Response(raw).body.pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new Error("Método ZIP não suportado: " + e.method);
}
function guessMime(path) {
  const ext = path.toLowerCase().split(".").pop();
  return {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
    gif: "image/gif", svg: "image/svg+xml", pdf: "application/pdf",
    json: "application/json", txt: "text/plain",
  }[ext] || "application/octet-stream";
}
