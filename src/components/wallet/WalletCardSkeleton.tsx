import { cn } from "@/lib/utils";

/** Skeleton no formato do cartão de fidelidade — usado em pending/loader. */
export function WalletCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Carregando cartão"
      aria-busy="true"
      className={cn(
        "relative h-[260px] w-full overflow-hidden rounded-[32px] border border-border/50 bg-card/60 p-6 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 -translate-x-full animate-[skeleton-shimmer_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary/8 to-transparent" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 rounded-2xl bg-muted/70" />
            <div className="space-y-2">
              <div className="h-3.5 w-32 rounded-full bg-muted/70" />
              <div className="h-2.5 w-20 rounded-full bg-muted/50" />
            </div>
          </div>
          <div className="space-y-2 text-right">
            <div className="ml-auto h-2 w-14 rounded-full bg-muted/50" />
            <div className="ml-auto h-5 w-16 rounded-full bg-muted/70" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-2.5 w-20 rounded-full bg-muted/50" />
            <div className="h-3 w-32 rounded-full bg-muted/70" />
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted/50" />
        </div>
        <div className="flex items-center justify-between border-t border-border/40 pt-4">
          <div className="flex -space-x-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-6 w-6 rounded-full border-2 border-background bg-muted/70" />
            ))}
          </div>
          <div className="h-8 w-24 rounded-xl bg-muted/70" />
        </div>
      </div>
    </div>
  );
}

/** Grid de skeletons no formato de cartão. */
export function WalletCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <WalletCardSkeleton key={i} className={i > 0 ? "opacity-70" : ""} />
      ))}
    </div>
  );
}

/** Skeleton para a home — hero + KPIs + feed. */
export function WalletHomeSkeleton() {
  return (
    <div role="status" aria-label="Carregando" aria-busy="true" className="space-y-5">
      <div className="space-y-2 pt-2">
        <div className="h-7 w-56 rounded-full bg-muted/70" />
        <div className="h-3 w-72 rounded-full bg-muted/50" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl border border-border/60 bg-card/40" />
        ))}
      </div>
      <WalletCardSkeleton />
      <div className="space-y-2 rounded-3xl border border-border/60 bg-card/30 p-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-background/60 p-2.5">
            <div className="h-9 w-9 rounded-xl bg-muted/70" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 rounded-full bg-muted/70" />
              <div className="h-2.5 w-1/2 rounded-full bg-muted/50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
