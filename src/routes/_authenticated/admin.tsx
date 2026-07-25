import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getAdminStatus, bootstrapSuperAdmin } from "@/lib/admin.functions";
import { Logo } from "@/components/Logo";
import { LogoMark } from "@/components/LogoMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Shield, LayoutDashboard, Building2, CreditCard, ArrowLeft, Bell, FileClock, Wallet2,
  UsersRound, Settings, Mail, FileText, ListChecks, LifeBuoy, Package,
  DollarSign, Wallet, Megaphone, Cog, BookOpen, Menu, Star, Plug, Rocket, FileJson,
} from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

type NavItem = { to: string; label: string; icon: any; exact?: boolean };
type NavGroup = { key: string; label: string; icon: any; items: NavItem[] };

const OVERVIEW: NavItem = { to: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true };

const NAV_GROUPS: NavGroup[] = [
  {
    key: "empresas",
    label: "Empresas",
    icon: Building2,
    items: [
      { to: "/admin/empresas", label: "Empresas", icon: Building2 },
      { to: "/admin/usuarios", label: "Usuários", icon: UsersRound },
      { to: "/admin/equipe", label: "Equipe", icon: UsersRound },
    ],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    icon: Wallet,
    items: [
      { to: "/admin/financeiro", label: "Financeiro", icon: DollarSign },
      { to: "/admin/assinaturas", label: "Assinaturas", icon: CreditCard },
      { to: "/admin/planos", label: "Planos", icon: Package },
      { to: "/admin/pagamentos", label: "Mercado Pago", icon: CreditCard },
    ],
  },
  {
    key: "operacao",
    label: "Operação",
    icon: Megaphone,
    items: [
      { to: "/admin/alertas", label: "Alertas", icon: Bell },
      { to: "/admin/avaliacoes", label: "Avaliações", icon: Star },
      { to: "/admin/auditoria", label: "Auditoria", icon: FileClock },
      { to: "/admin/suporte", label: "Suporte", icon: LifeBuoy },
    ],
  },
  {
    key: "comunicacao",
    label: "Comunicação",
    icon: Mail,
    items: [
      { to: "/admin/emails", label: "E-mail", icon: Mail, exact: true },
      { to: "/admin/email-templates", label: "Templates", icon: FileText },
      { to: "/admin/email-fila", label: "Fila de envio", icon: ListChecks },
      { to: "/admin/notificacoes", label: "Push", icon: Bell },
      { to: "/admin/ajuda", label: "Central de Ajuda", icon: BookOpen },
    ],
  },
  {
    key: "sistema",
    label: "Sistema",
    icon: Cog,
    items: [
      { to: "/admin/integracoes", label: "Integrações", icon: Plug },
      { to: "/admin/cardapio-jsonld", label: "JSON-LD do cardápio", icon: FileJson },
      { to: "/admin/migracao", label: "Migração & Downloads", icon: Rocket },
      { to: "/admin/config", label: "Configurações", icon: Settings },
    ],
  },
];

function AdminLayout() {
  const navigate = useNavigate();
  const getStatus = useServerFn(getAdminStatus);
  const bootstrap = useServerFn(bootstrapSuperAdmin);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-status"], queryFn: () => getStatus() });
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pinnedGroup, setPinnedGroup] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openGroup = (key: string) => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    setPinnedGroup(key);
  };
  const scheduleCloseGroup = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setPinnedGroup(null), 180);
  };
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);
  useEffect(() => { setPinnedGroup(null); }, [pathname]);

  if (isLoading) return <div className="grid min-h-dvh place-items-center text-muted-foreground">Verificando permissões…</div>;

  if (!data?.isAdmin) {
    return (
      <div className="min-h-dvh grid place-items-center bg-muted/30 px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Shield className="h-7 w-7" /></div>
            <h1 className="font-display text-2xl font-bold">Painel do Administrador</h1>
            <p className="text-sm text-muted-foreground">Esta área é restrita aos administradores da plataforma Fidelize.</p>
            {data?.canBootstrap ? (
              <>
                <p className="text-sm">Nenhum administrador cadastrado ainda. Você pode assumir este papel agora — como primeiro usuário.</p>
                <Button className="w-full gradient-brand text-primary-foreground" onClick={async () => {
                  try { await bootstrap(); toast.success("Você agora é administrador da plataforma."); refetch(); }
                  catch (e: any) { toast.error(e.message ?? "Falha ao promover"); }
                }}>Tornar-me administrador</Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Solicite acesso ao administrador atual.</p>
            )}
            <Button variant="ghost" className="w-full" onClick={() => navigate({ to: "/app" })}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isItemActive = (n: NavItem) => (n.exact ? pathname === n.to : pathname.startsWith(n.to));
  const allItems: NavItem[] = [OVERVIEW, ...NAV_GROUPS.flatMap((g) => g.items)];
  const activeNav = allItems.find(isItemActive) ?? OVERVIEW;

  const closeMobile = () => setMobileOpen(false);

  const renderMobileNav = (onNavigate?: () => void) => (
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {(() => {
        const active = isItemActive(OVERVIEW);
        return (
          <Link to={OVERVIEW.to} onClick={onNavigate} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted"}`}>
            <OVERVIEW.icon className="h-4 w-4" /> {OVERVIEW.label}
          </Link>
        );
      })()}
      {NAV_GROUPS.map((g) => {
        const hasActive = g.items.some(isItemActive);
        return (
          <div key={g.key} className="pt-2">
            <div className={`flex items-center gap-3 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${hasActive ? "text-primary" : "text-muted-foreground"}`}>
              <g.icon className="h-3.5 w-3.5" />
              <span className="flex-1">{g.label}</span>
            </div>
            <div className="mt-1 ml-3 pl-3 border-l space-y-1">
              {g.items.map((n) => {
                const active = isItemActive(n);
                return (
                  <Link key={n.to} to={n.to} onClick={onNavigate} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-primary-soft text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}>
                    <n.icon className="h-4 w-4" /> {n.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  return (
    <TooltipProvider>
      <div className="min-h-screen dock-page-bg">
        {/* Desktop: floating dock */}
        <aside className="dock-surface hidden md:flex fixed left-4 top-1/2 -translate-y-1/2 z-30 flex-col items-center gap-1.5 rounded-2xl p-2 backdrop-blur-xl">
          <Link
            to="/admin"
            className="dock-logo dock-logo-bg relative mb-1 grid h-12 w-12 place-items-center rounded-full"
            aria-label="Fidelize Admin"
          >
            <span aria-hidden className="dock-logo-led" />
            <span aria-hidden className="dock-logo-halo" />
            <LogoMark size={22} className="relative z-10 text-[color:var(--color-primary)]" />
          </Link>

          {/* Overview quick-link */}
          {(() => {
            const active = isItemActive(OVERVIEW);
            return (
              <Link
                to={OVERVIEW.to}
                aria-label={OVERVIEW.label}
                className={[
                  "relative grid h-11 w-11 place-items-center rounded-xl transition-all duration-200 group/dock",
                  active ? "dock-item-active" : "dock-item",
                ].join(" ")}
              >
                <OVERVIEW.icon className="h-[19px] w-[19px]" strokeWidth={1.8} />
                <span className="dock-tooltip pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium opacity-0 transition-opacity group-hover/dock:opacity-100">
                  {OVERVIEW.label}
                </span>
              </Link>
            );
          })()}

          {NAV_GROUPS.map((g) => {
            const Icon = g.icon;
            const isActive = g.items.some(isItemActive);
            const isOpen = pinnedGroup === g.key;
            return (
              <div
                key={g.key}
                className="group/dock relative"
                onMouseEnter={() => openGroup(g.key)}
                onMouseLeave={scheduleCloseGroup}
              >
                <button
                  type="button"
                  aria-label={g.label}
                  aria-expanded={isOpen}
                  onClick={() => (isOpen ? setPinnedGroup(null) : openGroup(g.key))}
                  className={[
                    "relative grid h-11 w-11 place-items-center rounded-xl transition-all duration-200",
                    isActive || isOpen ? "dock-item-active" : "dock-item",
                  ].join(" ")}
                >
                  <Icon className="h-[19px] w-[19px]" strokeWidth={1.8} />
                </button>

                <div
                  className={[
                    "absolute left-full top-0 pl-3 origin-left transition-all duration-200",
                    isOpen ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
                  ].join(" ")}
                  onMouseEnter={() => openGroup(g.key)}
                  onMouseLeave={scheduleCloseGroup}
                >
                  <div className="dock-flyout min-w-[240px] rounded-2xl p-2 backdrop-blur-xl">
                    <div className="dock-flyout-title px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
                      {g.label}
                    </div>
                    <ul className="space-y-0.5">
                      {g.items.map((n) => {
                        const active = isItemActive(n);
                        const ItemIcon = n.icon;
                        return (
                          <li key={n.to}>
                            <Link
                              to={n.to}
                              onClick={() => setPinnedGroup(null)}
                              className={[
                                "flex items-center gap-3 rounded-xl px-2 py-2 text-[13px] transition-all",
                                active ? "dock-flyout-item-active" : "dock-flyout-item",
                              ].join(" ")}
                            >
                              <span
                                className={[
                                  "grid h-8 w-8 place-items-center rounded-lg transition-all",
                                  active ? "dock-item-active" : "dock-item",
                                ].join(" ")}
                              >
                                <ItemIcon className="h-[17px] w-[17px]" strokeWidth={1.8} />
                              </span>
                              <span className="flex-1">{n.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                {!isOpen && (
                  <span className="dock-tooltip pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium opacity-0 transition-opacity group-hover/dock:opacity-100">
                    {g.label}
                  </span>
                )}
              </div>
            );
          })}

          <div className="dock-divider my-1 h-px w-8" />

          <div className="grid place-items-center">
            <ThemeToggle />
          </div>
          <Link
            to="/app"
            aria-label="Voltar ao painel do lojista"
            className="dock-item group/dock relative grid h-11 w-11 place-items-center rounded-xl transition-all"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
            <span className="dock-tooltip pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium opacity-0 transition-opacity group-hover/dock:opacity-100">
              Painel do lojista
            </span>
          </Link>
        </aside>

        <div className="flex flex-col min-w-0 md:pl-24">
          {/* Top bar */}
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 h-14 px-4 md:px-6 border-b bg-card/70 backdrop-blur-xl">
            <div className="flex items-center gap-3 min-w-0">
              <div className="md:hidden">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label="Abrir menu"><Menu className="h-5 w-5" /></Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-72 flex flex-col">
                    <VisuallyHidden><SheetTitle>Menu de navegação</SheetTitle></VisuallyHidden>
                    <div className="p-5 border-b flex items-center gap-2">
                      <Logo />
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-soft text-primary">Admin</span>
                    </div>
                    {renderMobileNav(closeMobile)}
                    <div className="p-3 border-t space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs text-muted-foreground">Tema</span>
                        <ThemeToggle />
                      </div>
                      <Link to="/app" onClick={closeMobile} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-3 w-3" /> Voltar ao painel do lojista
                      </Link>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              <div className="md:hidden flex items-center gap-2">
                <Logo />
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-soft text-primary">Admin</span>
              </div>

              <div className="hidden md:flex items-center gap-2 min-w-0">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Fidelize</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-soft text-primary">Admin</span>
                <span className="text-muted-foreground/40">/</span>
                <AnimatePresence mode="wait">
                  <motion.h1
                    key={activeNav.to}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="font-display text-sm font-semibold truncate"
                  >
                    {activeNav.label}
                  </motion.h1>
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/carteira"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-primary-soft hover:text-primary transition-colors"
                aria-label="Abrir painel /carteira em nova aba"
                title="Ver painel do cliente final"
              >
                <Wallet2 className="h-3.5 w-3.5" />
                Ver /carteira
              </a>
              <div className="hidden md:block"><ThemeToggle /></div>
            </div>
          </header>

          <main className="flex-1 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="px-4 py-5 md:px-6 md:py-7 max-w-[1400px] w-full mx-auto"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
