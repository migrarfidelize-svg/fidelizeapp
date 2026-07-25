import { useCallback, useEffect, useState } from "react";
import { Share, PlusSquare, CheckCircle2, Circle, AlertTriangle, RefreshCw, Compass, Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type IosCheck = {
  key: string;
  label: string;
  hint: string;
  done: boolean;
};

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const touch = (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints ?? 0;
  return /iPhone|iPod|iPad/.test(ua) || (navigator.platform === "MacIntel" && touch > 1);
}

/** No iOS todo navegador usa WebKit; só o Safari “de verdade” instala à tela de início. */
function isRealSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (!/Safari\//.test(ua)) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV|Line\/|GSA\//.test(ua);
}

function isStandaloneNow() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

type Props = {
  /** Mostra o bloco de ativação de notificações após a instalação. */
  withNotifications?: boolean;
  /** true quando o aparelho já está registrado no backend. */
  subscribed?: boolean;
  /** Ação de ativação (pedido de permissão + assinatura). */
  onEnable?: () => void | Promise<void>;
  busy?: boolean;
};

/**
 * Passo a passo refinado para iPhone/iPad: instruções específicas do Safari,
 * ativação de notificações e um checklist verificado ao vivo antes de concluir.
 */
export function IosSetupGuide({ withNotifications = false, subscribed = false, onEnable, busy = false }: Props) {
  const [standalone, setStandalone] = useState(false);
  const [safari, setSafari] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [checkedAt, setCheckedAt] = useState<number>(0);

  const recheck = useCallback(() => {
    setStandalone(isStandaloneNow());
    setSafari(isRealSafari());
    setPermission(notificationPermission());
    setCheckedAt(Date.now());
  }, []);

  useEffect(() => {
    recheck();
    const onVisible = () => recheck();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [recheck]);

  const ios = isIosDevice();

  const checks: IosCheck[] = [
    {
      key: "safari",
      label: "Aberto no Safari",
      hint: "Chrome, Firefox e navegadores dentro do Instagram/WhatsApp não instalam no iPhone.",
      done: safari || standalone,
    },
    {
      key: "standalone",
      label: "App aberto pelo ícone da tela de início",
      hint: "Depois de adicionar, feche o Safari e abra pelo ícone Fidelize.",
      done: standalone,
    },
  ];

  if (withNotifications) {
    checks.push(
      {
        key: "permission",
        label: "Permissão de notificações concedida",
        hint:
          permission === "denied"
            ? "Ajustes ▸ Notificações ▸ Fidelize ▸ Permitir Notificações."
            : "Toque em “Ativar notificações” e responda Permitir.",
        done: permission === "granted",
      },
      {
        key: "subscribed",
        label: "Aparelho registrado no Fidelize",
        hint: "Confirmação final: só depois disso os avisos chegam neste iPhone.",
        done: !!subscribed,
      },
    );
  }

  const allDone = checks.every((c) => c.done);

  return (
    <div className="space-y-4">
      {ios && !safari && !standalone && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">
            Você está em outro navegador. Copie o endereço e abra no <strong>Safari</strong> — no iPhone só ele
            adiciona o app à tela de início.
          </span>
        </p>
      )}

      <ol className="space-y-3 text-sm">
        <li className="flex items-start gap-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">1</span>
          <span className="min-w-0">
            Abra o Fidelize no <strong>Safari</strong> <Compass className="inline h-3.5 w-3.5" /> e toque na barra
            inferior em <Share className="inline h-4 w-4" /> <strong>Compartilhar</strong>.
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Se a barra sumiu, role a página para baixo que ela reaparece.
            </span>
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">2</span>
          <span className="min-w-0">
            Deslize a lista e escolha <PlusSquare className="inline h-4 w-4" />{" "}
            <strong>Adicionar à Tela de Início</strong>.
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Não aparece? Toque em “Editar ações” e ative essa opção.
            </span>
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">3</span>
          <span className="min-w-0">
            Confirme em <strong>Adicionar</strong> e abra o app pelo <strong>ícone Fidelize</strong> na tela de
            início — não pelo Safari.
          </span>
        </li>
        {withNotifications && (
          <>
            <li className="flex items-start gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">4</span>
              <span className="min-w-0">
                Dentro do app, toque em <strong>Ativar notificações</strong> e responda{" "}
                <strong>Permitir</strong> no aviso do iOS.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">5</span>
              <span className="min-w-0">
                Se já tinha recusado antes: <strong>Ajustes ▸ Notificações ▸ Fidelize</strong> e ligue{" "}
                <strong>Permitir Notificações</strong>. Depois volte aqui e toque em “Verificar novamente”.
              </span>
            </li>
          </>
        )}
      </ol>

      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Confira antes de concluir
          </p>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={recheck}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Verificar
          </Button>
        </div>
        <ul className="mt-2 space-y-2">
          {checks.map((c) => (
            <li key={c.key} className="flex items-start gap-2 text-sm">
              {c.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0">
                <span className={c.done ? "text-foreground" : "font-medium"}>{c.label}</span>
                {!c.done && <span className="mt-0.5 block text-xs text-muted-foreground">{c.hint}</span>}
              </span>
            </li>
          ))}
        </ul>

        {withNotifications && onEnable && !subscribed && standalone && permission !== "denied" && (
          <Button size="sm" className="mt-3 w-full" onClick={() => void onEnable()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
            Ativar notificações agora
          </Button>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          {allDone
            ? "Tudo certo neste iPhone — pode fechar este guia."
            : checkedAt
              ? "Conclua os itens pendentes e toque em “Verificar”."
              : ""}
        </p>
      </div>
    </div>
  );
}
