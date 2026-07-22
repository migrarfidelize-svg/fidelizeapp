import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QrCode, WifiOff, AlertTriangle, TimerOff, ScanLine, RefreshCw, Home } from "lucide-react";

/** Shell used by every wallet state — mimics the voucher card visual language. */
function StateShell({
  icon,
  title,
  description,
  tone = "muted",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  tone?: "muted" | "warning" | "danger" | "primary";
  children?: React.ReactNode;
}) {
  const toneRing = {
    muted: "border-border/70",
    warning: "border-amber-500/40",
    danger: "border-destructive/50",
    primary: "border-primary/40",
  }[tone];
  const toneGlow = {
    muted: "from-muted/50 to-transparent",
    warning: "from-amber-500/15 to-transparent",
    danger: "from-destructive/15 to-transparent",
    primary: "from-primary/15 to-transparent",
  }[tone];
  const toneChip = {
    muted: "bg-muted text-foreground",
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
    danger: "bg-destructive/15 text-destructive",
    primary: "bg-primary/15 text-primary",
  }[tone];

  return (
    <div className={`relative mx-auto max-w-md overflow-hidden rounded-[28px] border ${toneRing} bg-card/70 p-6 shadow-sm backdrop-blur`}>
      <div className={`pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-gradient-to-b ${toneGlow} blur-2xl`} />
      <div className="relative flex flex-col items-center text-center">
        <div className={`grid h-16 w-16 place-items-center rounded-2xl ${toneChip}`}>{icon}</div>
        <h2 className="mt-5 font-display text-lg font-bold tracking-tight">{title}</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">{description}</p>
        {children && <div className="mt-5 w-full">{children}</div>}
      </div>
      {/* Voucher-style perforation */}
      <div className="pointer-events-none absolute inset-x-4 bottom-14 flex justify-between">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-border/60" />
        ))}
      </div>
    </div>
  );
}

export function EmptyWalletState() {
  return (
    <StateShell
      tone="primary"
      icon={<QrCode className="h-7 w-7" />}
      title="Você ainda não tem cartões"
      description="Escaneie o QR Code de qualquer estabelecimento parceiro Fidelize para adicionar seu primeiro cartão e começar a acumular carimbos."
    >
      <ul className="mx-auto grid max-w-xs gap-2 text-left text-xs text-muted-foreground">
        <li className="flex items-start gap-2"><ScanLine className="mt-0.5 h-4 w-4 text-primary" /> Aponte a câmera para o QR Code do estabelecimento</li>
        <li className="flex items-start gap-2"><Home className="mt-0.5 h-4 w-4 text-primary" /> O cartão aparece automaticamente aqui</li>
      </ul>
    </StateShell>
  );
}

export function WalletErrorState({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Erro desconhecido ao carregar sua carteira.";
  return (
    <StateShell
      tone="danger"
      icon={<AlertTriangle className="h-7 w-7" />}
      title="Não conseguimos carregar sua carteira"
      description={<>Tente novamente em instantes. <span className="mt-1 block text-[11px] opacity-70">{message}</span></>}
    >
      <div className="flex flex-col gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </button>
        )}
        <Link to="/carteira" className="text-xs text-muted-foreground underline underline-offset-2">
          Ir para o início
        </Link>
      </div>
    </StateShell>
  );
}

export function OfflineWalletState({ onRetry }: { onRetry?: () => void }) {
  return (
    <StateShell
      tone="warning"
      icon={<WifiOff className="h-7 w-7" />}
      title="Você está offline"
      description="Sem conexão com a internet. Os últimos cartões salvos continuam disponíveis, e novos carimbos serão sincronizados assim que voltar."
    >
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" /> Tentar reconectar
        </button>
      )}
    </StateShell>
  );
}

export function ExpiredCardState({ establishmentName }: { establishmentName?: string }) {
  return (
    <StateShell
      tone="warning"
      icon={<TimerOff className="h-7 w-7" />}
      title="Este cartão expirou"
      description={
        establishmentName
          ? `A campanha em ${establishmentName} foi encerrada. Seus carimbos ficam registrados no seu histórico.`
          : "A campanha deste cartão foi encerrada. Seus carimbos ficam registrados no seu histórico."
      }
    >
      <Link
        to="/carteira"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        <Home className="h-4 w-4" /> Voltar para minha carteira
      </Link>
    </StateShell>
  );
}

export function InvalidQrState({ onRetry }: { onRetry?: () => void }) {
  return (
    <StateShell
      tone="danger"
      icon={<ScanLine className="h-7 w-7" />}
      title="QR Code inválido"
      description="Este QR Code não corresponde a um cartão Fidelize ativo. Peça ao estabelecimento para gerar um novo ou verifique se você leu o código completo."
    >
      <div className="flex flex-col gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <RefreshCw className="h-4 w-4" /> Ler outro QR Code
          </button>
        )}
        <Link to="/carteira" className="text-xs text-muted-foreground underline underline-offset-2">
          Voltar para minha carteira
        </Link>
      </div>
    </StateShell>
  );
}

/** Wraps children and swaps them for the offline state when navigator reports offline. */
export function WithOfflineFallback({
  children,
  onRetry,
}: {
  children: React.ReactNode;
  onRetry?: () => void;
}) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!online) return <OfflineWalletState onRetry={onRetry} />;
  return <>{children}</>;
}
