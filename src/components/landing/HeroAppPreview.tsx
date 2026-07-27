import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Gift,
  QrCode,
  ShoppingBag,
  ShoppingCart,
  Star,
  Stamp,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import burgerImg from "@/assets/menu-templates/burgers-especiais.jpg.asset.json";
import pizzaImg from "@/assets/menu-templates/pizzas-salgadas.jpg.asset.json";
import acaiImg from "@/assets/menu-templates/acai-especial.jpg.asset.json";


/** Tokens do mockup — trocam automaticamente entre claro/escuro (ver .hero-phone em styles.css). */
const ACCENT = "var(--hp-accent)";
const TONE_MAGENTA = "var(--hp-magenta)";
const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
const INK = "var(--hp-ink)";
const INK_DIM = "var(--hp-ink-dim)";
const INK_FAINT = "var(--hp-ink-faint)";
const LINE = "var(--hp-line)";
const SURFACE = "var(--hp-surface)";

type ScreenKey = "carteira" | "carimbar" | "cardapio" | "catalogo";

const SCREENS: { key: ScreenKey; label: string; icon: typeof Wallet }[] = [
  { key: "carteira", label: "Carteira", icon: Wallet },
  { key: "carimbar", label: "Lojista", icon: Stamp },
  { key: "cardapio", label: "Cardápio", icon: UtensilsCrossed },
  { key: "catalogo", label: "Catálogo", icon: ShoppingBag },
];

const DURATION = 5200;

export function HeroAppPreview() {
  const [i, setI] = useState(0);
  const [t, setT] = useState(0);

  useEffect(() => {
    const started = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = (now - started) / DURATION;
      if (p >= 1) {
        setT(0);
        setI((v) => (v + 1) % SCREENS.length);
        return;
      }
      setT(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [i]);

  const active = SCREENS[i]?.key ?? "carteira";

  return (
    <div className="hero-phone relative w-full max-w-[380px]">
      {/* halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] blur-3xl"
        style={{
          background: `radial-gradient(60% 50% at 50% 25%, ${tint(ACCENT, 14)}, transparent 70%), radial-gradient(50% 40% at 80% 80%, ${tint(TONE_MAGENTA, 12)}, transparent 70%)`,
        }}
      />

      {/* device */}
      <div
        className="relative mx-auto aspect-[9/18.5] w-[280px] overflow-hidden rounded-[2.4rem] border p-2 shadow-2xl backdrop-blur"
        style={{
          borderColor: "var(--hp-frame-line)",
          background: "var(--hp-frame-bg)",
        }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[2rem]" style={{ background: "var(--hp-screen)" }}>
          <div
            className="absolute left-1/2 top-2 z-30 h-4 w-20 -translate-x-1/2 rounded-full"
            style={{ background: "var(--hp-notch)" }}
          />
          <div className="relative h-full w-full">
            {active === "carteira" && <WalletScreen />}
            {active === "carimbar" && <MerchantScreen />}
            {active === "cardapio" && <MenuScreen />}
            {active === "catalogo" && <CatalogScreen />}
          </div>
        </div>
      </div>

      {/* tabs / progress */}
      <div className="mx-auto mt-5 flex max-w-[340px] items-center justify-center gap-1.5">
        {SCREENS.map((s, k) => {
          const Icon = s.icon;
          const on = k === i;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setI(k);
                setT(0);
              }}
              className="group relative flex-1 overflow-hidden rounded-lg border px-1.5 py-1.5 text-left transition-colors"
              style={{
                borderColor: on ? tint(ACCENT, 45) : LINE,
                background: on ? tint(ACCENT, 8) : SURFACE,
              }}
              aria-label={s.label}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0"
                style={{ width: on ? `${t * 100}%` : "0%", background: tint(ACCENT, 10) }}
              />
              <span className="relative flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" style={{ color: on ? ACCENT : INK_DIM }} />
                <span className="truncate text-[10px] font-medium" style={{ color: on ? INK : INK_DIM }}>
                  {s.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScreenShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col pt-9 animate-[fzFade_.5s_ease-out]">
      <div className="px-4 pb-3">
        <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: INK_FAINT }}>
          {sub}
        </p>
        <h3 className="text-sm font-bold" style={{ color: INK }}>
          {title}
        </h3>
      </div>
      <div className="min-h-0 flex-1 px-4 pb-4">{children}</div>
      <style>{`@keyframes fzFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function WalletScreen() {
  const [filled, setFilled] = useState(7);
  useEffect(() => {
    const to = setTimeout(() => setFilled(8), 900);
    return () => clearTimeout(to);
  }, []);
  return (
    <ScreenShell sub="Cliente" title="Meu cartão fidelidade">
      <div
        className="rounded-2xl border p-3"
        style={{
          borderColor: tint(ACCENT, 25),
          background: `linear-gradient(150deg, ${tint(ACCENT, 10)}, ${SURFACE})`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold" style={{ color: INK }}>
            Café da Serra
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold"
            style={{ background: tint(ACCENT, 16), color: ACCENT }}
          >
            Ouro
          </span>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {Array.from({ length: 10 }).map((_, k) => {
            const on = k < filled;
            return (
              <span
                key={k}
                className="grid aspect-square place-items-center rounded-lg border transition-all duration-500"
                style={{
                  borderColor: on ? tint(ACCENT, 50) : LINE,
                  background: on ? tint(ACCENT, 14) : SURFACE,
                  boxShadow: on && k === filled - 1 ? `0 0 16px ${tint(ACCENT, 45)}` : "none",
                }}
              >
                {on ? <Stamp className="h-3 w-3" style={{ color: ACCENT }} /> : null}
              </span>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px]" style={{ color: INK_DIM }}>
          <span>Faltam {Math.max(0, 10 - filled)} carimbos</span>
          <span style={{ color: ACCENT }}>{filled}/10</span>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Row icon={Gift} title="Recompensa liberada" sub="1 café grátis · expira em 7 dias" tone={TONE_MAGENTA} />
        <Row icon={Bell} title="Notificação recebida" sub="Terça do combo: 2 carimbos" tone={ACCENT} />
      </div>
    </ScreenShell>
  );
}

function MerchantScreen() {
  return (
    <ScreenShell sub="Lojista" title="Carimbar cliente">
      <div
        className="grid place-items-center rounded-2xl border py-4"
        style={{ borderColor: tint(ACCENT, 25), background: SURFACE }}
      >
        <div
          className="relative grid h-24 w-24 place-items-center rounded-xl border"
          style={{ borderColor: tint(ACCENT, 30) }}
        >
          <QrCode className="h-14 w-14" style={{ color: ACCENT }} />
          <span
            className="absolute inset-x-2 h-[2px] animate-[fzScan_2.2s_ease-in-out_infinite]"
            style={{ background: ACCENT, boxShadow: `0 0 12px ${tint(ACCENT, 70)}` }}
          />
        </div>
        <p className="mt-2 text-[10px]" style={{ color: INK_DIM }}>
          Leia o QR do cliente
        </p>
      </div>
      <div className="mt-3 space-y-2">
        <Row icon={BadgeCheck} title="Ana Souza · #3140" sub="Carimbo 8 de 10 registrado" tone={ACCENT} />
        <Row icon={Star} title="Avaliação 5 estrelas" sub="Enviada após o atendimento" tone={TONE_MAGENTA} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="Carimbos hoje" value="42" />
        <Metric label="Clientes ativos" value="318" />
      </div>
      <style>{`@keyframes fzScan{0%,100%{top:12%}50%{top:82%}}`}</style>
    </ScreenShell>
  );
}

function MenuScreen() {
  const dishes = useMemo(
    () => [
      { name: "Burger Trufado", desc: "Blend 180g, cheddar e trufa", price: "R$ 38,90", img: burgerImg.url },
      { name: "Pizza Nduja", desc: "Mussarela de búfala e nduja", price: "R$ 64,00", img: pizzaImg.url },
      { name: "Açaí 500g", desc: "Banana, granola e leite ninho", price: "R$ 24,50", img: acaiImg.url },
    ],
    [],
  );
  const [k, setK] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setK((v) => (v + 1) % dishes.length), 1700);
    return () => clearInterval(id);
  }, [dishes.length]);
  const d = dishes[k] ?? dishes[0];
  return (
    <ScreenShell sub="Cliente" title="Cardápio em stories">
      {/* o story é sempre uma foto escura — mantém texto branco em ambos os temas */}
      <div className="relative h-[190px] overflow-hidden rounded-2xl border" style={{ borderColor: LINE, background: "#0b0b0d" }}>
        {dishes.map((item, x) => (
          <img
            key={item.name}
            src={item.img}
            alt={item.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
            style={{ opacity: x === k ? 1 : 0 }}
          />
        ))}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,.28) 45%, rgba(0,0,0,.35) 100%)" }}
        />
        <div className="absolute inset-x-2 top-2 flex gap-1">
          {dishes.map((_, x) => (
            <span
              key={x}
              className="h-[3px] flex-1 rounded-full"
              style={{ background: x <= k ? "#fff" : "rgba(255,255,255,0.28)" }}
            />
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div
            className="text-sm font-bold"
            style={{ color: "#ffffff", textShadow: "0 1px 6px rgba(0,0,0,.75)" }}
          >
            {d.name}
          </div>
          <div
            className="text-[10px]"
            style={{ color: "rgba(255,255,255,.78)", textShadow: "0 1px 5px rgba(0,0,0,.7)" }}
          >
            {d.desc}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="rounded-lg px-2 py-1 text-[10px] font-bold"
              style={{ background: "#ffffff", color: "#0b0b0d" }}
            >
              {d.price}
            </span>
            <span
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold"
              style={{ border: "1px solid rgba(255,255,255,.28)", color: "#ffffff" }}
            >
              Detalhes <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Row icon={Stamp} title="Ganhe carimbo no pedido" sub="Cardápio conectado à fidelidade" tone={ACCENT} />
      </div>
    </ScreenShell>
  );
}

function Row({
  icon: Icon,
  title,
  sub,
  tone,
}: {
  icon: typeof Wallet;
  title: string;
  sub: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border p-2" style={{ borderColor: LINE, background: SURFACE }}>
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
        style={{ background: tint(tone, 14), color: tone }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold" style={{ color: INK }}>
          {title}
        </p>
        <p className="truncate text-[10px]" style={{ color: INK_FAINT }}>
          {sub}
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-2" style={{ borderColor: LINE, background: SURFACE }}>
      <p className="text-[9px] uppercase tracking-wider" style={{ color: INK_FAINT }}>
        {label}
      </p>
      <p className="text-lg font-bold" style={{ color: INK }}>
        {value}
      </p>
    </div>
  );
}

function CatalogScreen() {
  const products = [
    { name: "Fone Bluetooth", price: "R$ 189", hue: 210 },
    { name: "Kit Skincare", price: "R$ 129", hue: 340 },
    { name: "Tênis Runner", price: "R$ 299", hue: 150 },
    { name: "Relógio Smart", price: "R$ 459", hue: 45 },
  ];
  const [n, setN] = useState(1);
  useEffect(() => {
    const id = setTimeout(() => setN(2), 1200);
    return () => clearTimeout(id);
  }, []);
  return (
    <ScreenShell sub="Cliente" title="Catálogo digital">
      <div className="grid grid-cols-2 gap-2">
        {products.map((p) => (
          <div key={p.name} className="overflow-hidden rounded-xl border" style={{ borderColor: LINE, background: SURFACE }}>
            <div
              className="h-14 w-full"
              style={{
                background: `radial-gradient(110% 80% at 50% 20%, oklch(0.62 0.13 ${p.hue}), oklch(0.42 0.08 ${p.hue}) 78%)`,
              }}
            />
            <div className="p-1.5">
              <p className="truncate text-[10px] font-semibold" style={{ color: INK }}>
                {p.name}
              </p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] font-bold" style={{ color: ACCENT }}>
                  {p.price}
                </span>
                <span
                  className="grid h-5 w-5 place-items-center rounded-md"
                  style={{ background: tint(ACCENT, 14), color: ACCENT }}
                >
                  <ShoppingCart className="h-3 w-3" />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <Row icon={ShoppingCart} title={`Carrinho · ${n} itens`} sub="Enviar pedido pelo WhatsApp" tone={TONE_MAGENTA} />
      </div>
    </ScreenShell>
  );
}
