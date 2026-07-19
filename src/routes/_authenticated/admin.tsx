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
import { Shield, LayoutDashboard, Building2, CreditCard, ArrowLeft, Bell, FileClock, UsersRound, Settings, Mail, FileText, ListChecks, LifeBuoy, Package, DollarSign, ChevronDown, Wallet, Megaphone, Cog, BookOpen, Menu } from "lucide-react";
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
        { to: "/admin/ajuda", label: "Central de Ajuda", icon: BookOpen },
      ],
    },
    {
      key: "sistema",
      label: "Sistema",
      icon: Cog,
      items: [{ to: "/admin/config", label: "Configurações", icon: Settings }],
    },
  ];

  const isItemActive = (n: NavItem) => (n.exact ? pathname === n.to : pathname.startsWith(n.to));
  const activeGroup = groups.find((g) => g.items.some(isItemActive))?.key ?? null;
  const [openKey, setOpenKey] = useState<string | null>(activeGroup);
  const currentOpen = openKey ?? activeGroup;

  const mobileNav: NavItem[] = [overview, ...groups.flatMap((g) => g.items)];

  return (
    <div className="min-h-dvh bg-muted/30 flex">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card">
        <div className="p-5 border-b flex items-center gap-2"><Logo /><span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-soft text-primary">Admin</span></div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {(() => {
            const active = isItemActive(overview);
            return (
              <Link to={overview.to} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted"}`}>
                <overview.icon className="h-4 w-4" /> {overview.label}
              </Link>
            );
          })()}
          {groups.map((g) => {
            const isOpen = currentOpen === g.key;
            const hasActive = g.items.some(isItemActive);
            return (
              <div key={g.key} className="pt-1">
                <button
                  type="button"
                  onClick={() => setOpenKey(isOpen ? null : g.key)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${hasActive ? "text-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <g.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{g.label}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="mt-1 ml-3 pl-3 border-l space-y-1">
                    {g.items.map((n) => {
                      const active = isItemActive(n);
                      return (
                        <Link key={n.to} to={n.to} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-primary-soft text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}>
                          <n.icon className="h-4 w-4" /> {n.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="p-3 border-t space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground">Tema</span>
            <ThemeToggle />
          </div>
          <Link to="/app" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Voltar ao painel do lojista</Link>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between p-3 border-b bg-card">
          <div className="flex items-center gap-2"><Logo /><span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-soft text-primary">Admin</span></div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link to="/app" className="text-xs text-muted-foreground" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto"><Outlet /></main>
        <nav className="md:hidden grid grid-cols-5 border-t bg-card overflow-x-auto">
          {mobileNav.map((n) => {
            const active = isItemActive(n);
            return (
              <Link key={n.to} to={n.to} className={`flex flex-col items-center gap-1 py-2 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}>
                <n.icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
