import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { createAsaasPayment } from "@/lib/asaas.functions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Loader2, QrCode, CreditCard, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type PlanInfo = { slug: string; name: string; price_monthly: number; tier: string };

type ChargeResult = {
  id: string;
  status: string;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  pixQrCodeBase64: string | null;
  pixCopyPaste: string | null;
};

export function AsaasPaymentTabs({
  plan, establishmentId, payerEmailDefault, isSandboxLike, onDone,
}: {
  plan: PlanInfo;
  establishmentId: string;
  payerEmailDefault?: string;
  isSandboxLike: boolean;
  onDone: () => void;
}) {
  return (
    <Tabs defaultValue="pix" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="pix"><QrCode className="mr-2 h-4 w-4" />PIX</TabsTrigger>
        <TabsTrigger value="card"><CreditCard className="mr-2 h-4 w-4" />Cartão</TabsTrigger>
        <TabsTrigger value="boleto"><FileText className="mr-2 h-4 w-4" />Boleto</TabsTrigger>
      </TabsList>
      <TabsContent value="pix" className="mt-4">
        <AsaasForm billingType="PIX" plan={plan} establishmentId={establishmentId} payerEmailDefault={payerEmailDefault} isSandboxLike={isSandboxLike} onDone={onDone} />
      </TabsContent>
      <TabsContent value="card" className="mt-4">
        <AsaasForm billingType="CREDIT_CARD" plan={plan} establishmentId={establishmentId} payerEmailDefault={payerEmailDefault} isSandboxLike={isSandboxLike} onDone={onDone} />
      </TabsContent>
      <TabsContent value="boleto" className="mt-4">
        <AsaasForm billingType="BOLETO" plan={plan} establishmentId={establishmentId} payerEmailDefault={payerEmailDefault} isSandboxLike={isSandboxLike} onDone={onDone} />
      </TabsContent>
    </Tabs>
  );
}

function AsaasForm({
  billingType, plan, establishmentId, payerEmailDefault, isSandboxLike, onDone,
}: {
  billingType: "PIX" | "CREDIT_CARD" | "BOLETO";
  plan: PlanInfo;
  establishmentId: string;
  payerEmailDefault?: string;
  isSandboxLike: boolean;
  onDone: () => void;
}) {
  const createFn = useServerFn(createAsaasPayment);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(payerEmailDefault ?? "");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCcv, setCardCcv] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChargeResult | null>(null);

  async function submit() {
    if (!name.trim() || name.trim().length < 2) return toast.error("Informe o nome do pagador.");
    if (!email.trim()) return toast.error("Informe o e-mail do pagador.");
    const doc = cpfCnpj.replace(/\D/g, "");
    if (!doc || (doc.length !== 11 && doc.length !== 14)) return toast.error("Informe um CPF (11 dígitos) ou CNPJ (14).");
    if (billingType === "CREDIT_CARD") {
      const [mm, yy] = cardExp.split("/").map((v) => v.trim());
      if (!cardNumber || !cardHolder || !mm || !yy || !cardCcv) return toast.error("Preencha todos os dados do cartão.");
    }
    setLoading(true);
    try {
      const [mm, yy] = billingType === "CREDIT_CARD" ? cardExp.split("/").map((v) => v.trim()) : ["", ""];
      const r = (await createFn({
        data: {
          planSlug: plan.slug,
          establishmentId,
          billingType,
          payer: { name: name.trim(), email: email.trim(), cpfCnpj: doc, phone: phone.trim() || undefined },
          card: billingType === "CREDIT_CARD" ? {
            holderName: cardHolder.trim(),
            number: cardNumber.replace(/\s+/g, ""),
            expiryMonth: mm,
            expiryYear: yy.length === 2 ? `20${yy}` : yy,
            ccv: cardCcv.trim(),
          } : undefined,
        },
      })) as ChargeResult;
      setResult(r);
      qc.invalidateQueries();
      if (billingType === "CREDIT_CARD" && (r.status === "CONFIRMED" || r.status === "RECEIVED")) {
        toast.success("Pagamento aprovado! Plano ativado.");
        setTimeout(onDone, 1200);
      } else {
        toast.success(billingType === "PIX" ? "PIX gerado!" : billingType === "BOLETO" ? "Boleto gerado!" : "Cobrança criada!");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar cobrança.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-sm">Status: {result.status}</Badge>
          {result.invoiceUrl && (
            <a className="inline-flex items-center gap-1 text-sm text-primary hover:underline" href={result.invoiceUrl} target="_blank" rel="noreferrer">
              Ver fatura <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        {billingType === "PIX" && result.pixQrCodeBase64 && (
          <div className="flex justify-center rounded-lg border bg-white p-4">
            <img alt="QR Code PIX" src={result.pixQrCodeBase64} className="h-64 w-64 object-contain" />
          </div>
        )}
        {billingType === "PIX" && result.pixCopyPaste && (
          <div className="space-y-2">
            <Label>PIX Copia e Cola</Label>
            <div className="flex gap-2">
              <Input readOnly value={result.pixCopyPaste} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(result.pixCopyPaste ?? ""); toast.success("Copiado!"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {billingType === "BOLETO" && result.bankSlipUrl && (
          <Button asChild className="w-full"><a href={result.bankSlipUrl} target="_blank" rel="noreferrer">Abrir boleto</a></Button>
        )}
        <p className="text-xs text-muted-foreground text-center">Confirmação automática via webhook Asaas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isSandboxLike && (
        <div className="rounded-md border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
          Asaas em <strong>Sandbox</strong>. Use CPF/CNPJ de teste (ex.: <code>24971563792</code>) e cartão <code>5162 3062 5100 3095</code> · <code>12/28</code> · <code>318</code>.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label>Nome completo</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1"><Label>E-mail</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1"><Label>CPF/CNPJ</Label><Input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} placeholder="Apenas números" /></div>
        <div className="space-y-1"><Label>Telefone (opcional)</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      </div>
      {billingType === "CREDIT_CARD" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label>Número do cartão</Label><Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="0000 0000 0000 0000" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Nome impresso no cartão</Label><Input value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} /></div>
          <div className="space-y-1"><Label>Validade (MM/AA)</Label><Input value={cardExp} onChange={(e) => setCardExp(e.target.value)} placeholder="12/28" /></div>
          <div className="space-y-1"><Label>CVV</Label><Input value={cardCcv} onChange={(e) => setCardCcv(e.target.value)} /></div>
        </div>
      )}
      <Button className="w-full gradient-brand text-primary-foreground" onClick={submit} disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando…</> : billingType === "PIX" ? "Gerar PIX" : billingType === "BOLETO" ? "Gerar boleto" : "Pagar com cartão"}
      </Button>
    </div>
  );
}
