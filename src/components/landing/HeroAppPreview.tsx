import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Gift,
  QrCode,
  Star,
  Stamp,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

const CYAN = "#00ffff";
const MAGENTA = "#d946ef";

type ScreenKey = "carteira" | "carimbar" | "cardapio";

const SCREENS: { key: ScreenKey; label: string; icon: typeof Wallet }[] = [
  { key: "carteira", label: "Carteira do cliente", icon: Wallet },
  { key: "carimbar", label: "Painel do lojista", icon: Stamp },
  { key: "cardapio", label: "Cardápio digital", icon: UtensilsCrossed },
];

const DURATION = 5200;

export function HeroAppPreview() {
  const [i, setI] = useState(0);
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const started = performance.now() - t * DURATION;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, paused]);

  const active = SCREENS[i]?.key ?? "carteira";

  return (
    <div
      className="relative w-full max-w-[380px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] blur-3xl"
        style={{
          background: `radial-gradient(60% 50% at 50% 25%, ${CYAN}22, transparent 70%), radial-gradient(50% 40% at 80% 80%, ${MAGENTA}1f, transparent 70%)`,
        }}
      />

      {/* device */}
      <div
        className="relative mx-auto aspect-[9/18.5] w-[280px] overflow-hidden rounded-[2.4rem] border p-2 shadow-2xl backdrop-blur"
        style={{
          borderColor: "rgba(255,255,255,0.14)",
          background: "linear-gradient(160deg, rgba(255,255,255,0.09), rgba(2,6,23,0.9))",
        }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-[#050b18]">
          <div className="absolute left-1/2 top-2 z-30 h-4 w-20 -translate-x-1/2 rounded-full bg-black/70" />
          <div className="relative h-full w-full">
            {active === "carteira" && <WalletScreen />}
            {active === "carimbar" && <MerchantScreen />}
            {active === "cardapio" && <MenuScreen />}
          </div>
        </div>
      </div>

      {/* floating real-time toast */}
      <div
        className="absolute -left-6 top-[30%] hidden w-[190px] rounded-xl border p-2.5 shadow-xl backdrop-blur lg:block"
        style={{ borderColor: `${CYAN}44`, background: "rgba(2,6,23,0.82)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
            style={{ background: `${CYAN}1f`, color: CYAN }}
          >
            <BadgeCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-white">Carimbo confirmado</p>
            <p className="truncate text-[10px] text-white/55">Ana · agora mesmo</p>
          </div>
        </div>
      </div>

      {/* floating metric */}
      <div
        className="absolute -right-3 bottom-[16%] hidden w-[170px] rounded-xl border p-3 shadow-xl backdrop-blur md:block"
        style={{ borderColor: "rgba(255,255,255,0.14)", background: "rgba(2,6,23,0.82)" }}
      >
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/50">
          <TrendingUp className="h-3 w-3" style={{ color: CYAN }} /> Retorno
        </div>
        <div className="mt-1 text-2xl font-bold text-white">+38%</div>
        <div className="mt-2 flex h-8 items-end gap-1">
          {[9, 13, 11, 17, 20, 24].map((h, k) => (
            <span
              key={k}
              className="flex-1 rounded-[2px]"
              style={{ height: `${h}px`, background: k === 5 ? CYAN : `${CYAN}55` }}
            />
          ))}
        </div>
      </div>

      {/* tabs / progress */}
      <div className="mx-auto mt-5 flex max-w-[300px] items-center justify-center gap-2">
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
              className="group relative flex-1 overflow-hidden rounded-lg border px-2 py-1.5 text-left transition-colors"
              style={{
                borderColor: on ? `${CYAN}66` : "rgba(255,255,255,0.12)",
                background: on ? `${CYAN}12` : "rgba(255,255,255,0.04)",
              }}
              aria-label={s.label}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0"
                style={{ width: on ? `${t * 100}%` : "0%", background: `${CYAN}14` }}
              />
              <span className="relative flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" style={{ color: on ? CYAN : "rgba(255,255,255,0.6)" }} />
                <span className={`truncate text-[10px] font-medium ${on ? "text-white" : "text-white/60"}`}>
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
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">{sub}</p>
        <h3 className="text-sm font-bold text-white">{title}</h3>
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
        style={{ borderColor: `${CYAN}33`, background: `linear-gradient(150deg, ${CYAN}14, rgba(255,255,255,0.03))` }}
      >
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold text-white">Café da Serra</div>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold"
            style={{ background: `${CYAN}22`, color: CYAN }}
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
                  borderColor: on ? `${CYAN}77` : "rgba(255,255,255,0.12)",
                  background: on ? `${CYAN}1f` : "rgba(255,255,255,0.03)",
                  boxShadow: on && k === filled - 1 ? `0 0 16px ${CYAN}66` : "none",
                }}
              >
                {on ? <Stamp className="h-3 w-3" style={{ color: CYAN }} /> : null}
              </span>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] text-white/60">
          <span>Faltam {Math.max(0, 10 - filled)} carimbos</span>
          <span style={{ color: CYAN }}>{filled}/10</span>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Row icon={Gift} title="Recompensa liberada" sub="1 café grátis · expira em 7 dias" tone={MAGENTA} />
        <Row icon={Bell} title="Notificação recebida" sub="Terça do combo: 2 carimbos" tone={CYAN} />
      </div>
    </ScreenShell>
  );
}

function MerchantScreen() {
  return (
    <ScreenShell sub="Lojista" title="Carimbar cliente">
      <div
        className="grid place-items-center rounded-2xl border py-4"
        style={{ borderColor: `${CYAN}33`, background: "rgba(255,255,255,0.03)" }}
      >
        <div className="relative grid h-24 w-24 place-items-center rounded-xl border" style={{ borderColor: `${CYAN}44` }}>
          <QrCode className="h-14 w-14" style={{ color: CYAN }} />
          <span
            className="absolute inset-x-2 h-[2px] animate-[fzScan_2.2s_ease-in-out_infinite]"
            style={{ background: CYAN, boxShadow: `0 0 12px ${CYAN}` }}
          />
        </div>
        <p className="mt-2 text-[10px] text-white/55">Leia o QR do cliente</p>
      </div>
      <div className="mt-3 space-y-2">
        <Row icon={BadgeCheck} title="Ana Souza · #3140" sub="Carimbo 8 de 10 registrado" tone={CYAN} />
        <Row icon={Star} title="Avaliação 5 estrelas" sub="Enviada após o atendimento" tone={MAGENTA} />
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
      { name: "Burger Trufado", price: "R$ 38,90", hue: 18 },
      { name: "Pizza Nduja", price: "R$ 64,00", hue: 8 },
      { name: "Açaí 500g", price: "R$ 24,50", hue: 285 },
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
      <div
        className="relative h-[190px] overflow-hidden rounded-2xl border transition-[background] duration-700"
        style={{
          borderColor: "rgba(255,255,255,0.12)",
          background: `radial-gradient(120% 80% at 50% 15%, oklch(0.45 0.16 ${d.hue}), oklch(0.16 0.03 ${d.hue}) 72%)`,
        }}
      >
        <div className="absolute inset-x-2 top-2 flex gap-1">
          {dishes.map((_, x) => (
            <span key={x} className="h-[3px] flex-1 rounded-full" style={{ background: x <= k ? "#fff" : "rgba(255,255,255,0.28)" }} />
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="text-sm font-bold text-white">{d.name}</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-black">{d.price}</span>
            <span className="flex items-center gap-1 rounded-lg border border-white/25 px-2 py-1 text-[10px] font-semibold text-white">
              Detalhes <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <Row icon={Stamp} title="Ganhe carimbo no pedido" sub="Cardápio conectado à fidelidade" tone={CYAN} />
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
    <div
      className="flex items-center gap-2 rounded-xl border p-2"
      style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${tone}1f`, color: tone }}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold text-white">{title}</p>
        <p className="truncate text-[10px] text-white/50">{sub}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-2" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
      <p className="text-[9px] uppercase tracking-wider text-white/45">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}
