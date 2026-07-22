import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Stamp, Gift, MapPin, Sparkles, Calendar, Trophy } from "lucide-react";
import { getMyYearRecap } from "@/lib/achievements.functions";

export const Route = createFileRoute("/_authenticated/carteira/retrospectiva")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Retrospectiva — Carteira Fidelize" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecapPage,
});

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function RecapPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-year-recap"],
    queryFn: () => getMyYearRecap(),
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-56 animate-pulse rounded-3xl bg-card/30" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-card/30" />
          ))}
        </div>
      </div>
    );
  }

  const {
    year,
    totalStamps,
    totalRewards,
    establishmentsCount,
    favoriteEstablishment,
    busiestMonth,
    achievementsUnlocked,
  } = data;

  const empty = totalStamps === 0 && totalRewards === 0;

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
          <h1 className="font-display text-2xl font-bold tracking-tight">Sua retrospectiva</h1>
          <p className="text-xs text-muted-foreground">Um ano em números na sua Carteira</p>
        </div>
      </div>

      {/* Hero cinematográfico */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/25 via-fuchsia-500/10 to-amber-500/15 p-6 text-center shadow-xl">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-fuchsia-500/25 blur-3xl" />
        </div>
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-background/60 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary backdrop-blur">
            <Sparkles className="h-3 w-3" /> Retrospectiva {year}
          </div>
          {empty ? (
            <>
              <h2 className="font-display text-2xl font-black">Seu ano começa agora</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Comece a acumular carimbos e volte aqui pra ver sua história.
              </p>
            </>
          ) : (
            <>
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Você deu
              </div>
              <div className="font-display text-6xl font-black tracking-tight">
                {totalStamps}
              </div>
              <div className="text-lg font-bold">
                {totalStamps === 1 ? "carimbo" : "carimbos"} em {year} ✨
              </div>
              {favoriteEstablishment && (
                <p className="mt-2 text-sm text-muted-foreground">
                  A maioria em{" "}
                  <span className="font-semibold text-foreground">{favoriteEstablishment.name}</span>
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {!empty && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <RecapTile
              icon={<Gift className="h-5 w-5" />}
              label="Prêmios resgatados"
              value={totalRewards}
              accent="from-fuchsia-500/20 to-purple-500/10"
            />
            <RecapTile
              icon={<MapPin className="h-5 w-5" />}
              label="Estabelecimentos"
              value={establishmentsCount}
              accent="from-sky-500/20 to-blue-500/10"
            />
            <RecapTile
              icon={<Trophy className="h-5 w-5" />}
              label="Conquistas no ano"
              value={achievementsUnlocked}
              accent="from-amber-500/20 to-orange-500/10"
            />
            <RecapTile
              icon={<Stamp className="h-5 w-5" />}
              label="Total de carimbos"
              value={totalStamps}
              accent="from-primary/20 to-primary/5"
            />
          </div>

          {favoriteEstablishment && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Seu lugar favorito
              </h2>
              <Link
                to="/carteira/$slug"
                params={{ slug: favoriteEstablishment.slug }}
                className="group relative flex items-center gap-3 overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-4 transition-all hover:border-primary/40"
              >
                <div
                  className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border/60 bg-muted text-lg font-bold uppercase"
                  style={{ color: favoriteEstablishment.primaryColor || undefined }}
                >
                  {favoriteEstablishment.logoUrl ? (
                    <img
                      src={favoriteEstablishment.logoUrl}
                      alt={favoriteEstablishment.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    favoriteEstablishment.name.slice(0, 2)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-black uppercase tracking-widest text-primary">
                    Frequentado
                  </div>
                  <div className="truncate font-display text-lg font-bold">
                    {favoriteEstablishment.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {favoriteEstablishment.stamps} carimbos em {year}
                  </div>
                </div>
              </Link>
            </section>
          )}

          {busiestMonth && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Mês mais ativo
              </h2>
              <div className="flex items-center gap-3 rounded-3xl border border-border/60 bg-card/40 p-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-500/25 to-orange-500/15 text-amber-500 dark:text-amber-300">
                  <Calendar className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-lg font-bold">
                    {MONTH_NAMES[busiestMonth.month]}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {busiestMonth.count} carimbos nesse mês
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function RecapTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className={"relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br p-4 " + accent}>
      <div className="mb-1 text-muted-foreground">{icon}</div>
      <div className="font-display text-3xl font-black">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
