import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Menu } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { getAdminStatus } from "@/lib/admin.functions";
import { checkMyFeature } from "@/lib/plans.functions";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Stamp, QrCode, LogOut, Sparkles, ChevronDown, UsersRound, Shield, LifeBuoy, BookOpen, Package, Receipt, HeartHandshake, Bell, Star } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
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

function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getEsts = useServerFn(getMyEstablishments);
  const getAdmin = useServerFn(getAdminStatus);
  const { data: memberships, isLoading } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const { data: adminStatus } = useQuery({ queryKey: ["admin-status"], queryFn: () => getAdmin() });
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Unread support replies from Fidelize admin
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

  // Real-time: public_reviews feature flip toast for the merchant
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
          description: "Você já pode criar QR Codes de avaliação e coletar CSAT dos clientes. O gate no gerador e no backend foi liberado.",
          action: { label: "Abrir Avaliações", onClick: () => navigate({ to: "/app/avaliacoes" }) },
        });
      } else {
        toast.warning("Avaliações públicas foram DESABILITADAS na sua conta", {
          duration: 12000,
          description: "QRs já existentes continuam salvos, mas a criação de novos QRs de avaliação e o acesso à página foram bloqueados. Faça upgrade para reativar.",
          action: { label: "Ver planos", onClick: () => navigate({ to: "/app/planos" }) },
        });
      }
    }

    refresh("init");

    ch = supabase
      .channel(`feature-gate-${activeEstId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plan_features", filter: "feature_key=eq.public_reviews" },
        () => refresh("plan_features"),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "establishments", filter: `id=eq.${activeEstId}` },
        () => refresh("establishment"),
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (ch) supabase.removeChannel(ch);
    };
  }, [activeEstId, checkFeatureFn, navigate, queryClient]);


  const activeEst = memberships?.[0]?.establishment as { id: string; name: string; slug: string; logo_url: string | null } | undefined;

  if (isLoading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Carregando…</div>;
  if (!memberships?.length) {
    if (typeof window !== "undefined" && !pathname.startsWith("/onboarding")) {
      navigate({ to: "/onboarding" });
    }
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Configurando sua empresa…</div>;
  }

  const nav = [
    { to: "/app", label: "Painel", icon: LayoutDashboard, exact: true },
    { to: "/app/carimbar", label: "Carimbar", icon: Stamp, exact: false },
    { to: "/app/clientes", label: "Clientes", icon: Users, exact: false },
    { to: "/app/campanhas", label: "Campanhas", icon: Sparkles, exact: false },
    { to: "/app/qrcodes", label: "QR Codes", icon: QrCode, exact: false },
    { to: "/app/retencao", label: "Retenção", icon: HeartHandshake, exact: false },
    { to: "/app/avaliacoes", label: "Avaliações", icon: Star, exact: false },
    { to: "/app/notificacoes", label: "Notificações", icon: Bell, exact: false },
    { to: "/app/equipe", label: "Equipe", icon: UsersRound, exact: false },
    
    
    { to: "/app/kb", label: "Central de Ajuda", icon: BookOpen, exact: false },
    { to: "/app/planos", label: "Planos", icon: Package, exact: false },
    { to: "/app/pagamentos", label: "Pagamentos", icon: Receipt, exact: false },
    { to: "/app/suporte", label: "Fale com a Fidelize", icon: LifeBuoy, exact: false },
  ] as const;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const renderNav = (onNavigate?: () => void) => (
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {nav.map((n) => {
        const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
        const badge = n.to === "/suporte" && unreadSupport > 0 ? unreadSupport : 0;
        return (
          <Link key={n.to} to={n.to} data-tour={`nav-${n.to}`} onClick={onNavigate} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted"}`}>
            <n.icon className="h-4 w-4" />
            <span className="flex-1">{n.label}</span>
            {badge > 0 && (
              <span
                role="status"
                aria-live="polite"
                aria-label={`${badge} ${badge === 1 ? "nova mensagem de suporte" : "novas mensagens de suporte"}`}
                className="ml-auto inline-flex min-w-[20px] h-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground"
              >
                <span aria-hidden="true">{badge > 9 ? "9+" : badge}</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const renderFooter = (onNavigate?: () => void) => (
    <div className="p-3 border-t space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">Tema</span>
        <ThemeToggle />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            <span className="truncate text-sm">{activeEst?.name}</span>
            <ChevronDown className="h-4 w-4" />
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

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card">
        <div className="p-5 border-b" data-tour="sidebar-logo"><Logo /></div>
        {renderNav()}
        {renderFooter()}
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between p-3 border-b bg-card sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Abrir menu"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 flex flex-col">
                <VisuallyHidden><SheetTitle>Menu de navegação</SheetTitle></VisuallyHidden>
                <div className="p-5 border-b"><Logo /></div>
                {renderNav(closeMobile)}
                {renderFooter(closeMobile)}
              </SheetContent>
            </Sheet>
            <Logo />
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <GuidedTour steps={MERCHANT_TOUR_STEPS} storageKey={`fidelize_tour_v1_${activeEst?.id ?? "user"}`} />
    </div>
  );
}
