import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, Info, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCourierWallet, requestCourierWithdrawal } from "@/lib/courier-app.functions";

export const Route = createFileRoute("/_authenticated/entregador/carteira")({
  head: () => ({
    meta: [
      { title: "Carteira do Entregador — Fidelize" },
      { name: "description", content: "Saldo, saques via PIX e histórico de recebimentos do entregador Fidelize." },
      { property: "og:title", content: "Carteira do Entregador — Fidelize" },
      { property: "og:description", content: "Acompanhe seus ganhos e solicite saques em poucos toques." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CourierWallet,
});

const money = (c?: number | null) => `R$ ${((c ?? 0) / 100).toFixed(2).replace(".", ",")}`;

const STATUS: Record<string, string> = {
  requested: "Solicitado",
  processing: "Em processamento",
  paid: "Pago",
  rejected: "Recusado",
};

function CourierWallet() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["courier", "wallet"], queryFn: () => getCourierWallet() });
  const [amount, setAmount] = useState("");
  const [pix, setPix] = useState("");
  const [busy, setBusy] = useState(false);
  const [pixTouched, setPixTouched] = useState(false);

  if (isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">Carregando…</p>;
  if (!data) return <p className="py-16 text-center text-sm text-muted-foreground">Complete seu cadastro primeiro.</p>;

  const pixValue = pixTouched ? pix : (data.pix_key ?? "");
  const cents = Math.round(Number(amount.replace(",", ".") || 0) * 100);

  async function submit() {
    if (!Number.isFinite(cents) || cents < data!.min_cents) {
      return toast.error(`Valor mínimo de saque: ${money(data!.min_cents)}`);
    }
    setBusy(true);
    try {
      const r = await requestCourierWithdrawal({ data: { amount_cents: cents, pix_key: pixValue } });
      toast.success(`Saque solicitado! Taxa ${money(r.fee_cents)} · você recebe ${money(r.net_cents)}.`);
      setAmount("");
      await qc.invalidateQueries({ queryKey: ["courier"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-border bg-card p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Saldo disponível</p>
        <p className="metric-number mt-1 text-3xl">{money(data.balance_cents)}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] text-muted-foreground">
          <div className="rounded-2xl bg-muted/50 p-3">
            <p className="text-sm font-black text-foreground">{data.plan?.name ?? "—"}</p>
            <p>Plano</p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-3">
            <p className="text-sm font-black text-foreground">
              {data.week_count}/{data.week_limit}
            </p>
            <p>Saques na semana</p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-3">
            <p className="text-sm font-black text-foreground">{money(data.next_fee_cents)}</p>
            <p>Taxa do próximo</p>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-black">Solicitar saque</h2>
        </div>
        <div>
          <Label className="text-xs">Valor (R$)</Label>
          <Input
            className="mt-1.5 min-h-[52px] text-lg"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Chave PIX</Label>
          <Input
            className="mt-1.5 min-h-[52px]"
            value={pixValue}
            onChange={(e) => {
              setPixTouched(true);
              setPix(e.target.value);
            }}
          />
        </div>
        <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {data.free_withdrawals_left > 0
            ? `Você ainda tem ${data.free_withdrawals_left} saque(s) sem taxa neste mês.`
            : `Cada saque tem taxa de ${money(data.next_fee_cents)} referente ao custo da transferência PIX.`}
        </p>
        <Button className="min-h-[56px] w-full text-base" disabled={busy} onClick={submit}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <>
              <ArrowDownToLine className="mr-2 h-5 w-5" /> Sacar agora
            </>
          )}
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Histórico</h2>
        {data.withdrawals.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Nenhum saque solicitado ainda.
          </p>
        )}
        {data.withdrawals.map((w: any) => (
          <div key={w.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="min-w-0">
              <p className="text-sm font-bold">{money(w.amount_cents)}</p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(w.created_at).toLocaleDateString("pt-BR")} · taxa {money(w.fee_cents)} · líquido {money(w.net_cents)}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {STATUS[w.status] ?? w.status}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
