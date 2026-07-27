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
  DollarSign, Wallet, Megaphone, Cog, BookOpen, Menu, Star, Plug, Rocket, FileJson, KeyRound,
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
    key: "plataforma",
    label: "Plataforma",
    icon: Building2,
    items: [
      { to: "/admin/empresas", label: "Empresas", icon: Building2 },
      { to: "/admin/usuarios", label: "Usuários", icon: UsersRound },
      { to: "/admin/equipe", label: "Equipe", icon: Shield },
      { to: "/admin/suporte", label: "Suporte", icon: LifeBuoy },
      { to: "/admin/avaliacoes", label: "Avaliações", icon: Star },
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
    key: "comunicacao",
    label: "Comunicação",
    icon: Mail,
    items: [
      { to: "/admin/emails", label: "E-mail", icon: Mail, exact: true },
      { to: "/admin/email-templates", label: "Templates", icon: FileText },
      { to: "/admin/email-fila", label: "Fila de envio", icon: ListChecks },
      { to: "/admin/notificacoes", label: "Push", icon: Bell },
      { to: "/admin/alertas", label: "Alertas", icon: Megaphone },
      { to: "/admin/ajuda", label: "Central de Ajuda", icon: BookOpen },
    ],
  },
  {
    key: "sistema",
    label: "Sistema",
    icon: Cog,
    items: [
      { to: "/admin/integracoes", label: "Integrações", icon: Plug },
      { to: "/admin/liberacoes", label: "Liberações de recursos", icon: KeyRound },
      { to: "/admin/cardapio-jsonld", label: "JSON-LD do cardápio", icon: FileJson },
      { to: "/admin/auditoria", label: "Auditoria", icon: FileClock },
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

  const navItemClass = (active: boolean) =>
    [
      "flex items-center gap-3 rounded-xl px-3 h-10 text-sm font-medium transition-colors",
      active
        ? "bg-primary-soft text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    ].join(" ");

  const renderNav = (onNavigate?: () => void) => (
    <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-3">
      <div className="space-y-1">
        <Link to={OVERVIEW.to} onClick={onNavigate} className={navItemClass(isItemActive(OVERVIEW))}>
          <OVERVIEW.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
          <span className="truncate">{OVERVIEW.label}</span>
        </Link>
      </div>
      {NAV_GROUPS.map((g) => (
        <div key={g.key} className="space-y-1">
          <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
            {g.label}
          </div>
          {g.items.map((n) => (
            <Link key={n.to} to={n.to} onClick={onNavigate} className={navItemClass(isItemActive(n))}>
              <n.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              <span className="truncate">{n.label}</span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <TooltipProvider>
      <div className="min-h-screen dock-page-bg">
        {/* Desktop: sidebar padrão (ícone + nome) */}
        <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-border/60 bg-card/80 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-2 border-b border-border/60 px-3">
            <Link to="/admin" aria-label="Fidelize Admin" className="flex min-w-0 items-center gap-2">
              <LogoMark size={20} className="text-primary" />
              <span className="font-display text-sm font-bold">Fidelize</span>
            </Link>
            <span className="rounded bg-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              Admin
            </span>
          </div>

          {renderNav()}

          <div className="space-y-2 border-t border-border/60 p-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-muted-foreground">Tema</span>
              <ThemeToggle />
            </div>
            <Link
              to="/app"
              className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Painel do lojista
            </Link>
          </div>
        </aside>

        <div className="flex flex-col min-w-0 md:pl-64">

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
