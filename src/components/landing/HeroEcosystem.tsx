import { Bell, BarChart3, MapPin, MessageCircle, QrCode, Star, Stamp, Play, ShoppingBag, Store, Utensils } from "lucide-react";

/**
 * Painel visual da hero — "Ecossistema dinâmico".
 * Celular central em tema claro com apresentação rotativa (cartão fidelidade →
 * cardápio story → catálogo) cercado por módulos flutuantes que representam as
 * funcionalidades: CRM, atendimento WhatsApp, avaliações, entregadores, QR e push.
 * Animações puramente CSS (SSR-safe, sem estado).
 */
import { DEFAULT_HERO_DEVICE, type LandingHeroDevice } from "@/lib/landing-content";

const PURPLE = "#7c5cd6";

export function HeroEcosystem({ device }: { device?: LandingHeroDevice }) {
  const d = device ?? DEFAULT_HERO_DEVICE;
  return (
    <div className="relative mx-auto flex w-full max-w-[560px] items-center justify-center px-2 pb-14 pt-20 sm:py-6 lg:px-16">
      <style>{`
        @keyframes fz-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-12px) } }
        @keyframes fz-spin-slow { to { transform: rotate(360deg) } }
        @keyframes fz-fill { 0%,10% { opacity:.25; transform:scale(.82) } 24%,100% { opacity:1; transform:scale(1) } }
        @keyframes fz-rise { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        /* apresentação: 3 telas em loop de 12s */
        @keyframes fz-screen-1 { 0%,28% { opacity:1; transform:translateY(0) } 33%,95% { opacity:0; transform:translateY(-10px) } 100% { opacity:1; transform:translateY(0) } }
        @keyframes fz-screen-2 { 0%,28% { opacity:0; transform:translateY(10px) } 33%,61% { opacity:1; transform:translateY(0) } 66%,100% { opacity:0; transform:translateY(-10px) } }
        @keyframes fz-screen-3 { 0%,61% { opacity:0; transform:translateY(10px) } 66%,94% { opacity:1; transform:translateY(0) } 100% { opacity:0; transform:translateY(-10px) } }
        @keyframes fz-bar { 0%,28% { width:100% } 33%,100% { width:0% } }
        .fz-float { animation: fz-float 6s ease-in-out infinite; }
        .fz-float-d { animation: fz-float 7s ease-in-out infinite 1.6s; }
        .fz-orbit { animation: fz-spin-slow 46s linear infinite; }
        .fz-orbit-r { animation: fz-spin-slow 36s linear infinite reverse; }
        .fz-card { animation: fz-rise .7s cubic-bezier(.22,1,.36,1) both; transition: transform .45s cubic-bezier(.22,1,.36,1), box-shadow .45s ease; }
        .fz-card:hover { transform: translateY(-6px) scale(1.04); }
        .fz-stamp { animation: fz-fill 5s ease-in-out infinite; }
        .fz-s1 { animation: fz-screen-1 12s ease-in-out infinite; }
        .fz-s2 { animation: fz-screen-2 12s ease-in-out infinite; }
        .fz-s3 { animation: fz-screen-3 12s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .fz-float,.fz-float-d,.fz-orbit,.fz-orbit-r,.fz-card,.fz-stamp,.fz-s1,.fz-s2,.fz-s3 { animation: none !important; }
          .fz-s2,.fz-s3 { display:none }
        }
      `}</style>

      {/* halo + órbitas */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[360px] w-[360px] rounded-full blur-3xl sm:h-[500px] sm:w-[500px]"
        style={{ background: `radial-gradient(circle, ${PURPLE}26, transparent 70%)` }}
      />
      <div aria-hidden className="fz-orbit pointer-events-none absolute hidden h-[440px] w-[440px] rounded-full border border-primary/15 lg:block" />
      <div aria-hidden className="fz-orbit-r pointer-events-none absolute hidden h-[320px] w-[320px] rounded-full border border-primary/25 lg:block" />

      {/* celular central — tema claro */}
      <div className="relative z-20 w-[212px] shrink-0 overflow-hidden rounded-[2.4rem] border-[7px] border-white/70 bg-white shadow-2xl sm:w-[258px]">
        <div className="relative flex h-[440px] flex-col bg-[#f6f4fb] sm:h-[524px]">
          <div className="mx-auto mt-2 h-1.5 w-16 shrink-0 rounded-full bg-black/10" />

          {/* topo do app */}
          <div className="flex shrink-0 items-center gap-2.5 px-4 pt-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: PURPLE }}>
              <Store className="h-[18px] w-[18px] text-white" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[10px] uppercase tracking-widest text-black/40">{d.eyebrow}</div>
              <div className="truncate text-sm font-semibold text-[#1b1730]">{d.storeName}</div>
            </div>
          </div>

          {/* indicador de progresso da apresentação */}
          <div className="mx-4 mt-3 h-[3px] shrink-0 overflow-hidden rounded-full bg-black/10">
            <span className="block h-full rounded-full" style={{ background: PURPLE, animation: "fz-bar 12s linear infinite" }} />
          </div>

          {/* telas em loop */}
          <div className="relative mt-3 flex-1 px-4">
            {/* 1 — cartão fidelidade */}
            <div className="fz-s1 absolute inset-x-4 top-0">
              <div className="rounded-2xl p-4 text-white shadow-lg" style={{ background: "linear-gradient(140deg, #8b6ee6, #5b4bbf)" }}>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">{d.cardTitle}</div>
                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  {Array.from({ length: d.stamps }).map((_, i) => (
                    <span
                      key={i}
                      className={`grid aspect-square place-items-center rounded-full ring-1 ring-white/40 ${i < d.stampsFilled ? "fz-stamp bg-white/25" : "bg-white/10"}`}
                      style={{ animationDelay: `${i * 0.28}s` }}
                    >
                      <Stamp className="h-3 w-3 text-white sm:h-3.5 sm:w-3.5" />
                    </span>
                  ))}
                </div>
                <div className="mt-3 text-[11px] font-medium leading-snug">{d.cardFooter}</div>
              </div>
              <div className="mt-3 rounded-xl border border-black/5 bg-white p-3 shadow-sm">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-black/40">{d.rewardLabel}</div>
                <div className="text-xs font-semibold text-[#1b1730]">{d.rewardValue}</div>
              </div>
            </div>

            {/* 2 — cardápio story */}
            <div className="fz-s2 absolute inset-x-4 top-0">
              <div className="flex gap-2 overflow-hidden">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full p-[2px]"
                    style={{ border: `2px solid ${i < 2 ? PURPLE : "rgba(0,0,0,0.10)"}` }}
                  >
                    <span className="h-full w-full rounded-full bg-black/5" />
                  </span>
                ))}
              </div>
              <div className="mt-3 grid h-[190px] place-items-center rounded-2xl border border-black/5 bg-white shadow-sm">
                <span className="grid h-12 w-12 place-items-center rounded-full text-white" style={{ background: PURPLE }}>
                  <Play className="h-5 w-5 fill-current" />
                </span>
              </div>
              <div className="mt-2 text-xs font-semibold text-[#1b1730]">{d.storyTitle}</div>
              <div className="text-[10px] text-black/45">{d.storySubtitle}</div>
            </div>

            {/* 3 — catálogo */}
            <div className="fz-s3 absolute inset-x-4 top-0">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: PURPLE }}>
                  <ShoppingBag className="h-4 w-4" />
                </span>
                <span className="truncate text-xs font-semibold text-[#1b1730]">{d.catalogTitle}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl border border-black/5 bg-white p-2 shadow-sm">
                    <div className="h-14 rounded-lg bg-black/5" />
                    <div className="mt-1.5 h-1.5 w-3/4 rounded bg-black/10" />
                    <div className="mt-1 h-1.5 w-1/2 rounded" style={{ background: `${PURPLE}55` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* módulos flutuantes — também no mobile, em escala menor */}
      <FloatCard className="fz-float absolute -left-1 top-2 z-30 w-[8.5rem] sm:left-0 lg:w-40" delay="0.05s">
        <div className="mb-1.5 flex items-center gap-2">
          <Chip><BarChart3 className="h-4 w-4" /></Chip>
          <span className="truncate text-xs font-semibold">{d.crmTitle}</span>
        </div>
        <div className="font-display text-xl font-extrabold text-primary lg:text-2xl">{d.crmValue}</div>
        <div className="text-[10px] leading-snug text-muted-foreground">{d.crmCaption}</div>
      </FloatCard>

      <FloatCard className="fz-float-d absolute -right-1 top-10 sm:top-6 z-30 w-[9rem] sm:right-0 lg:w-44" delay="0.15s">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{d.chatTitle}</span>
        </div>
        <div className="flex items-start gap-2">
          <Chip><MessageCircle className="h-4 w-4" /></Chip>
          <div className="flex-1 rounded-lg bg-muted p-2">
            <div className="mb-1 h-1.5 w-full rounded bg-foreground/15" />
            <div className="h-1.5 w-2/3 rounded bg-foreground/10" />
          </div>
        </div>
      </FloatCard>

      <FloatCard className="fz-float-d absolute bottom-12 -left-1 z-30 w-[8.5rem] sm:left-0 lg:bottom-16 lg:w-40" delay="0.25s">
        <div className="mb-1 flex gap-0.5 text-amber-400">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-3 w-3 fill-current lg:h-3.5 lg:w-3.5" />
          ))}
        </div>
        <div className="truncate text-xs font-semibold">{d.reviewsTitle}</div>
        <div className="text-[10px] leading-snug text-muted-foreground">{d.reviewsCaption}</div>
      </FloatCard>

      <FloatCard className="fz-float absolute bottom-2 -right-1 z-30 w-[9rem] sm:right-0 lg:bottom-4 lg:w-44" delay="0.35s">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{d.deliveryTitle}</div>
            <div className="truncate text-xs font-semibold">{d.deliveryCaption}</div>
          </div>
          <Chip><MapPin className="h-4 w-4" /></Chip>
        </div>
      </FloatCard>

      <div className="absolute right-0 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 xl:flex">
        <FloatCard className="grid h-12 w-12 place-items-center !p-0" delay="0.45s">
          <QrCode className="h-5 w-5 text-primary" />
        </FloatCard>
        <FloatCard className="relative grid h-12 w-12 place-items-center !p-0" delay="0.55s">
          <Bell className="h-5 w-5 text-primary" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
        </FloatCard>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
      {children}
    </span>
  );
}

function FloatCard({
  children, className = "", delay = "0s",
}: { children: React.ReactNode; className?: string; delay?: string }) {
  return (
    <div
      className={`fz-card rounded-2xl border border-border bg-card/95 p-3 text-card-foreground shadow-xl backdrop-blur-md lg:p-3.5 ${className}`}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}
