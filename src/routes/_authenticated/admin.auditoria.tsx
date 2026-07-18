import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListAuditLogs } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileClock } from "lucide-react";
import { downloadCSV, downloadPDF } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  component: AdminAuditoria,
});

const ACTION_LABEL: Record<string, string> = {
  admin_block: "Bloqueou empresa",
  admin_unblock: "Desbloqueou empresa",
  admin_change_plan: "Alterou plano",
  admin_delete_establishment: "Excluiu empresa",
  admin_report_payment_failure: "Reportou falha de pagamento",
};

function AdminAuditoria() {
  const fn = useServerFn(adminListAuditLogs);
  const { data, isLoading } = useQuery({ queryKey: ["admin-audit"], queryFn: () => fn({ data: { limit: 200 } }) });

  function exportCSV() {
    const rows = (data ?? []).map(l => [
      new Date(l.created_at).toLocaleString("pt-BR"),
      ACTION_LABEL[l.action] ?? l.action,
      l.actor_name ?? "—",
      l.establishment?.name ?? "—",
      l.establishment?.slug ?? "",
      JSON.stringify(l.metadata ?? {}),
    ]);
    downloadCSV(`fidelize-auditoria-${new Date().toISOString().slice(0,10)}.csv`,
      ["Data","Ação","Responsável","Empresa","Slug","Metadados"], rows);
  }
  function exportPDF() {
    const rows = (data ?? []).map(l => [
      new Date(l.created_at).toLocaleString("pt-BR"),
      ACTION_LABEL[l.action] ?? l.action,
      l.actor_name ?? "—",
      l.establishment?.name ?? "—",
    ]);
    downloadPDF(`fidelize-auditoria-${new Date().toISOString().slice(0,10)}.pdf`, "Auditoria — Fidelize",
      ["Data","Ação","Responsável","Empresa"], rows,
      `Gerado em ${new Date().toLocaleString("pt-BR")} · ${(data ?? []).length} registros`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Administração</div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2"><FileClock className="h-6 w-6" /> Auditoria</h1>
          <p className="text-sm text-muted-foreground mt-1">Todas as ações administrativas, com data e responsável.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={exportPDF}><Download className="mr-2 h-4 w-4" />PDF</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && <div className="p-6 text-sm text-muted-foreground">Carregando…</div>}
          {!isLoading && (data?.length ?? 0) === 0 && <div className="p-8 text-sm text-muted-foreground text-center">Sem registros.</div>}
          <div className="divide-y">
            {(data ?? []).map((l) => (
              <div key={l.id} className="flex items-start gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm"><span className="font-semibold">{ACTION_LABEL[l.action] ?? l.action}</span> · <span className="text-muted-foreground">{l.actor_name ?? "—"}</span></div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                    {l.establishment && <> · <span className="font-medium text-foreground">{l.establishment.name}</span></>}
                  </div>
                  {l.metadata && Object.keys(l.metadata).length > 0 && (
                    <pre className="mt-1 text-[11px] text-muted-foreground overflow-x-auto">{JSON.stringify(l.metadata)}</pre>
                  )}
                </div>
                {l.establishment && l.action !== "admin_delete_establishment" && (l.establishment_id || l.entity_id) && (
                  <Button asChild variant="ghost" size="sm"><Link to="/admin/empresa/$id" params={{ id: (l.establishment_id ?? l.entity_id)! }}><ExternalLink className="h-4 w-4" /></Link></Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
