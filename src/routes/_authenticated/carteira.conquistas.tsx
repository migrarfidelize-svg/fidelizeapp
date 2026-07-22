import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Trophy } from "lucide-react";
import { AchievementBadge } from "@/components/wallet/AchievementBadge";
import { listAchievementsCatalog, listMyAchievements } from "@/lib/achievements.functions";

export const Route = createFileRoute("/_authenticated/carteira/conquistas")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Conquistas — Carteira Fidelize" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AchievementsPage,
});

function AchievementsPage() {
  const { data: catalog = [], isLoading: loadingCat } = useQuery({
    queryKey: ["achievements-catalog"],
    queryFn: () => listAchievementsCatalog(),
    staleTime: 5 * 60_000,
  });
  const { data: mine = [], isLoading: loadingMine } = useQuery({
    queryKey: ["my-achievements"],
    queryFn: () => listMyAchievements(),
    staleTime: 30_000,
  });

  const mineMap = new Map(mine.map((m) => [m.code, m]));
  const unlockedCount = mine.length;
  const total = catalog.length;
  const pct = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

  // Agrupa por raridade
  const byRarity: Record<string, typeof catalog> = {
    legendary: [],
    epic: [],
    rare: [],
    common: [],
  };
  for (const a of catalog) byRarity[a.rarity].push(a);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          to="/carteira"
          className="grid h-9 w-9 place-items-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Conquistas</h1>
          <p className="text-xs text-muted-foreground">
            Colecione marcos ao usar seus cartões Fidelize
          </p>
        </div>
      </div>

      {/* Progresso geral */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/15 via-background to-background p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg">
            <Trophy className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-primary">
              Seu progresso
            </div>
            <div className="font-display text-3xl font-black">
              {unlockedCount}
              <span className="text-lg font-bold text-muted-foreground">/{total}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">{pct}% completo</div>
          </div>
        </div>
      </div>

      {loadingCat || loadingMine ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-3xl border border-border/60 bg-card/30" />
          ))}
        </div>
      ) : (
        (["legendary", "epic", "rare", "common"] as const).map((rarity) => {
          const items = byRarity[rarity];
          if (!items.length) return null;
          const labels = { legendary: "Lendárias", epic: "Épicas", rare: "Raras", common: "Comuns" };
          return (
            <section key={rarity}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {labels[rarity]}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((a) => {
                  const owned = mineMap.get(a.code);
                  return (
                    <AchievementBadge
                      key={a.code}
                      code={a.code}
                      title={a.title}
                      description={a.description}
                      icon={a.icon}
                      rarity={a.rarity}
                      unlocked={!!owned}
                      unlockedAt={owned?.unlockedAt}
                    />
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
