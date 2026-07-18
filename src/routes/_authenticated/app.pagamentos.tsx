import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyPayments } from "@/lib/mercadopago.functions";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ExternalLink, Download, CreditCard, QrCode, FileText } from "lucide-react";
import { downloadCSV } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/app/pagamentos")({
  component: PaymentsPage,
});

const fmtBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const statusColor: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  in_process: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  charged_back: "bg-destructive/15 text-destructive",
};
const statusLabel: Record<string, string> = {
  approved: "Aprovado", pending: "Pendente", in_process: "Em análise",
  rejected: "Recusado", cancelled: "Cancelado", refunded: "Reembolsado", charged_back: "Chargeback",
};
const methodIcon: Record<string, any> = { pix: QrCode, credit_card: CreditCard, boleto: FileText };
const methodLabel: Record<string, string> = { pix: "PIX", credit_card: "Cartão", boleto: "Boleto" };

function PaymentsPage() {
  const getEsts = useServerFn(getMyEstablishments);
  const listFn = useServerFn(listMyPayments);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const activeEst = memberships?.[0]?.establishment as { id: string } | undefined;

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["payments", activeEst?.id, from, to, page],
    queryFn: () => listFn({ data: { establishment_id: activeEst!.id, from: from || undefined, to: to || undefined, page, page_size: 25 } }),
    enabled: !!activeEst?.id,
  });

  const rows = (data?.rows ?? []) as any[];
  const total = data?.total ?? 0;

  function exportCsv() {
    exportToCsv("pagamentos.csv", rows.map(r => ({
      data: new Date(r.created_at).toLocaleString("pt-BR"),
      valor: r.amount,
      metodo: methodLabel[r.method] ?? r.method,
      status: statusLabel[r.status] ?? r.status,
      plano: r.plan_slug ?? "",
      mp_payment_id: r.mp_payment_id ?? "",
    })));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Histórico de pagamentos</h1>
          <p className="text-sm text-muted-foreground">Todas as cobranças da sua assinatura.</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filtrar por período</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><Label>De</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label>Até</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <Button variant="outline" onClick={() => refetch()}>Aplicar</Button>
          <Button variant="ghost" onClick={() => { setFrom(""); setTo(""); }}>Limpar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <div className="grid place-items-center py-16 text-sm text-muted-foreground">Nenhum pagamento encontrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>ID Mercado Pago</TableHead>
                  <TableHead className="text-right">Comprovante</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => {
                  const Icon = methodIcon[r.method] ?? CreditCard;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell><span className="inline-flex items-center gap-2 text-sm"><Icon className="h-4 w-4 text-muted-foreground" />{methodLabel[r.method] ?? r.method}</span></TableCell>
                      <TableCell className="font-medium">{fmtBRL(Number(r.amount))}</TableCell>
                      <TableCell><Badge className={statusColor[r.status] ?? ""} variant="outline">{statusLabel[r.status] ?? r.status}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{r.mp_payment_id ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {r.receipt_url ? (
                          <a href={r.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                            <ExternalLink className="h-3 w-3" />Abrir
                          </a>
                        ) : r.boleto_url ? (
                          <a href={r.boleto_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                            <ExternalLink className="h-3 w-3" />Boleto
                          </a>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > 25 && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Página {page} de {Math.ceil(total / 25)}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page * 25 >= total} onClick={() => setPage(p => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}
