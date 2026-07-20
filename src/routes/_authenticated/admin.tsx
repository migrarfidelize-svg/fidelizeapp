import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getAdminStatus, bootstrapSuperAdmin } from "@/lib/admin.functions";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Shield, LayoutDashboard, Building2, CreditCard, ArrowLeft, Bell, FileClock, UsersRound, Settings, Mail, FileText, ListChecks, LifeBuoy, Package, DollarSign, Wallet, Megaphone, Cog, BookOpen, Menu, Star, Plug } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const getStatus = useServerFn(getAdminStatus);
  const bootstrap = useServerFn(bootstrapSuperAdmin);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-status"], queryFn: () => getStatus() });
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  type NavItem = { to: string; label: string; icon: any; exact?: boolean };
  const overview: NavItem = { to: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true };
  const groups: { key: string; label: string; icon: any; items: NavItem[] }[] = [
    {
      key: "empresas",
      label: "Empresas",
      icon: Building2,
      items: [
        { to: "/admin/empresas", label: "Empresas", icon: Building2 },
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
        { to: "/admin/config", label: "Configurações", icon: Settings },
      ],
    },
  ];

  const isItemActive = (n: NavItem) => (n.exact ? pathname === n.to : pathname.startsWith(n.to));

  const closeMobile = () => setMobileOpen(false);

  const renderSidebarBody = (onNavigate?: () => void) => (
    <>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {(() => {
          const active = isItemActive(overview);
          return (
            <Link to={overview.to} onClick={onNavigate} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted"}`}>
              <overview.icon className="h-4 w-4" /> {overview.label}
            </Link>
          );
        })()}
        {groups.map((g) => {
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
      <div className="p-3 border-t space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">Tema</span>
          <ThemeToggle />
        </div>
        <Link to="/app" onClick={onNavigate} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Voltar ao painel do lojista</Link>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-muted/30 flex">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card">
        <div className="p-5 border-b flex items-center gap-2"><Logo /><span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-soft text-primary">Admin</span></div>
        {renderSidebarBody()}
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
                <div className="p-5 border-b flex items-center gap-2"><Logo /><span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-soft text-primary">Admin</span></div>
                {renderSidebarBody(closeMobile)}
              </SheetContent>
            </Sheet>
            <Logo /><span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-soft text-primary">Admin</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto"><Outlet /></main>
      </div>
    </div>
  );
}
