import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function useOnline() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** Slim status pill — good for headers / near the QR. */
export function OfflineBadge({ className }: { className?: string }) {
  const online = useOnline();
  if (online) return null;
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300",
        className,
      )}
    >
      <WifiOff className="h-3 w-3" aria-hidden />
      Modo offline
    </span>
  );
}

/** Top banner shown while offline, with dismiss. */
export function OfflineBanner() {
  const online = useOnline();
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (online) setDismissed(false);
  }, [online]);
  if (online || dismissed) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto mb-3 flex max-w-xl items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 shadow-sm dark:text-amber-100"
    >
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1 space-y-1">
        <p className="font-semibold">Você está sem internet</p>
        <p className="text-xs opacity-90">
          Estamos mostrando a última versão salva do seu cartão. O QR Code continua válido para o
          atendente escanear no balcão — a atualização em tempo real volta assim que a conexão retornar.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Fechar aviso"
        className="rounded-full p-1 text-amber-900/70 hover:bg-amber-500/20 dark:text-amber-100/70"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Inline alert to show under a control whose action requires the network. */
export function RequiresOnlineAlert({
  message = "Esta ação precisa de internet.",
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100",
        className,
      )}
    >
      <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <div className="flex-1 space-y-1.5">
        <p className="font-semibold">Sem conexão</p>
        <p className="opacity-90">{message}</p>
        <ul className="list-disc pl-4 opacity-90">
          <li>Aguarde alguns instantes e tente novamente.</li>
          <li>Ative os dados móveis ou conecte-se a uma rede Wi-Fi.</li>
          <li>No balcão, mostre a tela do QR Code — o atendente consegue registrar o carimbo.</li>
        </ul>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-600/90 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-600"
          >
            <RefreshCw className="h-3 w-3" aria-hidden /> Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
