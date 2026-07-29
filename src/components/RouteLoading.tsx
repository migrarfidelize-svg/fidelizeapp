import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tela de carregamento padrão: fundo liso sólido (branco no tema claro,
 * escuro no tema escuro), sem grid/textura do body, apenas ícone girando
 * e o texto "Carregando…". Usada em pendingComponents e gates.
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
        "flex w-full flex-col items-center justify-center gap-4",
        fullscreen ? "fixed inset-0 z-[9999] min-h-dvh" : "min-h-dvh py-16",
        className,
      )}
      style={{
        backgroundColor: "var(--color-background)",
        backgroundImage: "none",
      }}
    >
      <div className="relative flex items-center justify-center">
        <div className="absolute h-16 w-16 rounded-full bg-primary/10 animate-pulse" />
        <Loader2 className="relative h-10 w-10 animate-spin text-primary" aria-hidden />
      </div>
      <p className="text-base font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

/** Variante que cobre a viewport inteira com fundo liso. */
export function FullPageLoading({ label = "Carregando…" }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center"
      style={{
        backgroundColor: "var(--color-background)",
        backgroundImage: "none",
      }}
    >
      <RouteLoading label={label} fullscreen={false} />
    </div>
  );
}

