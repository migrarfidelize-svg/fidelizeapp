import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listUsers, convertUserRole } from "@/lib/admin-users.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { UsersRound, Wallet, Building2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: AdminUsersPage,
  head: () => ({
    meta: [
      { title: "Usuários — Admin Fidelize" },
      { name: "description", content: "Gerencie o papel de acesso de todos os usuários da plataforma." },
    ],
  }),
});

type Row = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  account_type: "customer" | "establishment" | "super_admin";
  created_at: string;
  memberships: { establishment_id: string; role: string; active: boolean }[];
  isSuperAdmin: boolean;
};

const ROLE_META: Record<Row["account_type"], { label: string; icon: any; className: string }> = {
  customer: { label: "Cliente", icon: Wallet, className: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  establishment: { label: "Lojista", icon: Building2, className: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30" },
  super_admin: { label: "Super Admin", icon: ShieldCheck, className: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
};

function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const list = useServerFn(listUsers);
  const convert = useServerFn(convertUserRole);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", q, filter, page],
    queryFn: () => list({ data: { q, account_type: filter, page, pageSize: 25 } }),
  });

  const mut = useMutation({
    mutationFn: (input: { target_user_id: string; to: Row["account_type"] }) =>
      convert({ data: input }),
    onSuccess: (r) => {
      toast.success(`Usuário convertido: ${r.from} → ${r.to}`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao converter."),
  });

  const rows = (data?.rows ?? []) as Row[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-3">
        <div className="card-icon"><UsersRound className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-semibold">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Defina o papel de acesso: quem cai em /carteira, /app ou /admin.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">Base de usuários ({total})</CardTitle>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Input
              placeholder="Buscar por nome ou telefone…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="md:w-72"
            />
            <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
              <SelectTrigger className="md:w-48"><SelectValue placeholder="Papel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os papéis</SelectItem>
                <SelectItem value="customer">Clientes</SelectItem>
                <SelectItem value="establishment">Lojistas</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <th className="py-2 pr-3">Usuário</th>
                    <th className="py-2 pr-3">Papel</th>
                    <th className="py-2 pr-3">Vínculos</th>
                    <th className="py-2 pr-3">Criado</th>
                    <th className="py-2 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const meta = ROLE_META[r.account_type];
                    const Icon = meta.icon;
                    const activeMemberships = r.memberships.filter((m) => m.active).length;
                    return (
                      <tr key={r.id} className="border-b border-border/30">
                        <td className="py-3 pr-3">
                          <div className="font-medium">{r.full_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.email ?? r.phone ?? r.id.slice(0, 8)}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge variant="outline" className={meta.className}>
                            <Icon className="mr-1 h-3 w-3" /> {meta.label}
                          </Badge>
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground">
                          {activeMemberships > 0 ? `${activeMemberships} estab. ativo(s)` : "—"}
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-3 pr-3 text-right">
                          <ConvertActions row={r} onConvert={(to) => mut.mutate({ target_user_id: r.id, to })} pending={mut.isPending} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próximo</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConvertActions({
  row, onConvert, pending,
}: { row: Row; onConvert: (to: Row["account_type"]) => void; pending: boolean }) {
  const targets: Row["account_type"][] = ["customer", "establishment", "super_admin"];
  const [target, setTarget] = useState<Row["account_type"] | null>(null);

  return (
    <div className="flex justify-end gap-2">
      {targets.filter((t) => t !== row.account_type).map((t) => (
        <AlertDialog key={t}>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setTarget(t)}>
              → {ROLE_META[t].label}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Converter em {ROLE_META[t].label}?</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="font-medium text-foreground">{row.full_name ?? row.email ?? row.id.slice(0, 8)}</span> passará
                de <b>{ROLE_META[row.account_type].label}</b> para <b>{ROLE_META[t].label}</b>.
                {t === "customer" && (
                  <span className="mt-2 block text-amber-500">
                    Vínculos ativos com estabelecimentos serão desativados. Ele será redirecionado para <code>/carteira</code> no próximo login.
                  </span>
                )}
                {t === "super_admin" && (
                  <span className="mt-2 block text-amber-500">
                    Concede acesso total ao painel administrativo da plataforma.
                  </span>
                )}
                <span className="mt-2 block text-xs text-muted-foreground">Ação registrada em auditoria.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => onConvert(t)}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ))}
    </div>
  );
}
