import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard, Users, Stamp, QrCode, Sparkles, UsersRound,
  BookOpen, Package, Receipt, HeartHandshake, Bell, Star, LifeBuoy,
  ChevronRight, Search,
} from "lucide-react";
import { LogoMark } from "@/components/LogoMark";

export const Route = createFileRoute("/preview-dock")({
  component: PreviewDock,
  head: () => ({ meta: [{ title: "Preview · Dock lateral" }, { name: "robots", content: "noindex, nofollow" }] }),
});

type Item = { label: string; icon: any; active?: boolean; badge?: string | null };
type Group = { label: string; items: Item[] };
const GROUPS: Group[] = [
  {
    label: "Operação",
    items: [
      { label: "Painel", icon: LayoutDashboard, active: true, badge: null },
      { label: "Carimbar", icon: Stamp, badge: null },
      { label: "Clientes", icon: Users, badge: "128" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Campanhas", icon: Sparkles, badge: "3" },
      { label: "QR Codes", icon: QrCode },
      { label: "Retenção", icon: HeartHandshake },
      { label: "Avaliações", icon: Star, badge: "novo" },
      { label: "Notificações", icon: Bell, badge: "9" },
    ],
  },
  {
    label: "Conta",
    items: [
      { label: "Equipe", icon: UsersRound },
      { label: "Planos", icon: Package },
      { label: "Pagamentos", icon: Receipt },
    ],
  },
  {
    label: "Suporte",
    items: [
      { label: "Central de Ajuda", icon: BookOpen },
      { label: "Fale com a Fidelize", icon: LifeBuoy },
    ],
  },
];

/* =====================================================================
   A · Rail Glass Minimal — rail estreito com expansão hover
   ===================================================================== */
function DockA() {
  return (
    <aside
      className="group relative flex h-full flex-col overflow-hidden border-r border-white/[0.06] bg-[#0a1017] transition-[width] duration-300 ease-out"
      style={{ width: 268 }}
    >
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#0e1620] ring-1 ring-violet-400/40 shadow-[0_0_24px_-6px_rgba(167,139,250,0.5)]">
          <LogoMark className="h-5 w-5 text-violet-300" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold tracking-wide text-white">Fidelize</div>
          <div className="truncate text-[11px] text-white/40">Café do Bairro</div>
        </div>
      </div>
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-xs text-white/50">
        <Search className="h-3.5 w-3.5" /> Buscar
        <kbd className="ml-auto rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">⌘K</kbd>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {GROUPS.map((g) => (
          <div key={g.label} className="mb-4">
            <div className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-white/30">
              {g.label}
            </div>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = it.icon;
                return (
                  <li key={it.label}>
                    <button
                      className={[
                        "group/it relative flex w-full items-center gap-3 rounded-lg px-2 py-2 text-[13px] transition-all",
                        it.active
                          ? "bg-violet-400/[0.08] text-violet-100 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.18)]"
                          : "text-white/60 hover:bg-white/[0.03] hover:text-white",
                      ].join(" ")}
                    >
                      {it.active && (
                        <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-violet-300 shadow-[0_0_10px_rgba(167,139,250,0.9)]" />
                      )}
                      <span
                        className={[
                          "grid h-7 w-7 place-items-center rounded-md transition-all",
                          it.active
                            ? "bg-violet-400/10 text-violet-300 ring-1 ring-violet-400/30"
                            : "text-white/70 group-hover/it:bg-white/[0.04]",
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <span className="flex-1 text-left">{it.label}</span>
                      {it.badge && (
                        <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-200">
                          {it.badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.02] px-2 py-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-violet-400/10 text-xs font-semibold text-violet-200 ring-1 ring-violet-400/25">FI</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] text-white/85">Fidelize</div>
            <div className="text-[10px] text-white/40">Owner</div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-white/30" />
        </div>
      </div>
    </aside>
  );
}

/* =====================================================================
   B · Floating Dock macOS — dock destacado com halo cyan
   ===================================================================== */
function DockB() {
  return (
    <div className="relative h-full p-4">
      <div className="pointer-events-none absolute inset-4 rounded-[28px] bg-violet-400/10 blur-2xl" />
      <aside
        className="relative flex h-full w-[268px] flex-col overflow-hidden rounded-[24px] border border-violet-400/25 bg-[#0b1219]/95 backdrop-blur-xl"
        style={{ boxShadow: "0 0 0 1px rgba(167,139,250,0.08), 0 24px 60px -20px rgba(167,139,250,0.35), inset 0 1px 0 rgba(255,255,255,0.04)" }}
      >
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-b from-white/[0.06] to-transparent ring-1 ring-violet-300/40 shadow-[0_0_28px_-4px_rgba(167,139,250,0.6)]">
            <LogoMark className="h-5 w-5 text-violet-300" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white">Fidelize</div>
            <div className="truncate text-[11px] text-white/40">Café do Bairro</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {GROUPS.map((g) => (
            <div key={g.label} className="mb-4">
              <div className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-white/30">{g.label}</div>
              <ul className="space-y-1">
                {g.items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <li key={it.label}>
                      <button
                        className={[
                          "relative flex w-full items-center gap-3 rounded-xl px-2 py-2 text-[13px] transition-all duration-200 hover:scale-[1.02]",
                          it.active
                            ? "bg-gradient-to-r from-violet-400/[0.14] to-transparent text-white"
                            : "text-white/65 hover:bg-white/[0.03] hover:text-white",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "grid h-9 w-9 place-items-center rounded-xl transition-all",
                            it.active
                              ? "bg-violet-400/15 text-violet-200 ring-1 ring-violet-300/50 shadow-[0_0_18px_-2px_rgba(167,139,250,0.6)]"
                              : "bg-white/[0.03] text-white/75 ring-1 ring-white/[0.05] hover:ring-violet-300/30",
                          ].join(" ")}
                        >
                          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                        </span>
                        <span className="flex-1 text-left">{it.label}</span>
                        {it.badge && (
                          <span className="rounded-full bg-violet-300/15 px-2 py-0.5 text-[10px] font-medium text-violet-200 ring-1 ring-violet-300/30">{it.badge}</span>
                        )}
                        {it.active && (
                          <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-violet-300/25" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.02] px-2 py-2 ring-1 ring-white/[0.04]">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-400/10 text-xs font-semibold text-violet-200 ring-1 ring-violet-300/30">FI</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] text-white/85">Fidelize</div>
              <div className="text-[10px] text-white/40">Owner</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* =====================================================================
   C · Command Rail Pro — molduras neon quadradas, LED, accordion
   ===================================================================== */
function DockC() {
  const [open, setOpen] = useState<Record<string, boolean>>({
    Operação: true, Marketing: true, Conta: false, Suporte: false,
  });
  return (
    <aside className="relative flex h-full w-[288px] flex-col overflow-hidden border-r border-violet-400/15 bg-[#080d13]">
      <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-violet-400/40 to-transparent" />
      <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-white/[0.05]">
        <div className="relative grid h-11 w-11 place-items-center rounded-lg bg-[#0d151d] ring-1 ring-violet-400/40">
          <LogoMark className="h-5 w-5 text-violet-300" />
          <span className="absolute inset-0 rounded-lg ring-1 ring-violet-300/20 shadow-[0_0_18px_-2px_rgba(167,139,250,0.55)]" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold tracking-wide text-white">FIDELIZE</div>
          <div className="truncate text-[11px] text-violet-300/70">v2.0 · Pro</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {GROUPS.map((g) => {
          const isOpen = open[g.label];
          return (
            <div key={g.label} className="mb-1.5">
              <button
                onClick={() => setOpen((s) => ({ ...s, [g.label]: !s[g.label] }))}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40 hover:text-violet-200"
              >
                <span className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-violet-300 shadow-[0_0_6px_rgba(167,139,250,0.9)]" />
                  {g.label}
                </span>
                <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
              </button>
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <ul className="overflow-hidden space-y-1 pt-1">
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    return (
                      <li key={it.label}>
                        <button
                          className={[
                            "group/it relative flex w-full items-center gap-3 overflow-hidden rounded-lg px-2 py-2 text-[13px] transition-all",
                            it.active
                              ? "bg-[linear-gradient(90deg,rgba(167,139,250,0.10),rgba(167,139,250,0)_60%)] text-white"
                              : "text-white/60 hover:bg-white/[0.03] hover:text-white",
                          ].join(" ")}
                        >
                          {it.active && (
                            <span className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-violet-300/25">
                              <span className="dock-c-led absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-violet-300/40 to-transparent" />
                            </span>
                          )}
                          <span
                            className={[
                              "grid h-8 w-8 place-items-center rounded-md transition-all",
                              it.active
                                ? "bg-violet-400/15 text-violet-200 ring-1 ring-violet-300/40 shadow-[0_0_14px_-2px_rgba(167,139,250,0.6)]"
                                : "bg-white/[0.03] text-white/70 ring-1 ring-white/[0.05] group-hover/it:ring-violet-300/25",
                            ].join(" ")}
                          >
                            <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
                          </span>
                          <span className="relative z-[1] flex-1 text-left">{it.label}</span>
                          {it.badge && (
                            <span className="relative z-[1] rounded-md bg-violet-400/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-violet-200 ring-1 ring-violet-300/25">{it.badge}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/[0.05] p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-[#0d151d] px-2 py-2 ring-1 ring-violet-400/15">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-violet-400/10 text-xs font-mono font-semibold text-violet-200 ring-1 ring-violet-300/30">FI</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] text-white/85">Fidelize</div>
            <div className="text-[10px] text-violet-300/60">● online</div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes dock-c-led-sweep {
          0% { transform: translateX(-40%); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(360%); opacity: 0; }
        }
        .dock-c-led { animation: dock-c-led-sweep 5.5s ease-in-out infinite; }
      `}</style>
    </aside>
  );
}

/* ===================================================================== */

function PreviewDock() {
  const cards = [
    { id: "A", title: "Rail Glass Minimal", desc: "Rail limpo com hairline cyan no ativo. Expande no hover. Estilo Vercel/Arc.", node: <DockA /> },
    { id: "B", title: "Floating Dock macOS", desc: "Dock destacado com halo cyan fixo. Ícones ampliam no hover. Cinematográfico.", node: <DockB /> },
    { id: "C", title: "Command Rail Pro", desc: "Molduras neon, LED cyan percorrendo o ativo, grupos em accordion. Denso e pro (Linear).", node: <DockC /> },
  ];
  return (
    <div className="min-h-screen bg-[#050810] text-white">
      <div className="mx-auto max-w-[1400px] px-6 py-10">
        <header className="mb-8">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-violet-300/70">Preview · Sidebar Dock</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Escolha a direção do menu lateral</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/50">Três direções com menu expandido, ícones premium e animação leve. Clique em uma para eu implementar no painel logista e admin.</p>
        </header>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {cards.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a1017]">
              <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-violet-300/70">Opção {c.id}</div>
                  <div className="mt-1 text-base font-semibold text-white">{c.title}</div>
                </div>
                <span className="rounded-md bg-violet-400/10 px-2 py-1 text-[10px] font-medium text-violet-200 ring-1 ring-violet-300/25">Expandido</span>
              </div>
              <div className="h-[720px] overflow-hidden bg-[#060a10]">
                {c.node}
              </div>
              <div className="border-t border-white/[0.05] px-5 py-4 text-xs text-white/55">{c.desc}</div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-white/40">Me diga: <span className="text-violet-300">A</span>, <span className="text-violet-300">B</span> ou <span className="text-violet-300">C</span> — implemento no painel completo.</p>
      </div>
    </div>
  );
}
