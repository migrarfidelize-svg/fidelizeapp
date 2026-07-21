import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { getAdminStatus } from "@/lib/admin.functions";
import { checkMyFeature } from "@/lib/plans.functions";
import { Logo } from "@/components/Logo";
import { LogoMark } from "@/components/LogoMark";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, Stamp, QrCode, LogOut, Sparkles, ChevronDown, UsersRound, Shield,
  LifeBuoy, BookOpen, Package, Receipt, HeartHandshake, Bell, Star, Menu,
  PanelLeftClose, PanelLeftOpen, Search,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GuidedTour, type TourStep } from "@/components/GuidedTour";
import { ThemeToggle } from "@/components/ThemeToggle";

const MERCHANT_TOUR_STEPS: TourStep[] = [
  { target: "[data-tour='sidebar-logo']", title: "Bem-vindo à Fidelize!", description: "Vamos dar um tour rápido pelas áreas essenciais da plataforma. Leva menos de 1 minuto.", placement: "center" },
  { target: "[data-tour='nav-/app']", title: "Painel", description: "Acompanhe carimbos, clientes ativos, recompensas resgatadas e sua meta do mês em tempo real.", placement: "right" },
  { target: "[data-tour='nav-/app/carimbar']", title: "Carimbar cliente", description: "Adicione carimbos por busca, leitura de QR Code do voucher ou câmera. É o coração operacional do dia a dia.", placement: "right" },
  { target: "[data-tour='nav-/app/clientes']", title: "Base de clientes", description: "Todos os seus clientes fidelizados com filtros, importação em CSV e histórico de visitas.", placement: "right" },
  { target: "[data-tour='nav-/app/campanhas']", title: "Campanhas", description: "Crie e personalize seus cartões: quantos carimbos, qual recompensa, ícones e cores.", placement: "right" },
  { target: "[data-tour='nav-/app/qrcodes']", title: "Divulgação", description: "Gere materiais prontos para Instagram, Story e balcão. Baixe em alta resolução.", placement: "right" },
  { target: "[data-tour='nav-/app/planos']", title: "Planos", description: "Acompanhe o uso do seu plano e faça upgrade quando precisar de mais recursos.", placement: "right" },
];

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

type NavItem = { to: string; label: string; icon: any; exact?: boolean };
type NavGroup = { key: string; label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    key: "operacao",
    label: "Operação",
    items: [
      { to: "/app", label: "Painel", icon: LayoutDashboard, exact: true },
      { to: "/app/carimbar", label: "Carimbar", icon: Stamp },
      { to: "/app/clientes", label: "Clientes", icon: Users },
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    items: [
      { to: "/app/campanhas", label: "Campanhas", icon: Sparkles },
      { to: "/app/qrcodes", label: "QR Codes", icon: QrCode },
      { to: "/app/retencao", label: "Retenção", icon: HeartHandshake },
      { to: "/app/avaliacoes", label: "Avaliações", icon: Star },
      { to: "/app/notificacoes", label: "Notificações", icon: Bell },
    ],
  },
  {
    key: "conta",
    label: "Conta",
    items: [
      { to: "/app/equipe", label: "Equipe", icon: UsersRound },
      { to: "/app/planos", label: "Planos", icon: Package },
      { to: "/app/pagamentos", label: "Pagamentos", icon: Receipt },
    ],
  },
  {
    key: "ajuda",
    label: "Suporte",
    items: [
      { to: "/app/kb", label: "Central de Ajuda", icon: BookOpen },
      { to: "/app/suporte", label: "Fale com a Fidelize", icon: LifeBuoy },
    ],
  },
];

const FLAT_NAV = NAV_GROUPS.flatMap((g) => g.items);

function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getEsts = useServerFn(getMyEstablishments);
  const getAdmin = useServerFn(getAdminStatus);
  const { data: memberships, isLoading } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const { data: adminStatus } = useQuery({ queryKey: ["admin-status"], queryFn: () => getAdmin() });
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem("fidelize_sidebar_collapsed");
      if (v === "1") setCollapsed(true);
    } catch { /* noop */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("fidelize_sidebar_collapsed", collapsed ? "1" : "0"); } catch { /* noop */ }
  }, [collapsed]);

  const { data: unreadSupport = 0 } = useQuery({
    queryKey: ["support-unread"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return 0;
      const { count } = await supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("requester_user_id", u.user.id)
        .eq("has_unread_customer", true);
      return count ?? 0;
    },
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      userId = u.user?.id ?? null;
      if (!userId) return;
      channel = supabase
        .channel("support-customer-notify")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "support_tickets", filter: `requester_user_id=eq.${userId}` },
          (payload) => {
            const n = payload.new as { has_unread_customer?: boolean; protocol?: string; subject?: string };
            if (n.has_unread_customer) {
              toast.message("Nova resposta do suporte", {
                description: `${n.protocol ?? ""} — ${n.subject ?? ""}`.trim(),
                action: { label: "Ver", onClick: () => navigate({ to: "/suporte" }) },
              });
              queryClient.invalidateQueries({ queryKey: ["support-unread"] });
              queryClient.invalidateQueries({ queryKey: ["my-support-tickets"] });
            }
          },
        )
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [navigate, queryClient]);

  const activeEstEarly = memberships?.[0]?.establishment as { id: string } | undefined;
  const activeEstId = activeEstEarly?.id;
  const lastAllowedRef = useRef<boolean | null>(null);
  const checkFeatureFn = useServerFn(checkMyFeature);
  useEffect(() => {
    if (!activeEstId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;

    async function refresh(reason: "init" | "plan_features" | "establishment") {
      const res = await checkFeatureFn({ data: { establishment_id: activeEstId!, feature_key: "public_reviews" } }).catch(() => null);
      if (cancelled || !res) return;
      const allowed = !!res.allowed;
      const prev = lastAllowedRef.current;
      lastAllowedRef.current = allowed;
      queryClient.invalidateQueries({ queryKey: ["feature", activeEstId, "public_reviews"] });
      if (prev === null || prev === allowed || reason === "init") return;
      if (allowed) {
        toast.success("Avaliações públicas foram HABILITADAS na sua conta 🎉", {
          duration: 12000,
          description: "Você já pode criar QR Codes de avaliação e coletar CSAT dos clientes.",
          action: { label: "Abrir Avaliações", onClick: () => navigate({ to: "/app/avaliacoes" }) },
        });
      } else {
        toast.warning("Avaliações públicas foram DESABILITADAS na sua conta", {
          duration: 12000,
          description: "QRs já existentes continuam salvos. Faça upgrade para reativar.",
          action: { label: "Ver planos", onClick: () => navigate({ to: "/app/planos" }) },
        });
      }
    }

    refresh("init");
    ch = supabase
      .channel(`feature-gate-${activeEstId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_features", filter: "feature_key=eq.public_reviews" }, () => refresh("plan_features"))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "establishments", filter: `id=eq.${activeEstId}` }, () => refresh("establishment"))
      .subscribe();

    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [activeEstId, checkFeatureFn, navigate, queryClient]);

  const activeEst = memberships?.[0]?.establishment as { id: string; name: string; slug: string; logo_url: string | null } | undefined;

  if (isLoading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Carregando…</div>;
  if (!memberships?.length) {
    if (typeof window !== "undefined" && !pathname.startsWith("/onboarding")) {
      navigate({ to: "/onboarding" });
    }
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Configurando sua empresa…</div>;
  }

  const isItemActive = (n: NavItem) => (n.exact ? pathname === n.to : pathname.startsWith(n.to));
  const activeNav = FLAT_NAV.find((n) => (n.exact ? pathname === n.to : pathname.startsWith(n.to))) ?? FLAT_NAV[0];

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const renderNavItem = (n: NavItem, onNavigate?: () => void, forceExpanded = false) => {
    const active = isItemActive(n);
    const badge = n.to === "/app/suporte" && unreadSupport > 0 ? unreadSupport : 0;
    const showLabel = forceExpanded || !collapsed;
    const inner = (
      <Link
        to={n.to}
        data-tour={`nav-${n.to}`}
        onClick={onNavigate}
        className={[
          "group relative flex items-center gap-3 rounded-xl h-10 text-sm font-medium transition-colors",
          showLabel ? "px-3" : "px-0 justify-center",
          active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
      >
        {active && (
          <motion.span
            layoutId="active-nav-pill"
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="nav-item-active-aurora"
          />
        )}
        <span className="relative z-10 grid place-items-center h-8 w-8 shrink-0">
          <n.icon
            className={`h-[18px] w-[18px] ${active ? "nav-icon-active" : "nav-icon-idle"}`}
            strokeWidth={active ? 2.4 : 1.8}
          />
        </span>
        <AnimatePresence initial={false}>
          {showLabel && (
            <motion.span
              key="label"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.18 }}
              className="relative z-10 flex-1 whitespace-nowrap"
            >
              {n.label}
            </motion.span>
          )}
        </AnimatePresence>
        {badge > 0 && showLabel && (
          <span className="relative z-10 inline-flex min-w-[20px] h-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
        {badge > 0 && !showLabel && (
          <span className="absolute top-1 right-1 z-10 h-2 w-2 rounded-full bg-accent ring-2 ring-card" />
        )}
      </Link>
    );
    if (!showLabel) {
      return (
        <Tooltip key={n.to} delayDuration={100}>
          <TooltipTrigger asChild>{inner}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">{n.label}</TooltipContent>
        </Tooltip>
      );
    }
    return <div key={n.to}>{inner}</div>;
  };

  const renderNav = (onNavigate?: () => void, forceExpanded = false) => (
    <LayoutGroup id="sidebar-nav">
      <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map((g) => (
          <div key={g.key} className="space-y-1">
            <AnimatePresence initial={false}>
              {(forceExpanded || !collapsed) && (
                <motion.div
                  key="grouplabel"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70"
                >
                  {g.label}
                </motion.div>
              )}
            </AnimatePresence>
            {g.items.map((n) => renderNavItem(n, onNavigate, forceExpanded))}
          </div>
        ))}
      </nav>
    </LayoutGroup>
  );

  const renderFooter = (onNavigate?: () => void, forceExpanded = false) => {
    const showLabel = forceExpanded || !collapsed;
    return (
      <div className={`border-t ${showLabel ? "p-3" : "p-2"} space-y-2`}>
        <div className={`flex items-center ${showLabel ? "justify-between px-1" : "justify-center"}`}>
          {showLabel && <span className="text-xs text-muted-foreground">Tema</span>}
          <ThemeToggle />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={`w-full ${showLabel ? "justify-between" : "justify-center px-0"} h-11`}>
              <span className={`grid place-items-center h-8 w-8 rounded-lg bg-primary/15 text-primary text-[11px] font-bold shrink-0`}>
                {activeEst?.name?.slice(0, 2).toUpperCase() ?? "FZ"}
              </span>
              {showLabel && (
                <>
                  <span className="truncate text-sm flex-1 text-left ml-2">{activeEst?.name}</span>
                  <ChevronDown className="h-4 w-4" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild><Link to="/l/$slug" params={{ slug: activeEst!.slug }} onClick={onNavigate}>Ver página pública</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/lgpd" onClick={onNavigate}><Shield className="mr-2 h-4 w-4" />Meus Dados (LGPD)</Link></DropdownMenuItem>
            {adminStatus?.isAdmin && (
              <DropdownMenuItem asChild><Link to="/admin" onClick={onNavigate}><Shield className="mr-2 h-4 w-4" />Painel do administrador</Link></DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { onNavigate?.(); signOut(); }}><LogOut className="mr-2 h-4 w-4" />Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const closeMobile = () => setMobileOpen(false);
  const sidebarWidth = collapsed ? 76 : 264;

  return (
    <TooltipProvider>
      <div className="min-h-screen flex bg-[color-mix(in_oklab,var(--color-background)_92%,var(--color-primary)_4%)]">
        {/* Desktop sidebar */}
        <motion.aside
          animate={{ width: sidebarWidth }}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
          className="hidden md:flex shrink-0 flex-col border-r bg-card/80 backdrop-blur-xl relative"
        >
          <div className={`flex items-center border-b ${collapsed ? "justify-center p-3" : "justify-between p-4"}`} data-tour="sidebar-logo">
            {collapsed ? <LogoMark size={38} /> : <Logo />}
          </div>
          {renderNav()}
          {renderFooter()}

          {/* Expand/collapse toggle — destaque com anel aurora */}
          <button
            type="button"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            onClick={() => setCollapsed((c) => !c)}
            className="sidebar-toggle group"
          >
            <motion.span
              animate={{ rotate: collapsed ? 0 : 180 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="relative"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </motion.span>
          </button>
        </motion.aside>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar (desktop + mobile) */}
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 h-14 px-4 md:px-6 border-b bg-card/70 backdrop-blur-xl">
            <div className="flex items-center gap-3 min-w-0">
              {/* Mobile trigger */}
              <div className="md:hidden">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label="Abrir menu"><Menu className="h-5 w-5" /></Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-72 flex flex-col">
                    <VisuallyHidden><SheetTitle>Menu de navegação</SheetTitle></VisuallyHidden>
                    <div className="p-4 border-b"><Logo /></div>
                    {renderNav(closeMobile, true)}
                    {renderFooter(closeMobile, true)}
                  </SheetContent>
                </Sheet>
              </div>
              <div className="md:hidden"><Logo /></div>

              {/* Breadcrumb / page title (desktop) */}
              <div className="hidden md:flex items-center gap-2 min-w-0">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Fidelize</span>
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
              <Button variant="ghost" size="sm" className="hidden lg:inline-flex text-muted-foreground gap-2 h-9">
                <Search className="h-4 w-4" />
                <span className="text-xs">Buscar</span>
                <kbd className="ml-2 rounded border bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
              </Button>
              <div className="hidden md:block"><ThemeToggle /></div>
            </div>
          </header>

          {/* Main with page transition */}
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

        <GuidedTour steps={MERCHANT_TOUR_STEPS} storageKey={`fidelize_tour_v1_${activeEst?.id ?? "user"}`} />
      </div>
    </TooltipProvider>
  );
}
