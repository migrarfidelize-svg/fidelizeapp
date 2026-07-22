import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListUsers,
  adminSetUserAccountType,
  adminListOrphanCustomers,
  adminLinkOrphanCustomerToAccount,
  adminListEstablishments,
  adminGetUserWallet,
} from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  UsersRound, Search, Shield, Building2, User as UserIcon, Loader2, UserX,
  Wallet, KeyRound, CircleAlert, CircleCheck, Copy,
} from "lucide-react";
import { formatPhone } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — Admin • Fidelize" }] }),
  component: AdminUsers,
});

type AccountType = "customer" | "establishment" | "super_admin";
type StatusCode = "all" | "with_wallet" | "no_activity" | "active_member" | "onboarding_pending";

const TYPE_LABEL: Record<AccountType, string> = {
  customer: "Cliente final",
  establishment: "Estabelecimento",
  super_admin: "Super admin",
};

const TYPE_ICON: Record<AccountType, React.ComponentType<{ className?: string }>> = {
  customer: UserIcon,
  establishment: Building2,
  super_admin: Shield,
};

const STATUS_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  with_wallet:        { label: "Carteira ativa",        icon: Wallet,      tone: "border-emerald-500/40 text-emerald-600 bg-emerald-500/10" },
  no_activity:        { label: "Sem atividade",         icon: CircleAlert, tone: "border-amber-500/40 text-amber-600 bg-amber-500/10" },
  active_member:      { label: "Estabelecimento ativo", icon: CircleCheck, tone: "border-primary/40 text-primary bg-primary-soft" },
  onboarding_pending: { label: "Onboarding pendente",   icon: CircleAlert, tone: "border-amber-500/40 text-amber-600 bg-amber-500/10" },
  admin:              { label: "Super admin",           icon: Shield,      tone: "border-primary/40 text-primary bg-primary-soft" },
};

function initialsOf(name: string | null, email: string) {
  const base = (name || email || "?").trim();
  const p = base.split(/[\s@.]+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] ?? "") + (p[p.length - 1]?.[0] ?? "")).toUpperCase();
}

function useEstablishmentOptions() {
  const listFn = useServerFn(adminListEstablishments);
  return useQuery({
    queryKey: ["admin-est-options"],
    queryFn: () => listFn({ data: { status: "all", plan: "all" } }),
    staleTime: 60_000,
  });
}

function AdminUsers() {
  const listFn = useServerFn(adminListUsers);
  const setTypeFn = useServerFn(adminSetUserAccountType);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | AccountType>("all");
  const [status, setStatus] = useState<StatusCode>("all");
  const [establishmentId, setEstablishmentId] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: ests } = useEstablishmentOptions();

  const [target, setTarget] = useState<null | {
    id: string; email: string; full_name: string | null;
    account_type: AccountType; memberships: Array<{ name: string | null; active: boolean }>;
  }>(null);
  const [nextType, setNextType] = useState<AccountType>("customer");

  const { data, isFetching } = useQuery({
    queryKey: ["admin-users", searchTerm, filter, status, establishmentId, page],
    queryFn: () => listFn({
      data: {
        query: searchTerm,
        account_type: filter,
        status,
        establishment_id: establishmentId === "all" ? null : establishmentId,
        page,
        page_size: pageSize,
      },
    }),
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const mut = useMutation({
    mutationFn: (v: { user_id: string; account_type: AccountType }) => setTypeFn({ data: v }),
    onSuccess: (r) => {
      toast.success(`Perfil alterado para ${TYPE_LABEL[r.to as AccountType]}`);
      setTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao alterar perfil"),
  });

  function doSearch() { setPage(1); setSearchTerm(q.trim()); }
  function resetFilters() {
    setQ(""); setSearchTerm(""); setFilter("all"); setStatus("all"); setEstablishmentId("all"); setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <UsersRound className="h-5 w-5" />
            <div className="font-display text-2xl font-black">Usuários</div>
          </div>
          <div className="text-sm text-muted-foreground">
            Todos os usuários da plataforma. Converta entre <strong>Cliente final</strong>, <strong>Estabelecimento</strong> e <strong>Super admin</strong>.
          </div>
        </div>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts" className="gap-2"><UsersRound className="h-4 w-4" /> Usuários da plataforma</TabsTrigger>
          <TabsTrigger value="orphans" className="gap-2"><UserX className="h-4 w-4" /> Clientes sem conta</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4">
          <Card>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto] gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={q} onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doSearch()}
                    placeholder="Buscar por nome ou telefone…" className="pl-9"
                  />
                </div>
                <Select value={filter} onValueChange={(v) => { setFilter(v as typeof filter); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Perfil" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os perfis</SelectItem>
                    <SelectItem value="customer">Cliente final</SelectItem>
                    <SelectItem value="establishment">Estabelecimento</SelectItem>
                    <SelectItem value="super_admin">Super admin</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={(v) => { setStatus(v as StatusCode); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Qualquer status</SelectItem>
                    <SelectItem value="with_wallet">Carteira ativa</SelectItem>
                    <SelectItem value="no_activity">Login sem atividade</SelectItem>
                    <SelectItem value="active_member">Estabelecimento ativo</SelectItem>
                    <SelectItem value="onboarding_pending">Onboarding pendente</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={establishmentId} onValueChange={(v) => { setEstablishmentId(v); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Estabelecimento" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="all">Todos os estabelecimentos</SelectItem>
                    {(ests ?? []).map((e: { id: string; name: string }) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button onClick={doSearch} className="flex-1">Buscar</Button>
                  <Button variant="outline" onClick={resetFilters}>Limpar</Button>
                </div>
              </div>

              <div className="rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Vínculos ativos</TableHead>
                      <TableHead className="hidden lg:table-cell">Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isFetching && users.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
                      </TableCell></TableRow>
                    )}
                    {!isFetching && users.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        Nenhum usuário encontrado.
                      </TableCell></TableRow>
                    )}
                    {users.map((u) => {
                      const Icon = TYPE_ICON[u.account_type];
                      const activeMems = u.memberships.filter((m) => m.active);
                      const meta = STATUS_META[u.status] ?? { label: u.status_label, icon: CircleAlert, tone: "border-muted text-muted-foreground bg-muted/40" };
                      const StatusIcon = meta.icon;
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-primary text-xs font-semibold shrink-0">
                                {initialsOf(u.full_name, u.email)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium truncate">{u.full_name || u.email || u.id.slice(0, 8)}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {u.email || "—"}{u.phone ? ` · ${formatPhone(u.phone)}` : ""}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <Icon className="h-3 w-3" /> {TYPE_LABEL[u.account_type]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`gap-1 ${meta.tone}`}>
                              <StatusIcon className="h-3 w-3" /> {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            {activeMems.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="space-y-0.5">
                                {activeMems.slice(0, 2).map((m, i) => (
                                  <div key={i} className="truncate max-w-[200px]">{m.name ?? "Estab."}</div>
                                ))}
                                {activeMems.length > 2 && (
                                  <div className="text-xs text-muted-foreground">+{activeMems.length - 2}</div>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => {
                              setTarget({
                                id: u.id, email: u.email, full_name: u.full_name,
                                account_type: u.account_type,
                                memberships: u.memberships,
                              });
                              setNextType(u.account_type === "customer" ? "establishment" : "customer");
                            }}>Alterar perfil</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || isFetching}>Anterior</Button>
                  <div className="text-xs text-muted-foreground">Página {page} de {totalPages} · {total} usuário(s)</div>
                  <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || isFetching}>Próxima</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orphans" className="mt-4">
          <OrphanCustomers establishments={ests ?? []} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar perfil do usuário</DialogTitle>
            <DialogDescription>
              A conversão redireciona o usuário no próximo login e ajusta vínculos automaticamente.
            </DialogDescription>
          </DialogHeader>
          {target && (
            <div className="space-y-4">
              <div className="rounded-xl border p-3">
                <div className="font-medium">{target.full_name || target.email || target.id.slice(0, 8)}</div>
                <div className="text-xs text-muted-foreground">{target.email || "—"}</div>
                <div className="mt-2 text-xs">
                  Perfil atual: <strong>{TYPE_LABEL[target.account_type]}</strong>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Novo perfil</div>
                <Select value={nextType} onValueChange={(v) => setNextType(v as AccountType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Cliente final — vai para /carteira</SelectItem>
                    <SelectItem value="establishment">Estabelecimento — acesso a /app</SelectItem>
                    <SelectItem value="super_admin">Super admin — acesso a /admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {nextType !== "establishment" && target.memberships.some((m) => m.active) && (
                <div className="rounded-lg border border-warning/40 bg-warning/10 text-warning-foreground p-3 text-xs">
                  Este usuário tem <strong>{target.memberships.filter((m) => m.active).length}</strong> vínculo(s) ativo(s) com estabelecimentos.
                  Todos serão desativados na conversão.
                </div>
              )}
              {nextType === "super_admin" && (
                <div className="rounded-lg border border-primary/40 bg-primary-soft text-primary p-3 text-xs">
                  Concede acesso total ao painel <strong>/admin</strong>. Use com cautela.
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTarget(null)} disabled={mut.isPending}>Cancelar</Button>
            <Button
              disabled={mut.isPending || !target || nextType === target?.account_type}
              onClick={() => target && mut.mutate({ user_id: target.id, account_type: nextType })}
              className="gradient-brand text-primary-foreground"
            >
              {mut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Confirmar alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="text-xs text-muted-foreground">
        Precisa gerenciar vínculos específicos de uma empresa? Acesse <Link to="/admin/empresas" className="underline">Empresas</Link>.
      </div>
    </div>
  );
}

function OrphanCustomers({ establishments }: { establishments: Array<{ id: string; name: string }> }) {
  const listFn = useServerFn(adminListOrphanCustomers);
  const linkFn = useServerFn(adminLinkOrphanCustomerToAccount);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [establishmentId, setEstablishmentId] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [confirm, setConfirm] = useState<null | { id: string; name: string | null; phone: string | null }>(null);
  const [result, setResult] = useState<null | { email: string; password: string; created_new_user: boolean }>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["admin-orphan-customers", term, establishmentId, page],
    queryFn: () => listFn({
      data: {
        query: term,
        establishment_id: establishmentId === "all" ? null : establishmentId,
        page, page_size: pageSize,
      },
    }),
  });

  const rows = data?.customers ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const mut = useMutation({
    mutationFn: (v: { customer_id: string }) => linkFn({ data: v }),
    onSuccess: (r) => {
      setConfirm(null);
      setResult({ ...r.credentials, created_new_user: r.created_new_user });
      qc.invalidateQueries({ queryKey: ["admin-orphan-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(r.created_new_user ? "Login criado com sucesso." : "Cliente vinculado a um login existente.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao vincular cliente."),
  });

  function doSearch() { setPage(1); setTerm(q.trim()); }
  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copiado.`); }
    catch { toast.error("Não foi possível copiar."); }
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
          Clientes cadastrados por lojistas (via <strong>/carimbar</strong> ou importação CSV) que <strong>ainda não criaram uma conta</strong> na plataforma. Use <strong>Criar login</strong> para gerar credenciais de WhatsApp e liberar o acesso ao <strong>/carteira</strong> imediatamente.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder="Buscar por nome, telefone ou e-mail…" className="pl-9"
            />
          </div>
          <Select value={establishmentId} onValueChange={(v) => { setEstablishmentId(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Estabelecimento" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Todos os estabelecimentos</SelectItem>
              {establishments.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={doSearch}>Buscar</Button>
        </div>

        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Estabelecimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Visitas</TableHead>
                <TableHead className="hidden lg:table-cell">Cadastrado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFetching && rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
                </TableCell></TableRow>
              )}
              {!isFetching && rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Nenhum cliente sem conta encontrado.
                </TableCell></TableRow>
              )}
              {rows.map((c) => {
                const digits = String(c.phone ?? "").replace(/\D/g, "");
                const canLink = digits.length >= 10;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground text-xs font-semibold shrink-0">
                          {initialsOf(c.name, c.email ?? "")}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.name ?? "Sem nome"}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {c.phone ? formatPhone(c.phone) : "—"}{c.email ? ` · ${c.email}` : ""}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {c.establishment_name ? (
                        <Link to="/admin/empresa/$id" params={{ id: c.establishment_id }} className="underline hover:text-primary">
                          {c.establishment_name}
                        </Link>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600 bg-amber-500/10">
                        <UserX className="h-3 w-3" /> Sem login
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{c.visits_count}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm" variant="outline" className="gap-1"
                        disabled={!canLink}
                        title={canLink ? "Criar credenciais e vincular ao /carteira" : "Cliente sem WhatsApp válido (DDD + número)"}
                        onClick={() => setConfirm({ id: c.id, name: c.name, phone: c.phone })}
                      >
                        <KeyRound className="h-3.5 w-3.5" /> Criar login
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || isFetching}>Anterior</Button>
            <div className="text-xs text-muted-foreground">Página {page} de {totalPages} · {total} cliente(s)</div>
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || isFetching}>Próxima</Button>
          </div>
        )}
      </CardContent>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar login para o cliente</DialogTitle>
            <DialogDescription>
              Gera credenciais sintéticas baseadas no WhatsApp e libera o acesso à <strong>/carteira</strong>. Se já existir um usuário com o mesmo número, o cliente será vinculado a ele.
            </DialogDescription>
          </DialogHeader>
          {confirm && (
            <div className="rounded-xl border p-3 text-sm">
              <div className="font-medium">{confirm.name ?? "Sem nome"}</div>
              <div className="text-xs text-muted-foreground">{confirm.phone ? formatPhone(confirm.phone) : "—"}</div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={mut.isPending}>Cancelar</Button>
            <Button
              disabled={mut.isPending || !confirm}
              onClick={() => confirm && mut.mutate({ customer_id: confirm.id })}
              className="gradient-brand text-primary-foreground"
            >
              {mut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <KeyRound className="h-4 w-4 mr-1" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{result?.created_new_user ? "Login criado" : "Vinculado a login existente"}</DialogTitle>
            <DialogDescription>
              O cliente agora aparece em <strong>Usuários da plataforma</strong> e pode acessar a <strong>/carteira</strong> com estas credenciais.
            </DialogDescription>
          </DialogHeader>
          {result && (
            <div className="space-y-3">
              <div className="rounded-xl border p-3 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">E-mail sintético</div>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs break-all">{result.email}</code>
                  <Button size="sm" variant="ghost" onClick={() => copy(result.email, "E-mail")}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="rounded-xl border p-3 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Senha</div>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs break-all">{result.password}</code>
                  <Button size="sm" variant="ghost" onClick={() => copy(result.password, "Senha")}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                O cliente também pode entrar informando apenas o WhatsApp na tela de login — o sistema resolve as credenciais automaticamente.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResult(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
