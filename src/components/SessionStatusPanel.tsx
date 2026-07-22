import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Env = "preview" | "published" | "local" | "custom";
type Role = "admin" | "establishment" | "customer" | "anônimo" | "…";

function detectEnv(host: string): Env {
  if (/^(localhost|127\.|0\.0\.0\.0)/.test(host)) return "local";
  if (host.includes("id-preview--") || host.includes("preview--")) return "preview";
  if (host.endsWith(".lovable.app")) return "published";
  return "custom";
}

const KEY = "fidelize:session-panel";
const AUTH_SYNC_CHANNEL = "fidelize-auth-sync";

type SessionSnapshot = {
  env: Env;
  role: Role;
  email: string | null;
  isSignedIn: boolean;
  lastSync: Date;
};

async function readSessionSnapshot(): Promise<SessionSnapshot> {
  const env = detectEnv(window.location.hostname);
  const { data: { user } } = await supabase.auth.getUser();
  const lastSync = new Date();
  if (!user) return { env, role: "anônimo", email: null, isSignedIn: false, lastSync };
  const { data: adminRow } = await supabase
    .from("app_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
  if (adminRow) return { env, role: "admin", email: user.email ?? null, isSignedIn: true, lastSync };
  const { data: profile } = await supabase
    .from("profiles").select("account_type").eq("id", user.id).maybeSingle();
  return {
    env,
    role: profile?.account_type === "establishment" ? "establishment" : "customer",
    email: user.email ?? null,
    isSignedIn: true,
    lastSync,
  };
}

export function SessionStatusPanel() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [env, setEnv] = useState<Env>("preview");
  const [role, setRole] = useState<Role>("…");
  const [email, setEmail] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    setMounted(true);
    setEnv(detectEnv(window.location.hostname));
    try { setOpen(localStorage.getItem(KEY) !== "0"); } catch { setOpen(true); }

    const refresh = async () => {
      const snapshot = await readSessionSnapshot();
      setEnv(snapshot.env);
      setRole(snapshot.role);
      setEmail(snapshot.email);
      setIsSignedIn(snapshot.isSignedIn);
      setLastSync(snapshot.lastSync);
    };
    refresh();
    const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(AUTH_SYNC_CHANNEL) : null;
    const onSyncMessage = () => refresh();
    bc?.addEventListener("message", onSyncMessage);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN" || e === "SIGNED_OUT" || e === "USER_UPDATED") refresh();
    });
    return () => { subscription.unsubscribe(); bc?.removeEventListener("message", onSyncMessage); bc?.close(); };
  }, []);

  if (!mounted) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch {}
  };

  const envColor: Record<Env, string> = {
    preview: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    published: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    local: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    custom: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40",
  };

  const syncSession = async () => {
    const snapshot = await readSessionSnapshot();
    setEnv(snapshot.env);
    setRole(snapshot.role);
    setEmail(snapshot.email);
    setIsSignedIn(snapshot.isSignedIn);
    setLastSync(snapshot.lastSync);
    try {
      localStorage.setItem("fidelize:last-manual-session-sync", JSON.stringify({ at: Date.now(), host: window.location.host, signedIn: snapshot.isSignedIn }));
    } catch {}
    try {
      const bc = new BroadcastChannel(AUTH_SYNC_CHANNEL);
      bc.postMessage({ type: snapshot.isSignedIn ? "SIGNED_IN" : "SIGNED_OUT", source: "session-panel", at: Date.now() });
      bc.close();
    } catch {}
    if (snapshot.isSignedIn) {
      window.location.reload();
    }
  };
  const roleColor: Record<Role, string> = {
    admin: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    establishment: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    customer: "bg-violet-500/20 text-violet-300 border-violet-500/40",
    anônimo: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
    "…": "bg-zinc-500/20 text-zinc-400 border-zinc-500/40",
  };

  if (!open) {
    return (
      <button
        onClick={toggle}
        aria-label="Mostrar status da sessão"
        className="fixed bottom-3 left-3 z-[9999] h-8 w-8 rounded-full border border-white/15 bg-black/60 text-[10px] font-bold text-white backdrop-blur hover:bg-black/80"
      >i</button>
    );
  }

  return (
    <div className="fixed bottom-3 left-3 z-[9999] flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[11px] font-medium text-white shadow-lg backdrop-blur">
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 uppercase tracking-wide ${envColor[env]}`}>{env}</span>
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 uppercase tracking-wide ${roleColor[role]}`}>{role}</span>
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 uppercase tracking-wide ${isSignedIn ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300" : "border-zinc-500/40 bg-zinc-500/20 text-zinc-300"}`}>{isSignedIn ? "online" : "signed_out"}</span>
      {email ? <span className="max-w-[160px] truncate text-white/70" title={email}>{email}</span> : null}
      {lastSync ? <span className="text-white/40" title={lastSync.toLocaleString()}>{lastSync.toLocaleTimeString().slice(0, 5)}</span> : null}
      <button onClick={syncSession} aria-label="Sincronizar sessão" className="rounded-full border border-white/10 px-2 py-0.5 text-white/60 hover:text-white">sync</button>
      <button onClick={toggle} aria-label="Ocultar" className="ml-1 text-white/50 hover:text-white">×</button>
    </div>
  );
}
