import { Bell, BarChart3, MapPin, MessageCircle, QrCode, Star } from "lucide-react";

/**
 * Painel visual da hero — "Ecossistema dinâmico".
 * Celular central (cartão fidelidade + cardápio story + catálogo) cercado por
 * módulos flutuantes que representam as funcionalidades novas: CRM, atendimento
 * WhatsApp, avaliações, entregadores, QR Code e push.
 * Animações puramente CSS (funcionam em SSR, sem estado).
 */
const PURPLE = "#a78bfa";
const INK = "#020617";

export function HeroEcosystem() {
  return (
    <div className="relative flex w-full items-center justify-center py-6">
      <style>{`
        @keyframes fz-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-14px) } }
        @keyframes fz-spin-slow { to { transform: rotate(360deg) } }
        @keyframes fz-fill { 0%,10% { opacity:.18; transform:scale(.8) } 22%,100% { opacity:1; transform:scale(1) } }
        @keyframes fz-rise { 0% { opacity:0; transform:translateY(14px) } 100% { opacity:1; transform:translateY(0) } }
        .fz-float { animation: fz-float 6s ease-in-out infinite; }
        .fz-float-d { animation: fz-float 6.8s ease-in-out infinite 1.6s; }
        .fz-orbit { animation: fz-spin-slow 42s linear infinite; }
        .fz-orbit-r { animation: fz-spin-slow 34s linear infinite reverse; }
        .fz-card { animation: fz-rise .7s cubic-bezier(.22,1,.36,1) both; transition: transform .45s cubic-bezier(.22,1,.36,1), box-shadow .45s ease; }
        .fz-card:hover { transform: translateY(-6px) scale(1.04); }
        .fz-stamp { animation: fz-fill 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .fz-float,.fz-float-d,.fz-orbit,.fz-orbit-r,.fz-card,.fz-stamp { animation: none !important; }
        }
      `}</style>

      {/* halo + órbitas */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[420px] w-[420px] rounded-full blur-3xl sm:h-[520px] sm:w-[520px]"
        style={{ background: `radial-gradient(circle, ${PURPLE}22, transparent 70%)` }}
      />
      <div aria-hidden className="fz-orbit pointer-events-none absolute hidden h-[460px] w-[460px] rounded-full border border-white/10 sm:block" />
      <div aria-hidden className="fz-orbit-r pointer-events-none absolute hidden h-[330px] w-[330px] rounded-full border border-[color:var(--fz-ring)] sm:block" style={{ ["--fz-ring" as string]: `${PURPLE}33` }} />

      {/* celular central */}
      <div
        className="relative z-20 w-[240px] shrink-0 overflow-hidden rounded-[2.4rem] border-[7px] border-white/10 shadow-2xl sm:w-[262px]"
        style={{ background: "#0b1020" }}
      >
        <div className="flex h-[500px] flex-col sm:h-[540px]">
          <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-white/15" />
          <div className="flex-1 px-4 pt-4">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl" style={{ background: PURPLE }} />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-white/40">Cliente</div>
                <div className="truncate text-sm font-semibold text-white">Café da Serra</div>
              </div>
            </div>

            {/* cartão fidelidade */}
            <div
              className="mt-4 rounded-2xl p-4 text-white shadow-lg"
              style={{ background: `linear-gradient(140deg, ${PURPLE}, #6d5bd0)` }}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">Cartão fidelidade</div>
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <span
                    key={i}
                    className="fz-stamp aspect-square rounded-full bg-white/25"
                    style={{ animationDelay: `${i * 0.28}s` }}
                  />
                ))}
              </div>
              <div className="mt-3 text-xs font-medium">Faltam 2 carimbos para o prêmio</div>
            </div>

            {/* cardápio story */}
            <div className="mt-4 flex gap-2 overflow-hidden">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full p-[2px]"
                  style={{ border: `2px solid ${i < 2 ? PURPLE : "rgba(255,255,255,0.14)"}` }}
                >
                  <span className="h-full w-full rounded-full bg-white/8" />
                </span>
              ))}
            </div>

            {/* catálogo */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="h-20 rounded-xl border border-white/8 bg-white/5" />
              <div className="h-20 rounded-xl border border-white/8 bg-white/5" />
            </div>
          </div>
        </div>
      </div>

      {/* módulos flutuantes */}
      <FloatCard className="fz-float absolute -left-2 top-2 z-30 hidden w-44 md:block" delay="0.05s">
        <div className="mb-2 flex items-center gap-2">
          <Chip><BarChart3 className="h-4 w-4" /></Chip>
          <span className="text-xs font-semibold text-white">CRM</span>
        </div>
        <div className="font-display text-2xl font-extrabold" style={{ color: PURPLE }}>+48%</div>
        <div className="text-[10px] text-white/50">retenção de clientes</div>
      </FloatCard>

      <FloatCard className="fz-float-d absolute -right-4 top-16 z-30 hidden w-48 md:block" delay="0.15s">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/45">Atendimento</span>
        </div>
        <div className="flex items-start gap-2">
          <Chip><MessageCircle className="h-4 w-4" /></Chip>
          <div className="flex-1 rounded-lg bg-white/5 p-2">
            <div className="mb-1 h-1.5 w-full rounded bg-white/15" />
            <div className="h-1.5 w-2/3 rounded bg-white/10" />
          </div>
        </div>
      </FloatCard>

      <FloatCard className="fz-float-d absolute -left-6 bottom-24 z-30 hidden w-40 md:block" delay="0.25s">
        <div className="mb-1 flex gap-0.5 text-amber-300">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-3.5 w-3.5 fill-current" />
          ))}
        </div>
        <div className="text-xs font-semibold text-white">Avaliações</div>
        <div className="text-[10px] text-white/50">4,9 de média no Google</div>
      </FloatCard>

      <FloatCard className="fz-float absolute -right-6 bottom-10 z-30 hidden w-52 md:block" delay="0.35s">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/45">Entrega ativa</div>
            <div className="truncate text-sm font-semibold text-white">Entregador a caminho</div>
          </div>
          <Chip><MapPin className="h-4 w-4" /></Chip>
        </div>
      </FloatCard>

      <div className="absolute -right-14 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
        <FloatCard className="fz-card grid h-13 w-13 place-items-center p-3" delay="0.45s">
          <QrCode className="h-6 w-6" style={{ color: PURPLE }} />
        </FloatCard>
        <FloatCard className="fz-card relative grid h-13 w-13 place-items-center p-3" delay="0.55s">
          <Bell className="h-6 w-6" style={{ color: PURPLE }} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
        </FloatCard>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
      style={{ background: `${PURPLE}1f`, color: PURPLE }}
    >
      {children}
    </span>
  );
}

function FloatCard({
  children, className = "", delay = "0s",
}: { children: React.ReactNode; className?: string; delay?: string }) {
  return (
    <div
      className={`fz-card rounded-2xl border border-white/10 p-4 shadow-xl backdrop-blur-md ${className}`}
      style={{ background: `${INK}cc`, animationDelay: delay }}
    >
      {children}
    </div>
  );
}
