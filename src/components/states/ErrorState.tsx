import { useEffect, useRef } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

function getMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return undefined;
}

export function ErrorState({
  title = "Algo deu errado",
  description = "Não foi possível carregar os dados. Tente novamente em instantes.",
  error,
  onRetry,
  retryLabel = "Tentar novamente",
  className,
}: ErrorStateProps) {
  const detail = getMessage(error);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Move keyboard/SR focus to the alert so users are aware immediately.
    ref.current?.focus();
  }, []);
  return (
    <div
      ref={ref}
      role="alert"
      aria-live="assertive"
      tabIndex={-1}
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/20 bg-destructive/5 px-6 py-12 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/20"
      >
        <AlertTriangle className="h-8 w-8" />
      </div>
      <div className="space-y-1 max-w-md">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        {detail ? (
          <p className="mt-2 rounded-md bg-background/60 px-3 py-2 text-xs font-mono text-muted-foreground break-words">
            {detail}
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <Button onClick={onRetry} size="sm" variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
