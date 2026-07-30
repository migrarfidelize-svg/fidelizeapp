import { useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

/**
 * Indicador de transição entre abas/funções dentro dos painéis
 * (lojista `/app` e administrador `/hash`).
 *
 * - Barra de progresso fina no topo da área de conteúdo.
 * - Véu sólido com "Aguarde…" quando a navegação demora mais que ~180ms,
 *   usando o fundo do tema (nunca deixa aparecer o grid do body).
 */
export function PanelTransition({ label = "Aguarde…" }: { label?: string }) {
  const isPending = useRouterState({
    select: (s) => s.status === "pending" || s.isLoading,
  });

  if (!isPending) return null;

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] overflow-hidden"
      >
        <div className="h-full w-1/3 animate-[panel-progress_1.1s_ease-in-out_infinite] rounded-full bg-primary/80" />
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-3 animate-in fade-in duration-150"
        style={{
          backgroundColor: "color-mix(in oklab, var(--color-background) 82%, transparent)",
          backdropFilter: "blur(2px)",
        }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      </div>
    </>
  );
}
