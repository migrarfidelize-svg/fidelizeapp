import { LogoMark } from "@/components/LogoMark";

/**
 * Esqueleto do shell do painel do lojista.
 * Evita a "tela preta" enquanto o gate de autenticação e as memberships
 * carregam (o /app é client-only, então não há HTML de SSR).
 */
export function AppShellSkeleton({ label = "Carregando seu painel…" }: { label?: string }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Rail lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 hidden w-24 flex-col items-center gap-3 border-r border-border/60 bg-card/60 py-4 md:flex">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10">
          <LogoMark className="h-6 w-6" />
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-11 w-11 animate-pulse rounded-xl bg-muted/50" />
        ))}
      </aside>

      <div className="flex min-w-0 flex-col md:pl-24">
        <header className="flex h-14 items-center gap-3 border-b border-border/60 bg-card/70 px-4 md:px-6">
          <div className="h-9 w-9 animate-pulse rounded-lg bg-muted/50 md:hidden" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted/50" />
        </header>

        <main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-5 md:px-6 md:py-7">
          <div className="h-40 animate-pulse rounded-2xl bg-muted/40 md:h-56" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/40" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="h-72 animate-pulse rounded-2xl bg-muted/40 lg:col-span-2" />
            <div className="h-72 animate-pulse rounded-2xl bg-muted/40" />
          </div>
          <p className="pt-2 text-center text-sm text-muted-foreground" role="status" aria-live="polite">
            {label}
          </p>
        </main>
      </div>
    </div>
  );
}
