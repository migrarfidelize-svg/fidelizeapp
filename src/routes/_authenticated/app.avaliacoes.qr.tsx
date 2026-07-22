import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { Star, Download, Copy, Share2, FileImage, FileText, Lock, Sparkles } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PromoPoster, FORMATS, type PromoConfig, type PromoFormat } from "@/components/PromoPoster";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { useMyFeature } from "@/hooks/useMyFeature";

export const Route = createFileRoute("/_authenticated/app/avaliacoes/qr")({
  head: () => ({ meta: [{ title: "QR de Avaliação — Fidelize" }] }),
  component: ReviewQrPage,
});

function ReviewQrPage() {
  const getEsts = useServerFn(getMyEstablishments);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as
    | { id: string; name: string; slug: string; primary_color?: string; accent_color?: string; logo_url?: string | null }
    | undefined;

  const { allowed, isLoading: featLoading } = useMyFeature(est?.id, "public_reviews");

  const [format, setFormat] = useState<PromoFormat>("story");
  const [title, setTitle] = useState("Como foi seu atendimento?");
  const [subtitle, setSubtitle] = useState(
    "Sua opinião ajuda nossa equipe a melhorar. Leva menos de 30 segundos e você ainda pode ganhar um cupom.",
  );
  const [ctaNearQR, setCtaNearQR] = useState("Aponte a câmera para avaliar");
  const [ctaFooter, setCtaFooter] = useState("Escaneie e conte pra gente");
  const [primaryColor, setPrimaryColor] = useState("#f59e0b");
  const [accentColor, setAccentColor] = useState("#0ea5e9");
  const [backgroundColor, setBackgroundColor] = useState("#fff8ea");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [exporting, setExporting] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  const publicUrl = est ? `${typeof window !== "undefined" ? window.location.origin : ""}/avaliar/${est.slug}` : "";

  useEffect(() => {
    if (est?.primary_color) setPrimaryColor(est.primary_color);
    if (est?.accent_color) setAccentColor(est.accent_color);
  }, [est?.id, est?.primary_color, est?.accent_color]);

  useEffect(() => {
    if (!publicUrl) return;
    QRCode.toDataURL(publicUrl, {
      width: 1200,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#111827", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [publicUrl]);

  const config: PromoConfig = useMemo(
    () => ({
      format,
      segment: "outro",
      title,
      subtitle,
      ctaNearQR,
      ctaFooter,
      rewardText: "Deixe sua nota e comente. Seu feedback vira melhoria real no atendimento.",
      primaryColor,
      accentColor,
      backgroundColor,
      textColor: "#111827",
      showBrand: true,
      establishmentName: est?.name ?? "Seu estabelecimento",
      logoUrl: est?.logo_url ?? undefined,
      qrDataUrl,
      publicUrl,
      benefits: ["Avaliação em segundos", "Sem baixar aplicativo", "Nota + comentário", "100% anônimo se preferir"],
      qrScale: 1.1,
      qrColor: "#111827",
      cornerStyle: "sharp",
      cornerRadiusPct: 0,
    }),
    [format, title, subtitle, ctaNearQR, ctaFooter, primaryColor, accentColor, backgroundColor, est, qrDataUrl, publicUrl],
  );

  async function exportPng() {
    if (!posterRef.current) return;
    setExporting(true);
    try {
      const url = await toPng(posterRef.current, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-avaliacao-${est?.slug ?? "estabelecimento"}-${format}.png`;
      a.click();
      toast.success("PNG baixado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar PNG");
    } finally {
      setExporting(false);
    }
  }

  async function exportPdf() {
    if (!posterRef.current) return;
    setExporting(true);
    try {
      const url = await toPng(posterRef.current, { pixelRatio: 3, cacheBust: true });
      const f = FORMATS[format];
      const mmW = f.mm?.w ?? 210;
      const mmH = f.mm?.h ?? 297;
      const pdf = new jsPDF({ unit: "mm", format: [mmW, mmH], orientation: mmW > mmH ? "landscape" : "portrait" });
      pdf.addImage(url, "PNG", 0, 0, mmW, mmH);
      pdf.save(`qr-avaliacao-${est?.slug ?? "estabelecimento"}.pdf`);
      toast.success("PDF baixado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar PDF");
    } finally {
      setExporting(false);
    }
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Avalie nosso atendimento", url: publicUrl });
      } else {
        await navigator.clipboard.writeText(publicUrl);
        toast.success("Link copiado");
      }
    } catch {
      /* user cancelled */
    }
  }

  if (!est) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  if (!featLoading && !allowed) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <Card className="border-primary/30">
          <CardContent className="space-y-4 p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-soft">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">QR de avaliação</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Recurso opcional. Faça upgrade para gerar um QR Code dedicado à página pública de avaliações.
              </p>
            </div>
            <ul className="mx-auto max-w-md space-y-1 text-left text-sm text-muted-foreground">
              <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Página pública <code>/avaliar/{est.slug}</code></li>
              <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Cartaz para balcão, recibo e mesa</li>
              <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Inbox de respostas e insights por pergunta</li>
            </ul>
            <Button asChild size="lg" className="mt-2">
              <Link to="/app/planos">Ver planos disponíveis</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHero
        icon={Star}
        eyebrow="Reputação · QR"
        title="QR Code de avaliação"
        subtitle="Cartaz pronto para balcão, mesa e recibos. Encaminha o cliente direto à sua página pública de avaliações."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Controls */}
        <Card>
          <CardContent className="space-y-5 p-5">
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <div className="font-semibold text-foreground">Destino do QR</div>
              <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                <code className="truncate rounded bg-background px-1.5 py-0.5">{publicUrl}</code>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado"); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Formato</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as PromoFormat)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FORMATS) as PromoFormat[]).map((k) => (
                    <SelectItem key={k} value={k}>{FORMATS[k].label} — {FORMATS[k].description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Subtítulo</Label>
              <Textarea value={subtitle} maxLength={220} onChange={(e) => setSubtitle(e.target.value)} rows={3} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Chamada perto do QR</Label>
                <Input value={ctaNearQR} maxLength={60} onChange={(e) => setCtaNearQR(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rodapé</Label>
                <Input value={ctaFooter} maxLength={60} onChange={(e) => setCtaFooter(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Cor principal</Label>
                <Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 p-1" />
              </div>
              <div className="space-y-2">
                <Label>Cor destaque</Label>
                <Input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-10 p-1" />
              </div>
              <div className="space-y-2">
                <Label>Fundo</Label>
                <Input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="h-10 p-1" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={exportPng} disabled={exporting}>
                <FileImage className="mr-2 h-4 w-4" /> Baixar PNG
              </Button>
              <Button onClick={exportPdf} disabled={exporting} variant="outline">
                <FileText className="mr-2 h-4 w-4" /> Baixar PDF
              </Button>
              <Button onClick={share} variant="outline">
                <Share2 className="mr-2 h-4 w-4" /> Compartilhar link
              </Button>
              <Button asChild variant="ghost" className="ml-auto">
                <Link to="/app/avaliacoes">Ver avaliações recebidas →</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <div className="min-w-0">
          <div className="sticky top-4 flex justify-center">
            <div className="max-w-full overflow-auto rounded-2xl border bg-muted/20 p-4">
              <PromoPoster ref={posterRef} config={config} />
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Dica: imprima em A5 para balcão e cole em porta-copo, mesa ou balcão de pagamento. Um QR bem visível dobra a taxa de resposta.
      </p>

      {/* dead references silenced */}
      <span hidden><Download className="hidden" /></span>
    </div>
  );
}
