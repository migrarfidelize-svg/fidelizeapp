import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tela de carregamento padrão: fundo liso (sem grid/textura do body)
 * e apenas um ícone circulando. Usada em pendingComponents e gates.
 */
export function RouteLoading({
  label = "Carregando…",
  fullscreen = true,
  className,
}: {
  label?: string;
  fullscreen?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3 bg-background [background-image:none]",
        fullscreen ? "min-h-[70dvh]" : "py-16",
        className,
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/** Variante que cobre a viewport inteira com fundo liso. */
export function FullPageLoading({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background [background-image:none]">
      <RouteLoading label={label} fullscreen={false} />
    </div>
  );
}
