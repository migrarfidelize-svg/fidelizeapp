import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { UsersRound as HeroIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyEstablishments, getEstablishmentCampaigns,
  listCustomersAdvanced, getCustomerStats, getCustomerDetail,
  createCustomerRow, updateCustomerRow, setCustomerBlocked, deleteCustomerRow,
  addStamp, bulkSetBlocked, bulkDeleteCustomers, importCustomersCsv, getCustomerAudit,
} from "@/lib/loyalty.functions";
import { parseCsv, CUSTOMER_CSV_TEMPLATE } from "@/lib/csv";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatPhone, formatDate } from "@/lib/format";
import {
  Users, Search, Plus, Download, Upload, Filter, MoreHorizontal, ShieldOff, ShieldCheck,
  Trash2, Pencil, ExternalLink, Stamp as StampIcon, MessageCircle, Copy, Gift,
  TrendingUp, UserPlus, MailCheck, Ban, History, FileWarning, CheckCircle2,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/app/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Fidelize" }] }),
  component: Clientes,
});


type CustomerRow = {
  id: string; name: string; phone: string; email: string | null; code: string;
  birthdate: string | null; visits_count: number; last_visit_at: string | null;
  created_at: string; blocked: boolean; marketing_opt_in: boolean; notes: string | null;
};

function initialsOf(name: string) {
  const p = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] ?? "") + (p[p.length - 1][0] ?? "")).toUpperCase();
}

function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: CustomerRow[]) {
  const head = ["Nome", "Telefone", "Email", "Código", "Nascimento", "Visitas", "Última visita", "Cadastro", "Bloqueado", "Opt-in", "Notas"];
  const lines = [head.join(";")];
  for (const c of rows) {
    lines.push([
      c.name, formatPhone(c.phone), c.email ?? "", c.code, c.birthdate ?? "",
      c.visits_count, c.last_visit_at ?? "", c.created_at, c.blocked ? "sim" : "não",
      c.marketing_opt_in ? "sim" : "não", c.notes ?? "",
    ].map(csvEscape).join(";"));
  }
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function Clientes() {
  const qc = useQueryClient();
  const getEsts = useServerFn(getMyEstablishments);
  const listCamp = useServerFn(getEstablishmentCampaigns);
  const listFn = useServerFn(listCustomersAdvanced);
  const statsFn = useServerFn(getCustomerStats);

  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as { id: string; name: string; slug: string } | undefined;

  const { data: campaigns } = useQuery({
    enabled: !!est,
    queryKey: ["campaigns-basic", est?.id],
    queryFn: () => listCamp({ data: { establishment_id: est!.id } }),
  });

  // filters state
  const [q, setQ] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "blocked" | "opt_in" | "recent" | "inactive">("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [sort, setSort] = useState<"last_visit" | "created" | "name" | "visits">("last_visit");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: listData, isFetching, refetch } = useQuery({
    enabled: !!est,
    queryKey: ["customers-adv", est?.id, searchTerm, status, campaignFilter, sort, dir, page],
    queryFn: () => listFn({
      data: {
        establishment_id: est!.id, query: searchTerm, status, sort, dir, page, page_size: pageSize,
        campaign_id: campaignFilter === "all" ? undefined : campaignFilter,
      },
    }),
  });
  const rows = (listData?.customers ?? []) as CustomerRow[];
  const total = listData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const { data: stats } = useQuery({
    enabled: !!est, queryKey: ["customer-stats", est?.id],
    queryFn: () => statsFn({ data: { establishment_id: est!.id } }),
  });

  // Drawer + dialogs
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CustomerRow | null>(null);
  const [importing, setImporting] = useState(false);

  // Bulk selection (per page; ids only)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"block" | "unblock" | "delete" | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  function toggleOne(id: string, on: boolean) {
    setSelected(prev => {
      const n = new Set(prev);
      if (on) n.add(id); else n.delete(id);
      return n;
    });
  }
  function togglePage(on: boolean) {
    setSelected(prev => {
      const n = new Set(prev);
      rows.forEach(r => { if (on) n.add(r.id); else n.delete(r.id); });
      return n;
    });
  }
  const pageSelectedCount = rows.filter(r => selected.has(r.id)).length;
  const allPageSelected = rows.length > 0 && pageSelectedCount === rows.length;

  function applySearch() { setPage(1); setSearchTerm(q.trim()); }
  function resetFilters() {
    setQ(""); setSearchTerm(""); setStatus("all"); setCampaignFilter("all");
    setSort("last_visit"); setDir("desc"); setPage(1);
  }


  const activeFilters = useMemo(() => {
    const f: string[] = [];
    if (searchTerm) f.push(`"${searchTerm}"`);
    if (status !== "all") f.push({ active: "Ativos", blocked: "Bloqueados", opt_in: "Opt-in", recent: "Ativos 30d", inactive: "Inativos 60d+" }[status]);
    if (campaignFilter !== "all") {
      const c = campaigns?.find((x) => x.id === campaignFilter);
      if (c) f.push(`Campanha: ${c.name}`);
    }
    return f;
  }, [searchTerm, status, campaignFilter, campaigns]);

  return (
    <div className="space-y-6">
      <PageHero
        icon={HeroIcon}
        eyebrow={"CRM · Base ativa"}
        liveLabel={"Ao vivo"}
        title={"Base de clientes"}
        subtitle={"Segmente, importe e acompanhe o ciclo de vida de cada cliente."}
        actions={
          <>
            <Button variant="outline" onClick={() => setImporting(true)}>
              <Upload className="h-4 w-4 mr-2" /> Importar
            </Button>
            <Button variant="outline" onClick={() => downloadCsv(rows)} disabled={rows.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Exportar
            </Button>
            <Button onClick={() => setCreating(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_28px_-8px_var(--primary)]">
              <Plus className="h-4 w-4 mr-2" /> Novo cliente
            </Button>
          </>
        }
      />

      {/* KPI strip — premium cinematic */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <ProStat icon={Users} label="Base total" value={stats?.total ?? 0} hint="cadastros ativos" />
        <ProStat icon={TrendingUp} label="Ativos 30d" value={stats?.active_30d ?? 0} hint="visitaram no mês" tone="success" />
        <ProStat icon={UserPlus} label="Novos 30d" value={stats?.new_30d ?? 0} hint="entradas recentes" tone="primary" />
        <ProStat icon={MailCheck} label="Opt-in marketing" value={stats?.opt_in ?? 0} hint="autorizaram contato" />
        <ProStat icon={Ban} label="Bloqueados" value={stats?.blocked ?? 0} hint="sem carimbar" tone="danger" />
      </div>

      {/* Command bar */}
      <div className="rounded-2xl border border-primary/15 bg-[color:color-mix(in_oklab,var(--card)_65%,transparent)] backdrop-blur-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              placeholder="Buscar por nome, telefone, e-mail ou código…"
              className="pl-9 h-10 bg-background/60 border-primary/20 focus-visible:ring-primary/40"
            />
          </div>
          <Button variant="outline" onClick={applySearch} className="h-10 border-primary/25">
            <Search className="h-4 w-4 mr-2" />Buscar
          </Button>

          <Select value={status} onValueChange={(v: any) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[180px] h-10 border-primary/20"><Filter className="h-4 w-4 mr-2 text-primary/70" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="recent">Visitou nos 30d</SelectItem>
              <SelectItem value="inactive">Inativos 60d+</SelectItem>
              <SelectItem value="opt_in">Aceita marketing</SelectItem>
              <SelectItem value="blocked">Bloqueados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={campaignFilter} onValueChange={(v) => { setCampaignFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[190px] h-10 border-primary/20"><SelectValue placeholder="Campanha" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas campanhas</SelectItem>
              {(campaigns ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={`${sort}:${dir}`} onValueChange={(v) => {
            const [s, d] = v.split(":") as [typeof sort, typeof dir];
            setSort(s); setDir(d); setPage(1);
          }}>
            <SelectTrigger className="w-[200px] h-10 border-primary/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="last_visit:desc">Última visita ↓</SelectItem>
              <SelectItem value="last_visit:asc">Última visita ↑</SelectItem>
              <SelectItem value="created:desc">Cadastro (novos)</SelectItem>
              <SelectItem value="created:asc">Cadastro (antigos)</SelectItem>
              <SelectItem value="name:asc">Nome A–Z</SelectItem>
              <SelectItem value="name:desc">Nome Z–A</SelectItem>
              <SelectItem value="visits:desc">Mais visitas</SelectItem>
              <SelectItem value="visits:asc">Menos visitas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-muted-foreground uppercase tracking-widest">Filtros ativos:</span>
            {activeFilters.map((f, i) => (
              <Badge key={i} variant="outline" className="border-primary/30 bg-primary/10 text-primary">{f}</Badge>
            ))}
            <button onClick={resetFilters} className="text-muted-foreground hover:text-primary underline">Limpar tudo</button>
          </div>
        )}
      </div>

      {/* Sticky bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/40 bg-[color:color-mix(in_oklab,var(--card)_92%,transparent)] backdrop-blur-md px-4 py-2.5 shadow-[0_0_32px_-8px_var(--primary)]">
          <span className="grid h-7 w-7 place-items-center rounded-md border border-primary/40 bg-primary/15 text-primary text-xs font-bold">
            {selected.size}
          </span>
          <div className="text-sm font-medium">
            cliente{selected.size === 1 ? "" : "s"} selecionado{selected.size === 1 ? "" : "s"}
          </div>
          <div className="ml-auto flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setBulkAction("unblock")}>
              <ShieldCheck className="h-4 w-4 mr-1" />Desbloquear
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkAction("block")}>
              <ShieldOff className="h-4 w-4 mr-1" />Bloquear
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setBulkAction("delete")}>
              <Trash2 className="h-4 w-4 mr-1" />Excluir
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
          </div>
        </div>
      )}

      {/* Data table — Command Table Pro */}
      <div className="rounded-2xl border border-primary/15 bg-[color:color-mix(in_oklab,var(--card)_55%,transparent)] overflow-hidden">
        {!isFetching && rows.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <div className="font-display text-lg text-foreground mb-1">
              {searchTerm || status !== "all" || campaignFilter !== "all"
                ? "Nenhum cliente com esses filtros"
                : "Sua base ainda está vazia"}
            </div>
            <p className="text-sm">
              {searchTerm || status !== "all" || campaignFilter !== "all"
                ? "Ajuste os filtros ou limpe a busca para ver mais resultados."
                : "Compartilhe seu QR Code ou importe uma planilha para começar."}
            </p>
          </div>
        ) : (
          <>
            {/* Column header */}
            <div className="hidden md:grid grid-cols-[36px_minmax(0,2.2fr)_1fr_120px_140px_44px] items-center gap-3 px-4 py-3 border-b border-primary/15 bg-[color:color-mix(in_oklab,var(--primary)_6%,transparent)] text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <Checkbox
                checked={allPageSelected}
                onCheckedChange={(v) => togglePage(!!v)}
                aria-label="Selecionar página"
              />
              <span>Cliente</span>
              <span>Segmento</span>
              <span className="text-right">Visitas</span>
              <span className="text-right">Última visita</span>
              <span className="text-right">Ações</span>
            </div>

            <div className="divide-y divide-primary/10">
              {rows.map((c) => {
                const seg = segmentOf(c);
                const isSel = selected.has(c.id);
                return (
                  <div
                    key={c.id}
                    className={`group relative grid grid-cols-[28px_minmax(0,1fr)_40px] md:grid-cols-[36px_minmax(0,2.2fr)_1fr_120px_140px_44px] items-center gap-2 md:gap-3 px-3 md:px-4 py-3.5 transition-colors ${
                      isSel ? "bg-[color:color-mix(in_oklab,var(--primary)_10%,transparent)]" : "hover:bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)]"
                    }`}

                  >
                    {/* left cyan indicator when selected */}
                    <span
                      aria-hidden
                      className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full transition-opacity ${
                        isSel ? "bg-primary opacity-100 shadow-[0_0_12px_var(--primary)]" : "bg-primary opacity-0 group-hover:opacity-40"
                      }`}
                    />
                    <Checkbox
                      checked={isSel}
                      onCheckedChange={(v) => toggleOne(c.id, !!v)}
                      aria-label={`Selecionar ${c.name}`}
                    />

                    {/* Cliente */}
                    <button onClick={() => setOpenId(c.id)} className="flex items-center gap-2.5 md:gap-3 text-left min-w-0">
                      <div className="relative shrink-0">
                        <div className="grid h-9 w-9 md:h-11 md:w-11 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary font-semibold text-xs md:text-sm">
                          {initialsOf(c.name)}
                        </div>
                        {!c.blocked && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success border-2 border-background" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium truncate">{c.name}</div>
                          {c.blocked && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Bloqueado</Badge>}
                          {c.marketing_opt_in && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-primary/30 text-primary">Opt-in</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {formatPhone(c.phone)}{c.email ? ` · ${c.email}` : ""} · #{c.code}
                        </div>
                        {/* Meta compacta (mobile) */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground md:hidden">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${seg.className}`}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
                            {seg.label}
                          </span>
                          <span className="tabular-nums">{c.visits_count} visitas</span>
                          {c.last_visit_at && <span className="tabular-nums">· {formatDate(c.last_visit_at)}</span>}
                        </div>
                      </div>
                    </button>

                    {/* Segmento */}
                    <div className="hidden md:block min-w-0">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${seg.className}`}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
                        {seg.label}
                      </span>
                    </div>

                    {/* Visitas */}
                    <div className="hidden md:block text-right">
                      <div className="font-display text-lg leading-none tabular-nums text-foreground">{c.visits_count}</div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">visitas</div>
                    </div>

                    {/* Última visita */}
                    <div className="hidden md:block text-right text-sm text-muted-foreground tabular-nums">
                      {c.last_visit_at ? formatDate(c.last_visit_at) : <span className="italic">—</span>}
                    </div>


                    {/* Ações */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Ações do cliente" className="shrink-0 hover:bg-primary/10 hover:text-primary">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setOpenId(c.id)}>Abrir ficha</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditing(c)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`https://wa.me/55${c.phone}`, "_blank")}>
                          <MessageCircle className="h-4 w-4 mr-2" />WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <BlockToggleItem c={c} onDone={() => { qc.invalidateQueries({ queryKey: ["customers-adv"] }); qc.invalidateQueries({ queryKey: ["customer-stats"] }); }} />
                        <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(c)}>
                          <Trash2 className="h-4 w-4 mr-2" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer / pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {isFetching ? "Carregando…" : (
            <>
              <span className="text-foreground font-medium tabular-nums">{total}</span> cliente{total === 1 ? "" : "s"} · página <span className="tabular-nums">{page}</span> de <span className="tabular-nums">{totalPages}</span>
            </>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</Button>
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Próxima</Button>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      <CustomerDrawer
        customerId={openId}
        onClose={() => setOpenId(null)}
        onEdit={(c) => { setOpenId(null); setEditing(c); }}
        establishmentSlug={est?.slug}
        onDataChanged={() => { void refetch(); qc.invalidateQueries({ queryKey: ["customer-stats"] }); }}
      />

      {/* Create/Edit dialog */}
      <CustomerFormDialog
        open={creating || !!editing}
        initial={editing}
        establishmentId={est?.id}
        campaigns={campaigns ?? []}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { void refetch(); qc.invalidateQueries({ queryKey: ["customer-stats"] }); }}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o cliente, seus cartões, carimbos e recompensas. Não pode ser desfeita. Requer perfil gestor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
              if (!confirmDelete) return;
              try {
                await deleteCustomerRow({ data: { customer_id: confirmDelete.id } });
                toast.success("Cliente excluído");
                setConfirmDelete(null);
                void refetch();
                qc.invalidateQueries({ queryKey: ["customer-stats"] });
              } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
            }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk confirm */}
      <AlertDialog open={!!bulkAction} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === "delete"
                ? `Excluir ${selected.size} cliente${selected.size === 1 ? "" : "s"}?`
                : bulkAction === "block"
                ? `Bloquear ${selected.size} cliente${selected.size === 1 ? "" : "s"}?`
                : `Desbloquear ${selected.size} cliente${selected.size === 1 ? "" : "s"}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "delete"
                ? "Ação permanente: remove cartões, carimbos e recompensas de todos os selecionados. Requer perfil gestor."
                : bulkAction === "block"
                ? "Clientes bloqueados não poderão receber carimbos até serem desbloqueados."
                : "Os clientes voltarão a poder receber carimbos normalmente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkBusy}
              className={bulkAction === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={async () => {
                if (!est || !bulkAction) return;
                setBulkBusy(true);
                try {
                  const ids = Array.from(selected);
                  if (bulkAction === "delete") {
                    const r = await bulkDeleteCustomers({ data: { establishment_id: est.id, customer_ids: ids } });
                    toast.success(`${r.affected} cliente(s) excluído(s)`);
                  } else {
                    const r = await bulkSetBlocked({ data: { establishment_id: est.id, customer_ids: ids, blocked: bulkAction === "block" } });
                    toast.success(`${r.affected} cliente(s) atualizado(s)`);
                  }
                  setSelected(new Set());
                  setBulkAction(null);
                  void refetch();
                  qc.invalidateQueries({ queryKey: ["customer-stats"] });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Erro na ação em lote");
                } finally {
                  setBulkBusy(false);
                }
              }}
            >
              {bulkBusy ? "Processando…" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import CSV */}
      <ImportCsvDialog
        open={importing}
        onClose={() => setImporting(false)}
        establishmentId={est?.id}
        campaigns={campaigns ?? []}
        onImported={() => { void refetch(); qc.invalidateQueries({ queryKey: ["customer-stats"] }); }}
      />
    </div>
  );
}


function ProStat({
  icon: Icon, label, value, hint, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number; hint?: string;
  tone?: "primary" | "success" | "danger";
}) {
  const toneClass =
    tone === "success" ? "text-success"
    : tone === "danger" ? "text-destructive"
    : tone === "primary" ? "text-primary"
    : "text-foreground";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-[color:color-mix(in_oklab,var(--card)_65%,transparent)] p-4 backdrop-blur-sm">
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-70" />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
          <div className={`metric-number mt-1 tabular-nums ${toneClass}`}>{value.toLocaleString("pt-BR")}</div>
          {hint && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{hint}</div>}
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_18px_-6px_var(--primary)]">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function segmentOf(c: CustomerRow): { label: string; className: string } {
  if (c.blocked) return { label: "Bloqueado", className: "border-destructive/40 bg-destructive/10 text-destructive" };
  const now = Date.now();
  const lastMs = c.last_visit_at ? new Date(c.last_visit_at).getTime() : 0;
  const daysSince = lastMs ? Math.floor((now - lastMs) / 86400000) : Infinity;
  const createdMs = new Date(c.created_at).getTime();
  const daysOld = Math.floor((now - createdMs) / 86400000);

  if (c.visits_count >= 10 && daysSince <= 30) return { label: "VIP", className: "border-primary/50 bg-primary/15 text-primary" };
  if (daysOld <= 14 && c.visits_count <= 1) return { label: "Novo", className: "border-accent/40 bg-accent/10 text-accent" };
  if (daysSince <= 30) return { label: "Ativo", className: "border-success/40 bg-success/10 text-success" };
  if (daysSince <= 60) return { label: "Morno", className: "border-warning/40 bg-warning/10 text-warning" };
  if (daysSince <= 120) return { label: "Em risco", className: "border-orange-500/40 bg-orange-500/10 text-orange-400" };
  return { label: "Perdido", className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground" };
}

function BlockToggleItem({ c, onDone }: { c: CustomerRow; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <DropdownMenuItem disabled={busy} onSelect={async (e) => {
      e.preventDefault(); setBusy(true);
      try {
        await setCustomerBlocked({ data: { customer_id: c.id, blocked: !c.blocked } });
        toast.success(c.blocked ? "Cliente desbloqueado" : "Cliente bloqueado");
        onDone();
      } catch (err) { toast.error(err instanceof Error ? err.message : "Erro"); }
      finally { setBusy(false); }
    }}>
      {c.blocked ? <ShieldCheck className="h-4 w-4 mr-2" /> : <ShieldOff className="h-4 w-4 mr-2" />}
      {c.blocked ? "Desbloquear" : "Bloquear"}
    </DropdownMenuItem>
  );
}

function CustomerDrawer({
  customerId, onClose, onEdit, establishmentSlug, onDataChanged,
}: {
  customerId: string | null;
  onClose: () => void;
  onEdit: (c: CustomerRow) => void;
  establishmentSlug?: string;
  onDataChanged: () => void;
}) {
  const qc = useQueryClient();
  const detailFn = useServerFn(getCustomerDetail);
  const stampFn = useServerFn(addStamp);
  const auditFn = useServerFn(getCustomerAudit);
  const { data, isFetching, refetch } = useQuery({
    enabled: !!customerId,
    queryKey: ["customer-detail", customerId],
    queryFn: () => detailFn({ data: { customer_id: customerId! } }),
  });
  const { data: auditData, refetch: refetchAudit } = useQuery({
    enabled: !!customerId,
    queryKey: ["customer-audit", customerId],
    queryFn: () => auditFn({ data: { customer_id: customerId! } }),
  });
  const stampMut = useMutation({
    mutationFn: (cardId: string) => stampFn({ data: { card_id: cardId } }),
    onSuccess: async (r) => {
      toast.success(r.completed ? "🎉 Recompensa desbloqueada!" : `Carimbo adicionado (${r.stamps}/${r.required})`);
      await refetch();
      await refetchAudit();
      qc.invalidateQueries({ queryKey: ["customers-adv"] });
      onDataChanged();
    },
    onError: (e) => {
      const msg = e instanceof Error && e.message ? e.message : "Erro ao carimbar";
      toast.error(msg, { description: "Verifique permissões, PIN e status do cartão." });
    },
  });


  const customer = data?.customer as CustomerRow | undefined;
  const cards = (data?.cards ?? []) as any[];
  const stamps = (data?.stamps ?? []) as any[];
  const rewards = (data?.rewards ?? []) as any[];
  const consents = (data?.consents ?? []) as any[];

  function copyPublicUrl() {
    if (!customer) return;
    const url = `${window.location.origin}/c/${(customer as any).access_token ?? ""}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Link copiado"));
  }

  return (
    <Sheet open={!!customerId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Ficha do cliente</SheetTitle>
          <SheetDescription>Dados, cartões, histórico e consentimentos.</SheetDescription>
        </SheetHeader>

        {isFetching && !customer && <div className="mt-8 text-center text-sm text-muted-foreground">Carregando…</div>}

        {customer && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary font-display font-bold text-lg">
                {initialsOf(customer.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-xl font-bold truncate">{customer.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatPhone(customer.phone)}{customer.email ? ` · ${customer.email}` : ""}
                </div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">código {customer.code}</Badge>
                  {customer.blocked && <Badge variant="destructive" className="text-[10px]">Bloqueado</Badge>}
                  {customer.marketing_opt_in && <Badge variant="secondary" className="text-[10px]">Opt-in</Badge>}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => onEdit(customer)}>
                <Pencil className="h-4 w-4 mr-1" />Editar
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Visitas" value={customer.visits_count} />
              <MiniStat label="Cartões" value={cards.length} />
              <MiniStat label="Recompensas" value={rewards.length} />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={copyPublicUrl}>
                <Copy className="h-4 w-4 mr-1" />Copiar link do cartão
              </Button>
              {establishmentSlug && (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/c/$token" params={{ token: (customer as any).access_token ?? "" }} target="_blank">
                    <ExternalLink className="h-4 w-4 mr-1" />Abrir cartão
                  </Link>
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => window.open(`https://wa.me/55${customer.phone}`, "_blank")}>
                <MessageCircle className="h-4 w-4 mr-1" />WhatsApp
              </Button>
            </div>

            <Tabs defaultValue="cards">
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="cards">Cartões</TabsTrigger>
                <TabsTrigger value="history">Histórico</TabsTrigger>
                <TabsTrigger value="rewards">Recompensas</TabsTrigger>
                <TabsTrigger value="audit">Auditoria</TabsTrigger>
                <TabsTrigger value="info">Detalhes</TabsTrigger>
              </TabsList>


              <TabsContent value="cards" className="space-y-3 mt-3">
                {cards.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Nenhum cartão ativo.</div>}
                {cards.map((card) => {
                  const camp = card.campaigns as { name: string; stamps_required: number; reward_title: string; active: boolean };
                  const pct = Math.min(100, Math.round((card.stamps / Math.max(1, camp.stamps_required)) * 100));
                  return (
                    <div key={card.id} className="rounded-2xl border p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{camp.name}</div>
                          <div className="text-xs text-muted-foreground">Recompensa: {camp.reward_title}</div>
                        </div>
                        <Button size="sm" disabled={stampMut.isPending || customer.blocked || !camp.active}
                                onClick={() => stampMut.mutate(card.id)} className="gradient-brand text-primary-foreground">
                          <StampIcon className="h-4 w-4 mr-1" />
                          {stampMut.isPending ? "..." : "Carimbar"}
                        </Button>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full gradient-brand" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-xs text-muted-foreground flex justify-between">
                        <span>{card.stamps} / {camp.stamps_required} carimbos · ciclo {card.cycle}</span>
                        {!camp.active && <Badge variant="outline" className="text-[10px]">Campanha inativa</Badge>}
                      </div>
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="history" className="mt-3">
                {stamps.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6">Sem carimbos registrados.</div>
                ) : (
                  <div className="divide-y rounded-2xl border">
                    {stamps.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between px-4 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <StampIcon className="h-4 w-4 text-primary" />
                          <span>Carimbo · ciclo {s.cycle}</span>
                          {s.reverted_at && <Badge variant="outline" className="text-[10px]">Estornado</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(s.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="rewards" className="mt-3">
                {rewards.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6">Nenhuma recompensa ainda.</div>
                ) : (
                  <div className="space-y-2">
                    {rewards.map((r: any) => (
                      <div key={r.id} className="rounded-2xl border p-3 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Gift className="h-4 w-4 text-success" />
                          <div>
                            <div className="font-medium">Recompensa ciclo {r.cycle}</div>
                            <div className="text-xs text-muted-foreground">
                              Liberada em {formatDate(r.unlocked_at)}
                              {r.redeemed_at ? ` · Entregue em ${formatDate(r.redeemed_at)}` : r.expires_at ? ` · Expira ${formatDate(r.expires_at)}` : ""}
                            </div>
                          </div>
                        </div>
                        <Badge variant={r.redeemed_at ? "outline" : "secondary"}>{r.redeemed_at ? "Entregue" : "Disponível"}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="audit" className="mt-3">
                <AuditTimeline entries={auditData ?? []} />
              </TabsContent>

              <TabsContent value="info" className="mt-3 space-y-3 text-sm">

                <InfoLine label="Nascimento" value={customer.birthdate ? formatDate(customer.birthdate) : "—"} />
                <InfoLine label="Cadastro" value={formatDate(customer.created_at)} />
                <InfoLine label="Última visita" value={formatDate(customer.last_visit_at)} />
                <InfoLine label="Marketing (LGPD)" value={customer.marketing_opt_in ? "Aceita comunicações" : "Não aceita"} />
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Observações internas</div>
                  <div className="rounded-lg border bg-muted/30 p-3 whitespace-pre-wrap text-sm min-h-[60px]">
                    {customer.notes || <span className="text-muted-foreground">Sem observações.</span>}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Consentimentos</div>
                  {consents.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Nenhum consentimento registrado.</div>
                  ) : (
                    <div className="space-y-1">
                      {consents.map((c: any) => (
                        <div key={c.id} className="text-xs flex justify-between">
                          <span>{c.marketing_opt_in ? "Opt-in marketing" : "Opt-out marketing"}</span>
                          <span className="text-muted-foreground">{formatDate(c.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3 text-center">
      <div className="text-lg font-display font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b py-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-sm">{value}</span>
    </div>
  );
}

function CustomerFormDialog({
  open, initial, establishmentId, campaigns, onClose, onSaved,
}: {
  open: boolean;
  initial: CustomerRow | null;
  establishmentId?: string;
  campaigns: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [notes, setNotes] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [campaignId, setCampaignId] = useState<string>("none");
  const [busy, setBusy] = useState(false);

  // sync when opening
  useMemo(() => {
    if (open) {
      setName(initial?.name ?? "");
      setPhone(initial?.phone ?? "");
      setEmail(initial?.email ?? "");
      setBirthdate(initial?.birthdate ?? "");
      setNotes(initial?.notes ?? "");
      setOptIn(initial?.marketing_opt_in ?? false);
      setCampaignId("none");
    }
  }, [open, initial]);

  async function submit() {
    if (!establishmentId) return;
    if (name.trim().length < 2) { toast.error("Informe o nome"); return; }
    const cleanPhone = phone.replace(/\D/g, "");
    if (!/^\d{10,11}$/.test(cleanPhone)) { toast.error("Telefone inválido (DDD + número)"); return; }
    setBusy(true);
    try {
      if (initial) {
        await updateCustomerRow({ data: {
          customer_id: initial.id, name: name.trim(), phone: cleanPhone,
          email: email.trim(), birthdate, notes, marketing_opt_in: optIn,
        }});
        toast.success("Cliente atualizado");
      } else {
        await createCustomerRow({ data: {
          establishment_id: establishmentId, name: name.trim(), phone: cleanPhone,
          email: email.trim(), birthdate, notes, marketing_opt_in: optIn,
          campaign_id: campaignId === "none" ? undefined : campaignId,
        }});
        toast.success("Cliente cadastrado");
      }
      onSaved(); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>{initial ? "Atualize os dados do cliente." : "Cadastre um cliente na sua base."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome completo *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Telefone *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11999998888" />
            </div>
            <div>
              <Label>Nascimento</Label>
              <Input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} />
          </div>
          {!initial && campaigns.length > 0 && (
            <div>
              <Label>Vincular a uma campanha (opcional)</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não vincular agora</SelectItem>
                  {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Observações internas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={3} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Aceita comunicações de marketing</div>
              <div className="text-xs text-muted-foreground">LGPD · o cliente pode revogar a qualquer momento.</div>
            </div>
            <Switch checked={optIn} onCheckedChange={setOptIn} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy} className="gradient-brand text-primary-foreground">
            {busy ? "Salvando…" : initial ? "Salvar alterações" : "Cadastrar cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Audit timeline ----------
type AuditEntry = {
  id: string; action: string; entity_type: string | null; entity_id: string | null;
  metadata: unknown; user_id: string | null; user_name: string | null; created_at: string;
};

const ACTION_LABEL: Record<string, { label: string; icon: React.ReactNode; className?: string }> = {
  customer_created: { label: "Cliente cadastrado", icon: <UserPlus className="h-4 w-4" />, className: "text-primary" },
  customer_updated: { label: "Dados alterados", icon: <Pencil className="h-4 w-4" /> },
  customer_blocked: { label: "Cliente bloqueado", icon: <ShieldOff className="h-4 w-4" />, className: "text-destructive" },
  customer_unblocked: { label: "Cliente desbloqueado", icon: <ShieldCheck className="h-4 w-4" />, className: "text-success" },
  customer_deleted: { label: "Cliente excluído", icon: <Trash2 className="h-4 w-4" />, className: "text-destructive" },
  stamp_added: { label: "Carimbo adicionado", icon: <StampIcon className="h-4 w-4" />, className: "text-primary" },
  stamp_undone: { label: "Carimbo estornado", icon: <StampIcon className="h-4 w-4" />, className: "text-muted-foreground" },
  reward_redeemed: { label: "Recompensa entregue", icon: <Gift className="h-4 w-4" />, className: "text-success" },
};

function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6">
        <History className="mx-auto h-6 w-6 mb-2 opacity-50" />
        Nenhuma ação registrada ainda.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const cfg = ACTION_LABEL[e.action] ?? { label: e.action, icon: <History className="h-4 w-4" /> };
        const meta = (e.metadata ?? {}) as Record<string, unknown>;
        const parts: string[] = [];
        if (meta.completed) parts.push("Recompensa liberada");
        if (typeof meta.new_stamps === "number") parts.push(`${meta.new_stamps} carimbos`);
        if (meta.bulk) parts.push("ação em lote");
        if (meta.reason) parts.push(String(meta.reason));
        return (
          <div key={e.id} className="rounded-xl border p-3 flex items-start gap-3 text-sm">
            <div className={`mt-0.5 ${cfg.className ?? ""}`}>{cfg.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{cfg.label}</div>
              <div className="text-xs text-muted-foreground">
                {e.user_name || "Sistema"} · {formatDate(e.created_at)}
                {parts.length > 0 && ` · ${parts.join(" · ")}`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- CSV import dialog ----------
type ImportResult = {
  dry_run: boolean; inserted: number;
  summary: { total: number; valid: number; errors: number; duplicates_in_file: number; duplicates_in_db: number };
  preview: {
    errors: { line: number; error: string; raw: Record<string, string> }[];
    duplicates_in_file: { line: number; error: string; raw: Record<string, string> }[];
    duplicates_in_db: { line: number; error: string; raw: Record<string, string> }[];
    sample: Record<string, unknown>[];
  };
};

function ImportCsvDialog({
  open, onClose, establishmentId, campaigns, onImported,
}: {
  open: boolean; onClose: () => void; establishmentId?: string;
  campaigns: Array<{ id: string; name: string }>; onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [campaignId, setCampaignId] = useState<string>("none");
  const [busy, setBusy] = useState(false);
  const importFn = useServerFn(importCustomersCsv);

  function reset() {
    setFile(null); setRows([]); setPreview(null); setCampaignId("none");
  }

  async function handleFile(f: File) {
    setFile(f);
    setPreview(null);
    const text = await f.text();
    const parsed = parseCsv(text);
    if (!parsed.headers.includes("name") || !parsed.headers.includes("phone")) {
      toast.error("O CSV precisa ter pelo menos as colunas: name, phone");
      return;
    }
    setRows(parsed.rows);
  }

  async function runPreview() {
    if (!establishmentId || rows.length === 0) return;
    setBusy(true);
    try {
      const r = await importFn({ data: { establishment_id: establishmentId, rows, dry_run: true } });
      setPreview(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao validar");
    } finally { setBusy(false); }
  }

  async function runImport() {
    if (!establishmentId || rows.length === 0) return;
    setBusy(true);
    try {
      const r = await importFn({ data: {
        establishment_id: establishmentId, rows, dry_run: false,
        campaign_id: campaignId === "none" ? undefined : campaignId,
      }});
      toast.success(`${r.inserted} cliente(s) importado(s)`);
      onImported(); reset(); onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar");
    } finally { setBusy(false); }
  }

  function downloadTemplate() {
    const blob = new Blob(["\ufeff" + CUSTOMER_CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modelo-clientes.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar clientes por CSV</DialogTitle>
          <DialogDescription>
            Colunas suportadas: <code className="text-xs">name, phone, email, birthdate, notes, marketing_opt_in</code>.
            Telefones duplicados no arquivo ou já existentes na base serão ignorados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <Button size="sm" variant="ghost" onClick={downloadTemplate}>Baixar modelo</Button>
          </div>

          {file && rows.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Arquivo: <strong>{file.name}</strong> · {rows.length} linha(s) detectada(s)
            </div>
          )}

          {rows.length > 0 && !preview && (
            <Button onClick={runPreview} disabled={busy} variant="outline">
              {busy ? "Validando…" : "Validar arquivo"}
            </Button>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                <SummaryTile label="Total" value={preview.summary.total} />
                <SummaryTile label="Válidas" value={preview.summary.valid} accent="text-success" />
                <SummaryTile label="Erros" value={preview.summary.errors} accent="text-destructive" />
                <SummaryTile label="Duplicadas" value={preview.summary.duplicates_in_file + preview.summary.duplicates_in_db} accent="text-warning" />
              </div>

              {preview.preview.errors.length > 0 && (
                <ErrorsBlock title="Erros de validação" items={preview.preview.errors} />
              )}
              {preview.preview.duplicates_in_file.length > 0 && (
                <ErrorsBlock title="Duplicadas no arquivo" items={preview.preview.duplicates_in_file} />
              )}
              {preview.preview.duplicates_in_db.length > 0 && (
                <ErrorsBlock title="Já cadastradas na base" items={preview.preview.duplicates_in_db} />
              )}

              {preview.summary.valid > 0 && preview.preview.sample.length > 0 && (
                <div className="rounded-lg border p-3">
                  <div className="text-xs font-medium mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Prévia (primeiros {preview.preview.sample.length})
                  </div>
                  <div className="space-y-1 text-xs">
                    {preview.preview.sample.map((s, i) => (
                      <div key={i} className="flex justify-between border-b py-1 last:border-0">
                        <span className="truncate">{String(s.name)}</span>
                        <span className="text-muted-foreground">{formatPhone(String(s.phone))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {campaigns.length > 0 && (
                <div>
                  <Label>Vincular a uma campanha (opcional)</Label>
                  <Select value={campaignId} onValueChange={setCampaignId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não vincular</SelectItem>
                      {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={busy}>Cancelar</Button>
          {preview && (
            <Button onClick={runImport} disabled={busy || preview.summary.valid === 0} className="gradient-brand text-primary-foreground">
              {busy ? "Importando…" : `Importar ${preview.summary.valid} cliente(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryTile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2">
      <div className={`text-xl font-display font-bold ${accent ?? ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function ErrorsBlock({ title, items }: { title: string; items: { line: number; error: string; raw: Record<string, string> }[] }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <div className="text-xs font-medium mb-2 flex items-center gap-2">
        <FileWarning className="h-4 w-4 text-destructive" />
        {title} ({items.length})
      </div>
      <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
        {items.map((e, i) => (
          <div key={i} className="border-b border-destructive/20 py-1 last:border-0">
            <span className="font-mono text-destructive">L{e.line}</span> · {e.error}
            <div className="text-muted-foreground truncate">
              {[e.raw.name, e.raw.phone, e.raw.email].filter(Boolean).join(" · ")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
