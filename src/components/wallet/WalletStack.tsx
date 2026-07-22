import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Sparkles, Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { toggleCustomerPin } from "@/lib/wallet-prefs.functions";
import type { getMyWallet } from "@/lib/my-wallet.functions";

/**
 * Pilha 3D de cartões de fidelidade estilo Apple Wallet.
 * - Cartão da frente ocupa todo o palco.
 * - Cartões atrás aparecem em escala/translação decrescentes, com blur sutil.
 * - Swipe/drag horizontal, dots e teclas ← → trocam o ativo.
 */

type WalletItem = Awaited<ReturnType<typeof getMyWallet>>[number];

const SWIPE_THRESHOLD = 60;

export function WalletStack({ items }: { items: WalletItem[] }) {
  const [active, setActive] = useState(0);
  const [drag, setDrag] = useState(0);
  const startX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const count = items.length;

  const go = useCallback(
    (delta: number) => {
      setActive((prev) => {
        const next = prev + delta;
        if (next < 0) return 0;
        if (next > count - 1) return count - 1;
        return next;
      });
    },
    [count],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!containerRef.current?.matches(":focus-within")) return;
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (startX.current == null) return;
    setDrag(e.clientX - startX.current);
  }
  function onPointerUp() {
    if (startX.current == null) return;
    if (drag <= -SWIPE_THRESHOLD) go(1);
    else if (drag >= SWIPE_THRESHOLD) go(-1);
    startX.current = null;
    setDrag(0);
  }

  const visible = useMemo(() => {
    // Renderiza no máximo 4 posições (ativa + 3 atrás) para performance.
    return items
      .map((it, idx) => ({ it, idx, offset: idx - active }))
      .filter(({ offset }) => offset >= 0 && offset <= 3);
  }, [items, active]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative w-full outline-none"
      role="region"
      aria-roledescription="carousel"
      aria-label="Pilha de cartões fidelidade"
    >
      <div
        className="relative h-[300px] w-full select-none touch-pan-y"
        style={{ perspective: 1200 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {visible
          .slice()
          .reverse() /* mais fundo primeiro no DOM para z-order via ordem */
          .map(({ it, idx, offset }) => (
            <StackedCard
              key={it.customer.id}
              item={it}
              offset={offset}
              dragX={offset === 0 ? drag : 0}
              onActivate={() => setActive(idx)}
            />
          ))}
      </div>

      {count > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {items.map((it, i) => {
            const isActive = i === active;
            return (
              <button
                key={it.customer.id}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Ir para o cartão ${i + 1} de ${count}`}
                aria-current={isActive ? "true" : undefined}
                className={
                  "h-1.5 rounded-full transition-all " +
                  (isActive
                    ? "w-8 bg-primary shadow-[0_0_8px_color-mix(in_oklab,var(--primary)_55%,transparent)]"
                    : "w-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/40")
                }
              />
            );
          })}
        </div>
      )}

      {count > 1 && (
        <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground/60">
          ← Deslize para trocar →
        </p>
      )}
    </div>
  );
}

function StackedCard({
  item,
  offset,
  dragX,
  onActivate,
}: {
  item: WalletItem;
  offset: number;
  dragX: number;
  onActivate: () => void;
}) {
  const est = item.establishment as {
    slug: string;
    name: string;
    logo_url: string | null;
    primary_color: string;
    active: boolean;
  };
  const card = item.card;
  const req = card ? (card.campaign as { stamps_required: number }).stamps_required || 1 : 1;
  const stamps = card?.stamps ?? 0;
  const pct = Math.min(100, Math.round((stamps / req) * 100));
  const missing = Math.max(0, req - stamps);
  const reward = card ? (card.campaign as { reward_title: string }).reward_title : null;
  const campaignActive = card ? (card.campaign as { active: boolean }).active : true;
  const ready = missing === 0 && !!card && campaignActive;
  const brand = est.primary_color || "hsl(var(--primary))";

  // Camadas de recuo: 0 = ativo; 1..3 = tabs atrás.
  const layerScale = [1, 0.94, 0.88, 0.82][offset] ?? 0.78;
  const layerY = [0, -18, -34, -48][offset] ?? -58;
  const layerOpacity = [1, 0.7, 0.42, 0.22][offset] ?? 0.1;
  const layerBlur = [0, 0.5, 1.2, 1.8][offset] ?? 2.4;
  const rotateX = offset === 0 ? 0 : 6 + offset * 2;
  const rotateZ = dragX / 40;

  const isActive = offset === 0;

  return (
    <div
      onClick={isActive ? undefined : onActivate}
      className={
        "absolute inset-x-0 top-0 h-[260px] transition-[transform,opacity,filter] duration-500 ease-out " +
        (isActive ? "z-30 cursor-grab active:cursor-grabbing" : "z-20 cursor-pointer")
      }
      style={{
        transform: `translate3d(${dragX}px, ${layerY}px, 0) scale(${layerScale}) rotateX(${rotateX}deg) rotateZ(${rotateZ}deg)`,
        opacity: layerOpacity,
        filter: layerBlur ? `blur(${layerBlur}px)` : undefined,
        transformStyle: "preserve-3d",
      }}
      aria-hidden={!isActive}
    >
      <div
        className={
          "relative h-full w-full overflow-hidden rounded-[32px] border shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)] " +
          (isActive ? "border-primary/25" : "border-border/40")
        }
        style={{
          background: "hsl(var(--card))",
        }}
      >
        {/* Base escura + glow da marca */}
        <div className="absolute inset-0 bg-card" />
        {/* Halo respirando na cor da marca — só no cartão ativo */}
        <div
          className={
            "pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl " +
            (isActive ? "wallet-card-breathe" : "opacity-30")
          }
          style={{ background: brand, ["--brand" as never]: brand }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 opacity-25"
          style={{
            background: `linear-gradient(180deg, transparent, color-mix(in oklab, ${brand} 35%, transparent))`,
          }}
        />
        {/* Grade circuit sutil (só no ativo, para reduzir custo) */}
        {isActive && (
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)",
              backgroundSize: "22px 22px",
            }}
          />
        )}

        <div className="relative flex h-full flex-col justify-between p-6">
          {/* Top */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border/50 bg-background/60 text-base font-bold uppercase"
                style={{ color: brand }}
              >
                {est.logo_url ? (
                  <img src={est.logo_url} alt={est.name} className="h-full w-full object-cover" />
                ) : (
                  est.name.slice(0, 2)
                )}
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-display text-base font-bold leading-tight text-foreground">
                  {est.name}
                </h3>
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {item.customer.pinned ? "Fixado • " : ""}
                  {campaignActive ? "Cartão fidelidade" : "Campanha expirada"}
                </p>
              </div>
            </div>
            {isActive && <PinToggle customerId={item.customer.id} pinned={!!item.customer.pinned} />}
          </div>

          {/* Progresso — só no cartão ativo */}
          {isActive && (
            <div className="mt-1 text-right">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Progresso
              </div>
              <div className="mt-0.5 font-display text-lg font-bold leading-none text-primary">
                {stamps}
                <span className="text-sm text-muted-foreground">/{req}</span>
              </div>
            </div>
          )}

          {/* Middle — reward + progress */}
          <div className="mt-6">
            <div className="mb-2 flex items-end justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Meta atual
              </span>
              {reward ? (
                <span className="max-w-[60%] truncate text-right text-sm font-semibold text-foreground">
                  {reward}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Aguardando 1º carimbo</span>
              )}
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full border border-border/60 bg-background/50">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: ready
                    ? "linear-gradient(90deg, hsl(var(--primary)), color-mix(in oklab, hsl(var(--primary)) 55%, white))"
                    : brand,
                  boxShadow: ready
                    ? "0 0 12px color-mix(in oklab, hsl(var(--primary)) 55%, transparent)"
                    : undefined,
                }}
              />
            </div>
          </div>

          {/* Bottom — stamps preview + CTA */}
          <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-4">
            <StampsPreview stamps={stamps} required={req} brand={brand} pulseLatest={isActive && stamps > 0} />
            <Link
              to="/carteira/$slug"
              params={{ slug: est.slug }}
              onClick={(e) => {
                if (!isActive) e.preventDefault();
              }}
              className={
                "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[10px] font-black uppercase tracking-widest transition-transform active:scale-95 " +
                (ready
                  ? "bg-primary text-primary-foreground shadow-[0_0_18px_color-mix(in_oklab,var(--primary)_45%,transparent)]"
                  : "bg-foreground text-background hover:opacity-90")
              }
              aria-label={`Abrir cartão ${est.name}`}
              tabIndex={isActive ? 0 : -1}
            >
              {ready ? (
                <>
                  <Sparkles className="h-3 w-3" /> Resgatar
                </>
              ) : (
                <>
                  Acumular <ChevronRight className="h-3 w-3" />
                </>
              )}
            </Link>
          </div>
        </div>

        {/* Anel sutil na borda do ativo */}
        {isActive && (
          <div
            className="pointer-events-none absolute inset-0 rounded-[32px]"
            style={{ boxShadow: "inset 0 0 0 1px color-mix(in oklab, hsl(var(--primary)) 25%, transparent)" }}
          />
        )}
      </div>
    </div>
  );
}

function PinToggle({ customerId, pinned }: { customerId: string; pinned: boolean }) {
  const qc = useQueryClient();
  const toggle = useServerFn(toggleCustomerPin);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        e.preventDefault();
        setBusy(true);
        try {
          await toggle({ data: { customer_id: customerId, pinned: !pinned } });
          toast.success(pinned ? "Cartão desafixado." : "Cartão fixado no topo.");
          await qc.invalidateQueries({ queryKey: ["my-wallet"] });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Falha ao fixar.");
        } finally {
          setBusy(false);
        }
      }}
      aria-label={pinned ? "Desafixar cartão" : "Fixar cartão"}
      aria-pressed={pinned}
      className={
        "grid h-8 w-8 place-items-center rounded-xl border transition-colors " +
        (pinned
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/50 bg-background/50 text-muted-foreground hover:text-foreground")
      }
    >
      {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
    </button>
  );
}

function StampsPreview({
  stamps,
  required,
  brand,
  pulseLatest,
}: {
  stamps: number;
  required: number;
  brand: string;
  pulseLatest?: boolean;
}) {
  const max = Math.min(3, required);
  const filled = Math.min(stamps, max);
  const extra = Math.max(0, required - max);
  const latestIndex = filled - 1;
  return (
    <div className="flex items-center" style={{ ["--brand" as never]: brand }}>
      <div className="flex -space-x-1.5">
        {Array.from({ length: max }).map((_, i) => {
          const on = i < filled;
          const isLatest = pulseLatest && i === latestIndex;
          return (
            <div
              key={i}
              className={
                "grid h-6 w-6 place-items-center rounded-full border-2 border-background text-[9px] font-bold " +
                (on ? "text-white " : "bg-muted text-muted-foreground/60 ") +
                (isLatest ? "wallet-stamp-pulse relative z-10" : "")
              }
              style={on ? { background: brand } : undefined}
            >
              {on ? "✓" : ""}
            </div>
          );
        })}
      </div>
      {extra > 0 && (
        <span className="ml-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          +{extra}
        </span>
      )}
    </div>
  );
}
