import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SR_LOADING = (
  <span className="sr-only">Carregando conteúdo, aguarde…</span>
);

interface LoadingSkeletonProps {
  variant?: "list" | "card-grid" | "table" | "form" | "page";
  rows?: number;
  className?: string;
}

export function LoadingSkeleton({
  variant = "list",
  rows = 4,
  className,
}: LoadingSkeletonProps) {
  if (variant === "card-grid") {
    return (
      <div
        role="status"
        aria-label="Carregando"
        aria-busy="true"
        className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-4 space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-9 w-24 mt-2" />
          </div>
        ))}
      </div>
    );
  }
  if (variant === "table") {
    return (
      <div
        role="status"
        aria-label="Carregando"
        aria-busy="true"
        className={cn("rounded-lg border border-border overflow-hidden", className)}
      >
        <div className="border-b bg-muted/50 p-3 flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="border-b last:border-0 p-3 flex gap-4 items-center">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (variant === "form") {
    return (
      <div
        role="status"
        aria-label="Carregando"
        aria-busy="true"
        className={cn("space-y-4", className)}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }
  if (variant === "page") {
    return (
      <div
        role="status"
        aria-label="Carregando"
        aria-busy="true"
        className={cn("space-y-6", className)}
      >
        <div className="space-y-2">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-label="Carregando"
      aria-busy="true"
      className={cn("space-y-3", className)}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
