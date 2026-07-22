import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { exportMyData, deleteMyAccount } from "@/lib/lgpd.functions";
import { getMyPushPreferences, updateMyPushPreferences } from "@/lib/wallet-prefs.functions";
import { clearWalletCache } from "@/lib/offline-wallet-cache";
import { toast } from "sonner";
import { User, Download, Trash2, ShieldCheck, AlertTriangle, ChevronRight, Bell, Stamp as StampIcon, Gift, Megaphone, Cake } from "lucide-react";

export const Route = createFileRoute("/_authenticated/carteira/perfil")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Meu perfil — Carteira Fidelize" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WalletProfile,
});

function WalletProfile() {
  const navigate = useNavigate();
  const exportFn = useServerFn(exportMyData);
  const deleteFn = useServerFn(deleteMyAccount);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [downloading, setDownloading] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id;
      setEmail(session.user?.email ?? "");
      if (uid) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", uid)
          .maybeSingle();
        setName(data?.full_name ?? "");
        setPhone(data?.phone ?? "");
      }
      setLoading(false);
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: session } = await supabase.auth.getUser();
    const uid = session.user?.id;
    if (!uid) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: uid, full_name: name, phone }, { onConflict: "id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado.");
  }

  async function handleExport() {
    setDownloading(true);
    try {
      const data = await exportFn();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fidelize-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteFn({ data: { confirmation } });
      clearWalletCache();
      await supabase.auth.signOut();
      toast.success("Sua conta foi excluída.");
      navigate({ to: "/", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir conta.");
      setDeleting(false);
    }
  }

  if (loading)
    return <div className="pt-10 text-center text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pt-2">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <User className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold">Meu perfil</h1>
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
      </div>

      <form
        onSubmit={save}
        className="space-y-4 rounded-3xl border border-border/60 bg-card/40 p-5"
      >
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Nome completo
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Telefone
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          disabled={saving}
          type="submit"
          className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>
      </form>

      <PushPreferencesSection />



      {/* LGPD self-service em destaque */}
      <section className="rounded-3xl border border-border/60 bg-card/40 p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-bold uppercase tracking-widest">
            Privacidade e dados
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Seus direitos garantidos pela LGPD (Lei 13.709/2018).
        </p>

        <div className="mt-4 space-y-2">
          <button
            onClick={handleExport}
            disabled={downloading}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors hover:border-primary/50 disabled:opacity-60"
          >
            <span className="flex items-center gap-3">
              <Download className="h-4 w-4 text-primary" />
              <span>
                <span className="block text-sm font-semibold">Baixar meus dados</span>
                <span className="block text-[11px] text-muted-foreground">
                  Arquivo JSON com tudo que temos sobre você (art. 18, II e V)
                </span>
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <Link
            to="/lgpd"
            className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors hover:border-primary/50"
          >
            <span className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>
                <span className="block text-sm font-semibold">Central de privacidade</span>
                <span className="block text-[11px] text-muted-foreground">
                  Correção, anonimização e outros direitos
                </span>
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          <button
            onClick={() => setDangerOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-left transition-colors hover:border-destructive"
          >
            <span className="flex items-center gap-3">
              <Trash2 className="h-4 w-4 text-destructive" />
              <span>
                <span className="block text-sm font-semibold text-destructive">
                  Excluir minha conta
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Ação irreversível. Remove perfil, vínculos e login.
                </span>
              </span>
            </span>
            <ChevronRight
              className={
                "h-4 w-4 text-muted-foreground transition-transform " +
                (dangerOpen ? "rotate-90" : "")
              }
            />
          </button>

          {dangerOpen && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
              <div className="mb-2 flex items-start gap-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Para confirmar, digite exatamente{" "}
                  <code className="rounded bg-destructive/10 px-1 font-mono">
                    EXCLUIR MINHA CONTA
                  </code>
                  .
                </span>
              </div>
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="EXCLUIR MINHA CONTA"
                className="w-full rounded-lg border border-destructive/40 bg-background px-3 py-2 font-mono text-sm"
              />
              <button
                onClick={handleDelete}
                disabled={deleting || confirmation !== "EXCLUIR MINHA CONTA"}
                className="mt-2 w-full rounded-lg bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-40"
              >
                {deleting ? "Excluindo…" : "Excluir permanentemente"}
              </button>
            </div>
          )}
        </div>
      </section>

      <button
        onClick={async () => {
          clearWalletCache();
          await supabase.auth.signOut();
          navigate({ to: "/auth", replace: true });
        }}
        className="w-full rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:text-foreground"
      >
        Sair da conta
      </button>
    </div>
  );
}

type Prefs = { stamp: boolean; reward: boolean; campaign: boolean; birthday: boolean };
const DEFAULT_PREFS: Prefs = { stamp: true, reward: true, campaign: true, birthday: true };

function PushPreferencesSection() {
  const getFn = useServerFn(getMyPushPreferences);
  const updateFn = useServerFn(updateMyPushPreferences);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [deviceCount, setDeviceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<keyof Prefs | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await getFn();
        setDeviceCount(r.deviceCount);
        setPrefs((r.preferences as Prefs | null) ?? DEFAULT_PREFS);
      } catch {
        setPrefs(DEFAULT_PREFS);
      } finally {
        setLoading(false);
      }
    })();
  }, [getFn]);

  async function toggle(key: keyof Prefs) {
    if (!prefs) return;
    const next: Prefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(key);
    try {
      await updateFn({ data: { preferences: next } });
      toast.success("Preferências atualizadas.");
    } catch (e) {
      setPrefs(prefs);
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(null);
    }
  }

  const items: Array<{ key: keyof Prefs; icon: React.ReactNode; title: string; desc: string }> = [
    { key: "stamp", icon: <StampIcon className="h-4 w-4 text-primary" />, title: "Novo carimbo", desc: "Quando um atendente carimbar seu cartão." },
    { key: "reward", icon: <Gift className="h-4 w-4 text-primary" />, title: "Prêmio pronto", desc: "Quando um cartão atingir a meta e liberar o prêmio." },
    { key: "campaign", icon: <Megaphone className="h-4 w-4 text-primary" />, title: "Novidades da loja", desc: "Ofertas e comunicados enviados pelo estabelecimento." },
    { key: "birthday", icon: <Cake className="h-4 w-4 text-primary" />, title: "Aniversário", desc: "Mimo especial no seu dia." },
  ];

  return (
    <section className="rounded-3xl border border-border/60 bg-card/40 p-5">
      <div className="mb-1 flex items-center gap-2">
        <Bell className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-bold uppercase tracking-widest">Notificações</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        {deviceCount === 0
          ? "Você ainda não ativou notificações em nenhum cartão. Abra um cartão e toque em ‘Receber notificações’ para começar."
          : `${deviceCount} dispositivo${deviceCount > 1 ? "s" : ""} recebendo suas notificações.`}
      </p>

      <ul className="mt-4 space-y-2">
        {items.map((it) => {
          const on = prefs?.[it.key] ?? true;
          const disabled = loading || deviceCount === 0 || saving === it.key;
          return (
            <li key={it.key}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggle(it.key)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                aria-pressed={on}
              >
                <span className="flex items-center gap-3">
                  {it.icon}
                  <span>
                    <span className="block text-sm font-semibold">{it.title}</span>
                    <span className="block text-[11px] text-muted-foreground">{it.desc}</span>
                  </span>
                </span>
                <span
                  className={
                    "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
                    (on ? "bg-primary" : "bg-muted-foreground/30")
                  }
                >
                  <span
                    className={
                      "inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform " +
                      (on ? "translate-x-5" : "translate-x-0.5")
                    }
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
