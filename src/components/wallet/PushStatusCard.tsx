import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  BellOff,
  BellRing,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Smartphone,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/vapid";
import {
  subscribePushForAllMyCards,
  unsubscribePushForAllMyCards,
  getMyWalletPushStatus,
} from "@/lib/push.functions";

type PermState = "default" | "granted" | "denied" | "unsupported";
type SubState = "idle" | "checking" | "active" | "inactive" | "error";

/**
 * Full push diagnostic card for /carteira/perfil.
 * Shows browser support, permission state, current subscription status,
 * device count on the server, and a retry button if something failed.
 */
export function PushStatusCard() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<PermState>("default");
  const [subState, setSubState] = useState<SubState>("checking");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [cardCount, setCardCount] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "enable" | "disable" | "refresh">(null);

  const subscribeAll = useServerFn(subscribePushForAllMyCards);
  const unsubscribeAll = useServerFn(unsubscribePushForAllMyCards);
  const getStatus = useServerFn(getMyWalletPushStatus);

  const refresh = useCallback(async () => {
    setErrorMsg(null);
    setSubState("checking");
    try {
      const ok =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      setSupported(ok);
      if (!ok) {
        setPermission("unsupported");
        setSubState("inactive");
        return;
      }
      setPermission(Notification.permission as PermState);

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setEndpoint(sub?.endpoint ?? null);

      if (!sub) {
        setSubState("inactive");
        setCardCount(0);
        return;
      }
      const st = await getStatus({ data: { endpoint: sub.endpoint } });
      setCardCount(st.cardCount ?? 0);
      setSubState(st.subscribed ? "active" : "inactive");
    } catch (e) {
      setSubState("error");
      setErrorMsg(e instanceof Error ? e.message : "Falha ao consultar status.");
    }
  }, [getStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enable() {
    setBusy("enable");
    setErrorMsg(null);
    try {
      if (!("Notification" in window)) throw new Error("Navegador sem suporte a notificações.");
      const perm = await Notification.requestPermission();
      setPermission(perm as PermState);
      if (perm !== "granted") {
        throw new Error(
          perm === "denied"
            ? "Você bloqueou notificações. Habilite manualmente nas configurações do site."
            : "Permissão não concedida.",
        );
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }
      const json = sub.toJSON();
      const res = await subscribeAll({
        data: {
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          user_agent: navigator.userAgent.slice(0, 300),
        },
      });
      setEndpoint(sub.endpoint);
      setCardCount(res.count ?? 0);
      setSubState("active");
      toast.success(
        res.count
          ? `Notificações ativadas em ${res.count} ${res.count === 1 ? "cartão" : "cartões"}.`
          : "Notificações ativadas!",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao ativar notificações.";
      setErrorMsg(msg);
      setSubState((s) => (s === "active" ? s : "error"));
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function disable() {
    setBusy("disable");
    setErrorMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribeAll({ data: { endpoint: sub.endpoint } });
      }
      setSubState("inactive");
      toast.success("Notificações desativadas neste aparelho.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao desativar.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function handleRefresh() {
    setBusy("refresh");
    await refresh();
    setBusy(null);
  }

  // Render helpers
  const permBadge = (() => {
    if (permission === "granted")
      return { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: "Concedida", tone: "ok" };
    if (permission === "denied")
      return { icon: <ShieldAlert className="h-3.5 w-3.5" />, label: "Bloqueada", tone: "bad" };
    if (permission === "unsupported")
      return { icon: <ShieldAlert className="h-3.5 w-3.5" />, label: "Não suportado", tone: "bad" };
    return { icon: <ShieldAlert className="h-3.5 w-3.5" />, label: "Não solicitada", tone: "warn" };
  })();

  const subBadge = (() => {
    if (subState === "active")
      return { icon: <BellRing className="h-3.5 w-3.5" />, label: "Ativo", tone: "ok" };
    if (subState === "checking")
      return { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, label: "Verificando…", tone: "warn" };
    if (subState === "error")
      return { icon: <ShieldAlert className="h-3.5 w-3.5" />, label: "Falha", tone: "bad" };
    return { icon: <BellOff className="h-3.5 w-3.5" />, label: "Inativo", tone: "warn" };
  })();

  const showRetry =
    subState === "error" ||
    (subState === "inactive" && permission === "granted") ||
    permission === "default";

  return (
    <section className="rounded-3xl border border-border/60 bg-card/40 p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-bold uppercase tracking-widest">
            Status das notificações
          </h2>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={busy === "refresh"}
          aria-label="Atualizar status"
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          {busy === "refresh" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      <ul className="space-y-2">
        <StatusRow
          icon={<Smartphone className="h-4 w-4" />}
          label="Suporte do navegador"
          value={
            supported === null
              ? "Verificando…"
              : supported
                ? "Compatível"
                : "Sem suporte a Web Push"
          }
          tone={supported === null ? "warn" : supported ? "ok" : "bad"}
        />
        <StatusRow
          icon={permBadge.icon}
          label="Permissão"
          value={permBadge.label}
          tone={permBadge.tone as "ok" | "warn" | "bad"}
        />
        <StatusRow
          icon={subBadge.icon}
          label="Assinatura de push"
          value={
            subState === "active"
              ? `Ativa em ${cardCount} ${cardCount === 1 ? "cartão" : "cartões"}`
              : subBadge.label
          }
          tone={subBadge.tone as "ok" | "warn" | "bad"}
        />
        {endpoint && (
          <StatusRow
            icon={<Wifi className="h-4 w-4" />}
            label="Endpoint deste aparelho"
            value={truncate(endpoint, 42)}
            tone="ok"
            mono
          />
        )}
      </ul>

      {errorMsg && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {subState === "active" ? (
          <button
            type="button"
            onClick={disable}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold transition-colors hover:border-destructive/60 hover:text-destructive disabled:opacity-60"
          >
            {busy === "disable" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
            Desativar neste aparelho
          </button>
        ) : (
          <button
            type="button"
            onClick={enable}
            disabled={busy !== null || permission === "denied" || supported === false}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "enable" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            {subState === "error" ? "Tentar novamente" : "Ativar notificações"}
          </button>
        )}

        {showRetry && subState !== "active" && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            Recarregar status
          </button>
        )}
      </div>

      {permission === "denied" && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Você bloqueou notificações para este site no navegador. Abra as configurações do site
          (cadeado ao lado do endereço → Notificações → Permitir) e volte aqui para tentar
          novamente.
        </p>
      )}
      {supported === false && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Este navegador não suporta Web Push. No iPhone/iPad é preciso instalar a carteira na tela
          de início (iOS 16.4+) para receber notificações.
        </p>
      )}
    </section>
  );
}

function StatusRow({
  icon,
  label,
  value,
  tone,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "ok" | "warn" | "bad";
  mono?: boolean;
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
      : tone === "bad"
        ? "text-destructive bg-destructive/10 border-destructive/30"
        : "text-amber-500 bg-amber-500/10 border-amber-500/30";
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
      <span className="flex min-w-0 items-center gap-2 text-sm">
        <span className="text-muted-foreground">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <span
        className={
          "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold " +
          toneClass +
          (mono ? " font-mono" : "")
        }
      >
        {value}
      </span>
    </li>
  );
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
