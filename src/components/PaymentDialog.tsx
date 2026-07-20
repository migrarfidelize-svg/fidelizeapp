import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  createPixPayment, createCardPayment, createBoletoPayment,
  getPaymentStatus, getMercadoPagoPublicKey, getMercadoPagoAccountHint,
} from "@/lib/mercadopago.functions";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle2, Clock, Loader2, QrCode, CreditCard, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

declare global { interface Window { MercadoPago?: any } }

type PlanInfo = { slug: string; name: string; price_monthly: number; tier: string };

export function PaymentDialog({
  open, onOpenChange, plan, establishmentId, payerEmailDefault,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plan: PlanInfo | null;
  establishmentId: string;
  payerEmailDefault?: string;
}) {
  const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assinar {plan?.name}</DialogTitle>
          <DialogDescription>
            Assinatura mensal — <strong>{plan ? fmt(plan.price_monthly) : "—"}</strong> · Renovação todo mês · Cancele quando quiser.
          </DialogDescription>
        </DialogHeader>

        {plan && (
          <>
          <div className="rounded-md border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
            ⚠️ <strong>Importante:</strong> use um e-mail e CPF/CNPJ <strong>diferentes</strong> dos cadastrados na conta Mercado Pago que recebe os pagamentos. Em credenciais LIVE, o Mercado Pago bloqueia com erro <code>401 Unauthorized use of live credentials</code> quando o titular tenta pagar para si mesmo. Isso vale para PIX, Cartão e Boleto.
          </div>
          <Tabs defaultValue="pix" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pix"><QrCode className="mr-2 h-4 w-4" />PIX</TabsTrigger>
              <TabsTrigger value="card"><CreditCard className="mr-2 h-4 w-4" />Cartão</TabsTrigger>
              <TabsTrigger value="boleto"><FileText className="mr-2 h-4 w-4" />Boleto</TabsTrigger>
            </TabsList>
            <TabsContent value="pix" className="mt-4">
              <PixForm plan={plan} establishmentId={establishmentId} payerEmailDefault={payerEmailDefault} onDone={() => onOpenChange(false)} />
            </TabsContent>
            <TabsContent value="card" className="mt-4">
              <CardForm plan={plan} establishmentId={establishmentId} payerEmailDefault={payerEmailDefault} onDone={() => onOpenChange(false)} />
            </TabsContent>
            <TabsContent value="boleto" className="mt-4">
              <BoletoForm plan={plan} establishmentId={establishmentId} payerEmailDefault={payerEmailDefault} onDone={() => onOpenChange(false)} />
            </TabsContent>
          </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============ PIX ============
function PixForm({ plan, establishmentId, payerEmailDefault, onDone }: { plan: PlanInfo; establishmentId: string; payerEmailDefault?: string; onDone: () => void }) {
  const createFn = useServerFn(createPixPayment);
  const statusFn = useServerFn(getPaymentStatus);
  const qc = useQueryClient();

  const [email, setEmail] = useState(payerEmailDefault ?? "");
  const [doc, setDoc] = useState("");
  const [loading, setLoading] = useState(false);
  const [charge, setCharge] = useState<null | { mp_payment_id: string; qr_code: string | null; qr_code_base64: string | null; expires_at: string }>(null);
  const [status, setStatus] = useState<string>("pending");
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!charge || status === "approved") return;
    const t = setInterval(async () => {
      try {
        const r: any = await statusFn({ data: { mp_payment_id: charge.mp_payment_id } });
        setStatus(r.status);
        if (r.status === "approved") {
          toast.success("Pagamento confirmado! Plano ativado.");
          qc.invalidateQueries();
          setTimeout(onDone, 1200);
        } else if (["rejected","cancelled","refunded"].includes(r.status)) {
          toast.error(`Pagamento ${r.status}. ${r.status_detail ?? ""}`);
        }
      } catch { /* ignore transient */ }
    }, 4000);
    return () => clearInterval(t);
  }, [charge, status, statusFn, qc, onDone]);

  useEffect(() => {
    if (!charge) return;
    const end = new Date(charge.expires_at).getTime();
    const tick = () => setRemaining(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [charge]);

  async function create() {
    setLoading(true);
    try {
      const r: any = await createFn({ data: { establishment_id: establishmentId, plan_slug: plan.slug, payer_email: email || undefined, payer_doc: doc || undefined } });
      setCharge({ mp_payment_id: r.mp_payment_id, qr_code: r.qr_code, qr_code_base64: r.qr_code_base64, expires_at: r.expires_at });
      setStatus(r.status);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar PIX");
    } finally {
      setLoading(false);
    }
  }

  if (!charge) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>E-mail do pagador</Label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@empresa.com" />
        </div>
        <div className="space-y-2">
          <Label>CPF/CNPJ (opcional)</Label>
          <Input value={doc} onChange={e => setDoc(e.target.value)} placeholder="Apenas números" />
        </div>
        <p className="text-xs text-muted-foreground">
          Use um e-mail <strong>diferente</strong> do titular da conta Mercado Pago que recebe. Em credenciais LIVE, o dono da conta não pode pagar para si mesmo.
        </p>
        <Button className="w-full gradient-brand text-primary-foreground" onClick={create} disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando QR Code…</> : "Gerar QR Code PIX"}
        </Button>
      </div>
    );
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant={status === "approved" ? "default" : "secondary"} className="text-sm">
          {status === "approved" ? <><CheckCircle2 className="mr-1 h-3 w-3" />Aprovado</> :
           status === "pending" ? <><Clock className="mr-1 h-3 w-3" />Aguardando pagamento</> : status}
        </Badge>
        <span className="text-sm text-muted-foreground">Expira em {mm}:{ss}</span>
      </div>

      {charge.qr_code_base64 && (
        <div className="flex justify-center rounded-lg border bg-white p-4">
          <img alt="QR Code PIX" src={`data:image/png;base64,${charge.qr_code_base64}`} className="h-64 w-64 object-contain" />
        </div>
      )}

      <div className="space-y-2">
        <Label>PIX Copia e Cola</Label>
        <div className="flex gap-2">
          <Input readOnly value={charge.qr_code ?? ""} className="font-mono text-xs" />
          <Button variant="outline" size="icon" aria-label="Copiar código PIX" onClick={() => { navigator.clipboard.writeText(charge.qr_code ?? ""); toast.success("Copiado!"); }}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        A confirmação é automática assim que o banco enviar o retorno (em geral em segundos).
      </p>
    </div>
  );
}

// ============ Cartão ============
function CardForm({ plan, establishmentId, payerEmailDefault, onDone }: { plan: PlanInfo; establishmentId: string; payerEmailDefault?: string; onDone: () => void }) {
  const createFn = useServerFn(createCardPayment);
  const statusFn = useServerFn(getPaymentStatus);
  const publicKeyFn = useServerFn(getMercadoPagoPublicKey);
  const qc = useQueryClient();

  const [sdkReady, setSdkReady] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [mpInstance, setMpInstance] = useState<any>(null);
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [installments, setInstallments] = useState("1");
  const [email, setEmail] = useState(payerEmailDefault ?? "");
  const [doc, setDoc] = useState("");
  const [docType, setDocType] = useState<"CPF"|"CNPJ">("CPF");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r: any = await publicKeyFn();
      if (!r.public_key) return;
      setPublicKey(r.public_key);
      if (!document.getElementById("mp-sdk-v2")) {
        const s = document.createElement("script");
        s.id = "mp-sdk-v2";
        s.src = "https://sdk.mercadopago.com/js/v2";
        s.async = true;
        s.onload = () => setSdkReady(true);
        document.head.appendChild(s);
      } else {
        setSdkReady(true);
      }
    })();
  }, [publicKeyFn]);

  useEffect(() => {
    if (sdkReady && publicKey && window.MercadoPago) {
      setMpInstance(new window.MercadoPago(publicKey, { locale: "pt-BR" }));
    }
  }, [sdkReady, publicKey]);

  // polling if payment is pending after submit
  useEffect(() => {
    if (!paymentId || status === "approved") return;
    const t = setInterval(async () => {
      try {
        const r: any = await statusFn({ data: { mp_payment_id: paymentId } });
        setStatus(r.status);
        if (r.status === "approved") { toast.success("Pagamento aprovado! Plano ativado."); qc.invalidateQueries(); setTimeout(onDone, 1200); }
        else if (["rejected","cancelled"].includes(r.status)) toast.error(`Pagamento ${r.status}.`);
      } catch {}
    }, 3000);
    const stop = setTimeout(() => clearInterval(t), 60_000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [paymentId, status, statusFn, qc, onDone]);

  async function submit() {
    if (!mpInstance) { toast.error("SDK Mercado Pago não carregado. Verifique se a Public Key foi configurada em /admin/pagamentos."); return; }
    const cleanNumber = number.replace(/\s+/g, "");
    const [expMonth, expYearShort] = exp.split("/").map(s => s.trim());
    if (!cleanNumber || !expMonth || !expYearShort || !cvv || !name) { toast.error("Preencha os dados do cartão."); return; }
    setLoading(true);
    try {
      // Tokenização no browser — dados do cartão nunca chegam ao backend
      const token = await mpInstance.createCardToken({
        cardNumber: cleanNumber,
        cardholderName: name,
        cardExpirationMonth: expMonth,
        cardExpirationYear: expYearShort.length === 2 ? `20${expYearShort}` : expYearShort,
        securityCode: cvv,
        identificationType: docType,
        identificationNumber: doc.replace(/\D/g, ""),
      });
      if (!token?.id) throw new Error(token?.error ?? "Falha ao tokenizar cartão");

      // Descobre payment_method_id (bandeira) via BIN
      const bin = cleanNumber.slice(0, 8);
      const pm = await mpInstance.getPaymentMethods({ bin });
      const methodId = pm?.results?.[0]?.id ?? "visa";
      const issuerId = pm?.results?.[0]?.issuer?.id ? String(pm.results[0].issuer.id) : undefined;

      const r: any = await createFn({ data: {
        establishment_id: establishmentId,
        plan_slug: plan.slug,
        token: token.id,
        payment_method_id: methodId,
        issuer_id: issuerId,
        installments: Number(installments),
        payer_email: email,
        payer_doc_type: docType,
        payer_doc_number: doc,
      }});
      setPaymentId(r.mp_payment_id);
      setStatus(r.status);
      setStatusDetail(r.status_detail);
      if (r.status === "approved") {
        toast.success("Pagamento aprovado!");
        qc.invalidateQueries();
        setTimeout(onDone, 1200);
      } else if (r.status === "in_process") {
        toast.info("Pagamento em análise. Aguardando confirmação…");
      } else if (r.status === "rejected") {
        toast.error(`Cartão recusado: ${translateDetail(r.status_detail)}`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no pagamento");
    } finally {
      setLoading(false);
    }
  }

  if (status === "approved") {
    return <div className="text-center py-8"><CheckCircle2 className="mx-auto h-12 w-12 text-primary" /><p className="mt-2 font-semibold">Pagamento aprovado!</p></div>;
  }

  return (
    <div className="space-y-3">
      {!publicKey && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Public Key do Mercado Pago não configurada. Peça ao Super Administrador para configurar em /admin/pagamentos.
        </div>
      )}
      <div className="space-y-2">
        <Label>Nome impresso no cartão</Label>
        <Input value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="COMO IMPRESSO" />
      </div>
      <div className="space-y-2">
        <Label>Número do cartão</Label>
        <Input value={number} onChange={e => setNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" inputMode="numeric" maxLength={19} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Validade (MM/AA)</Label><Input value={exp} onChange={e => setExp(formatExp(e.target.value))} placeholder="MM/AA" maxLength={5} /></div>
        <div className="space-y-2"><Label>CVV</Label><Input value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Parcelas</Label>
          <Select value={installments} onValueChange={setInstallments}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1,2,3,6,12].map(i => <SelectItem key={i} value={String(i)}>{i}x de {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(plan.price_monthly / i)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tipo doc</Label>
          <Select value={docType} onValueChange={v => setDocType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="CPF">CPF</SelectItem><SelectItem value="CNPJ">CNPJ</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={doc} onChange={e => setDoc(e.target.value)} placeholder="Apenas números" /></div>
        <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
      </div>

      {statusDetail && status !== "approved" && (
        <div className="rounded-md bg-muted p-2 text-xs text-muted-foreground">Status: {status} — {translateDetail(statusDetail)}</div>
      )}

      <Button className="w-full gradient-brand text-primary-foreground" onClick={submit} disabled={loading || !mpInstance}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando…</> : `Pagar ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(plan.price_monthly)}`}
      </Button>
      <p className="text-[10px] text-center text-muted-foreground">Dados do cartão tokenizados pelo SDK oficial do Mercado Pago. Nada trafega em texto puro.</p>
    </div>
  );
}

function formatCardNumber(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 16);
  return d.replace(/(.{4})/g, "$1 ").trim();
}
function formatExp(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length >= 3 ? `${d.slice(0,2)}/${d.slice(2)}` : d;
}
function translateDetail(d?: string | null): string {
  const map: Record<string, string> = {
    cc_rejected_insufficient_amount: "Saldo insuficiente",
    cc_rejected_bad_filled_card_number: "Número do cartão inválido",
    cc_rejected_bad_filled_date: "Validade inválida",
    cc_rejected_bad_filled_security_code: "CVV inválido",
    cc_rejected_bad_filled_other: "Dados inválidos",
    cc_rejected_call_for_authorize: "Autorize a compra com o banco emissor",
    cc_rejected_high_risk: "Recusado por prevenção a fraude",
    cc_rejected_other_reason: "Recusado pelo emissor",
    pending_contingency: "Em análise",
    pending_review_manual: "Em análise manual",
    accredited: "Aprovado",
  };
  return d ? (map[d] ?? d) : "";
}

// ============ Boleto ============
function BoletoForm({ plan, establishmentId, payerEmailDefault, onDone }: { plan: PlanInfo; establishmentId: string; payerEmailDefault?: string; onDone: () => void }) {
  const createFn = useServerFn(createBoletoPayment);
  const [email, setEmail] = useState(payerEmailDefault ?? "");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [doc, setDoc] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | { boleto_url: string | null; expires_at: string; mp_payment_id: string }>(null);

  async function submit() {
    if (!email || !first || !last || !doc) { toast.error("Preencha todos os campos."); return; }
    setLoading(true);
    try {
      const r: any = await createFn({ data: { establishment_id: establishmentId, plan_slug: plan.slug, payer_email: email, payer_first_name: first, payer_last_name: last, payer_doc_number: doc } });
      setResult({ boleto_url: r.boleto_url, expires_at: r.expires_at, mp_payment_id: r.mp_payment_id });
      toast.success("Boleto gerado!");
    } catch (e: any) { toast.error(e?.message ?? "Falha ao gerar boleto"); }
    finally { setLoading(false); }
  }

  if (result) {
    return (
      <div className="space-y-4 text-center">
        <FileText className="mx-auto h-12 w-12 text-primary" />
        <p className="font-semibold">Boleto gerado!</p>
        <p className="text-sm text-muted-foreground">Vence em {new Date(result.expires_at).toLocaleDateString("pt-BR")}</p>
        {result.boleto_url && <a href={result.boleto_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground"><ExternalLink className="h-4 w-4" />Abrir boleto</a>}
        <p className="text-xs text-muted-foreground">Após o pagamento, a compensação leva até 3 dias úteis. O plano será ativado automaticamente.</p>
        <Button variant="outline" onClick={onDone} className="w-full">Fechar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Nome</Label><Input value={first} onChange={e => setFirst(e.target.value)} /></div>
        <div className="space-y-2"><Label>Sobrenome</Label><Input value={last} onChange={e => setLast(e.target.value)} /></div>
      </div>
      <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
      <div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={doc} onChange={e => setDoc(e.target.value)} placeholder="Apenas números" /></div>
      <Button className="w-full gradient-brand text-primary-foreground" onClick={submit} disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando…</> : "Gerar boleto"}
      </Button>
    </div>
  );
}
