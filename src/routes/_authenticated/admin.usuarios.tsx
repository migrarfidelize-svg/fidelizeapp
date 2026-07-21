import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListUsers, adminSetUserAccountType, adminListOrphanCustomers } from "@/lib/admin.functions";
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
import { UsersRound, Search, Shield, Building2, User as UserIcon, Loader2, UserX } from "lucide-react";
import { formatPhone } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — Admin • Fidelize" }] }),
  component: AdminUsers,
});

type AccountType = "customer" | "establishment" | "super_admin";

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

function initialsOf(name: string | null, email: string) {
  const base = (name || email || "?").trim();
  const p = base.split(/[\s@.]+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] ?? "") + (p[p.length - 1]?.[0] ?? "")).toUpperCase();
}

function AdminUsers() {
  const listFn = useServerFn(adminListUsers);
  const setTypeFn = useServerFn(adminSetUserAccountType);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | AccountType>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [target, setTarget] = useState<null | {
    id: string; email: string; full_name: string | null;
    account_type: AccountType; memberships: Array<{ name: string | null; active: boolean }>;
  }>(null);
  const [nextType, setNextType] = useState<AccountType>("customer");

  const { data, isFetching } = useQuery({
    queryKey: ["admin-users", searchTerm, filter, page],
    queryFn: () => listFn({ data: { query: searchTerm, account_type: filter, page, page_size: pageSize } }),
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
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="Buscar por nome ou telefone…" className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={(v) => { setFilter(v as typeof filter); setPage(1); }}>
              <SelectTrigger className="min-w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os perfis</SelectItem>
                <SelectItem value="customer">Cliente final</SelectItem>
                <SelectItem value="establishment">Estabelecimento</SelectItem>
                <SelectItem value="super_admin">Super admin</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={doSearch}>Buscar</Button>
          </div>

          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead className="hidden md:table-cell">Vínculos ativos</TableHead>
                  <TableHead className="hidden lg:table-cell">Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFetching && users.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
                  </TableCell></TableRow>
                )}
                {!isFetching && users.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    Nenhum usuário encontrado.
                  </TableCell></TableRow>
                )}
                {users.map((u) => {
                  const Icon = TYPE_ICON[u.account_type];
                  const activeMems = u.memberships.filter((m) => m.active);
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
          <OrphanCustomers />
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
