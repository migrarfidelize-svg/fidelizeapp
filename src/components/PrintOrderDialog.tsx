import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Printer, Loader2, CheckCircle2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { submitPrintOrder } from "@/lib/poster-designs.functions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  establishmentId: string;
  establishmentSlug: string;
  format: string;
  /** Return the current poster as a PNG blob (used to fabricate a PDF preview). */
  getPngBlob: () => Promise<Blob | null>;
  /** Return the SVG QR text for a bonus vector attachment. */
  getSvgBlob: () => Promise<Blob | null>;
}

type Step = "form" | "uploading" | "done";

export function PrintOrderDialog(props: Props) {
  const submit = useServerFn(submitPrintOrder);

  const [step, setStep] = useState<Step>("form");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const [quantity, setQuantity] = useState(50);
  const [paper, setPaper] = useState("couche-300g");
  const [finish, setFinish] = useState("fosco");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!line1.trim() || !city.trim() || !state.trim() || !postalCode.trim()) {
      toast.error("Preencha o endereço de entrega completo.");
      return;
    }
    if (!contactEmail.trim() || !contactPhone.trim()) {
      toast.error("Informe e-mail e telefone de contato.");
      return;
    }
    setSubmitting(true);
    setStep("uploading");
    try {
      // 1) Export artifacts and upload to poster-print-orders/{est_id}/{stamp}/
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const basePath = `${props.establishmentId}/${stamp}`;
      let pdfPath: string | undefined;
      let svgPath: string | undefined;

      const png = await props.getPngBlob();
      if (png) {
        const p = `${basePath}/poster.png`;
        const { error } = await supabase.storage
          .from("poster-print-orders")
          .upload(p, png, { contentType: "image/png", upsert: false });
        if (!error) pdfPath = p;
      }
      const svg = await props.getSvgBlob();
      if (svg) {
        const p = `${basePath}/qr.svg`;
        const { error } = await supabase.storage
          .from("poster-print-orders")
          .upload(p, svg, { contentType: "image/svg+xml", upsert: false });
        if (!error) svgPath = p;
      }

      // 2) Create the order row
      const res = await submit({
        data: {
          establishmentId: props.establishmentId,
          quantity,
          paper,
          finish,
          format: props.format,
          shippingAddress: {
            line1: line1.trim(),
            city: city.trim(),
            state: state.trim().toUpperCase().slice(0, 2),
            postalCode: postalCode.trim(),
            country: "BR",
          },
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          notes: notes.trim() || undefined,
          pdfPath,
          svgPath,
        },
      });
      setOrderNumber(res.order_number);
      setStep("done");
      toast.success(`Pedido ${res.order_number} enviado à gráfica parceira`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar pedido");
      setStep("form");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose(v: boolean) {
    if (submitting) return;
    props.onOpenChange(v);
    if (!v) {
      setTimeout(() => {
        setStep("form");
        setOrderNumber(null);
      }, 300);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-4 w-4" /> Enviar para gráfica parceira
          </DialogTitle>
          <DialogDescription>
            Enviamos o arquivo pronto para a gráfica parceira. Você recebe cotação e prazo por e-mail em até 1 dia útil.
          </DialogDescription>
        </DialogHeader>

        {step === "done" && orderNumber && (
          <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <div className="text-sm font-semibold">Pedido enviado</div>
            <div className="text-xs text-muted-foreground">Número do pedido</div>
            <div className="font-mono text-lg font-bold tracking-widest">{orderNumber}</div>
            <p className="text-[11px] text-muted-foreground">
              A gráfica parceira entrará em contato pelo e-mail informado com cotação, prazo e forma de pagamento.
            </p>
          </div>
        )}

        {step !== "done" && (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  min={10}
                  max={10000}
                  step={10}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(10, Math.min(10000, Number(e.target.value) || 10)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Papel</Label>
                <Select value={paper} onValueChange={setPaper}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="couche-150g">Couché 150g</SelectItem>
                    <SelectItem value="couche-300g">Couché 300g</SelectItem>
                    <SelectItem value="adesivo-vinil">Adesivo vinil</SelectItem>
                    <SelectItem value="pvc-1mm">PVC 1mm rígido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Acabamento</Label>
                <Select value={finish} onValueChange={setFinish}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fosco">Laminação fosca</SelectItem>
                    <SelectItem value="brilho">Laminação brilho</SelectItem>
                    <SelectItem value="nenhum">Sem laminação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Formato</Label>
                <Input value={props.format} disabled className="text-xs" />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-[11px] text-muted-foreground">
              O PDF/PNG anexado usa 300 DPI. Sangria e marcas de corte conforme a sua configuração atual do editor.
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Endereço de entrega</Label>
              <Input placeholder="Rua, número, complemento" value={line1} onChange={(e) => setLine1(e.target.value)} />
              <div className="grid grid-cols-[1fr_80px_100px] gap-2">
                <Input placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
                <Input placeholder="UF" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} />
                <Input placeholder="CEP" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail para cotação</Label>
                <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone/WhatsApp</Label>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Observações (opcional)</Label>
              <Textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: precisa chegar até dia X, prefiro couché mais espesso..." />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "done" ? (
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => handleClose(false)} disabled={submitting}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                Enviar pedido
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
