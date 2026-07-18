import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyEstablishments, getEstablishmentCampaigns } from "@/lib/loyalty.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Download, Share2, FileImage, FileText, Printer, Palette, Settings2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { toPng, toJpeg } from "html-to-image";
import { jsPDF } from "jspdf";
import { PromoPoster, FORMATS, SEGMENT_LABEL, type PromoConfig, type PromoFormat, type Segment } from "@/components/PromoPoster";

export const Route = createFileRoute("/_authenticated/app/qrcodes")({
  head: () => ({ meta: [{ title: "Divulgação — Fidelize" }] }),
  component: QRCodes,
});

const SEGMENT_DEFAULTS: Record<Segment, { primary: string; accent: string; bg: string }> = {
  espetinhos: { primary: "#c1121f", accent: "#f77f00", bg: "#fff8f0" },
  cafeteria: { primary: "#6f4e37", accent: "#c19a6b", bg: "#fdf6ec" },
  barbearia: { primary: "#1f2937", accent: "#d4a017", bg: "#f5f3ef" },
  petshop: { primary: "#2563eb", accent: "#f59e0b", bg: "#eff6ff" },
  lavajato: { primary: "#0284c7", accent: "#38bdf8", bg: "#f0f9ff" },
  salao: { primary: "#be185d", accent: "#f472b6", bg: "#fdf2f8" },
  restaurante: { primary: "#b91c1c", accent: "#f59e0b", bg: "#fff7ed" },
  oficina: { primary: "#1f2937", accent: "#f97316", bg: "#f3f4f6" },
  loja: { primary: "#7c3aed", accent: "#22d3ee", bg: "#f5f3ff" },
  outro: { primary: "#7c3aed", accent: "#f472b6", bg: "#faf5ff" },
};

function QRCodes() {
  const getEsts = useServerFn(getMyEstablishments);
  const getCampaigns = useServerFn(getEstablishmentCampaigns);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as any | undefined;

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns", est?.id],
    queryFn: () => getCampaigns({ data: { establishment_id: est!.id } }),
    enabled: !!est?.id,
  });

  const activeCampaign = campaigns?.find((c) => c.active) ?? campaigns?.[0];

  const publicUrl = est ? `${typeof window !== "undefined" ? window.location.origin : ""}/l/${est.slug}` : "";
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const [format, setFormat] = useState<PromoFormat>("poster");
  const [segment, setSegment] = useState<Segment>("espetinhos");
  const [title, setTitle] = useState("Ganhe recompensas a cada visita!");
  const [subtitle, setSubtitle] = useState("Escaneie o QR Code, crie seu cartão fidelidade digital e comece a acumular carimbos. É rápido, gratuito e não precisa baixar aplicativo.");
  const [ctaNearQR, setCtaNearQR] = useState("Aponte a câmera e participe");
  const [ctaFooter, setCtaFooter] = useState("Escaneie e participe agora");
  const [rewardTextOverride, setRewardTextOverride] = useState("");
  const [primaryColor, setPrimaryColor] = useState<string>(est?.primary_color ?? SEGMENT_DEFAULTS.espetinhos.primary);
  const [accentColor, setAccentColor] = useState<string>(est?.accent_color ?? SEGMENT_DEFAULTS.espetinhos.accent);
  const [backgroundColor, setBackgroundColor] = useState<string>(SEGMENT_DEFAULTS.espetinhos.bg);
  const [textColor, setTextColor] = useState<string>("#111827");
  const [showBrand, setShowBrand] = useState(true);
  const [exporting, setExporting] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  // Adopt establishment brand colors once loaded
  useEffect(() => {
    if (est) {
      if (est.primary_color) setPrimaryColor(est.primary_color);
      if (est.accent_color) setAccentColor(est.accent_color);
    }
  }, [est?.id]);

  // Generate QR data URL — recolour to primary
  useEffect(() => {
    if (!publicUrl) return;
    QRCode.toDataURL(publicUrl, {
      width: 1200,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: primaryColor, light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [publicUrl, primaryColor]);

  const rewardText = useMemo(() => {
    if (rewardTextOverride.trim()) return rewardTextOverride.trim();
    if (!activeCampaign) return "Complete carimbos e ganhe uma recompensa exclusiva.";
    return `Complete ${activeCampaign.stamps_required} carimbos e ganhe ${activeCampaign.reward_title.toLowerCase()}.`;
  }, [rewardTextOverride, activeCampaign]);

  const contactLine = useMemo(() => {
    if (!est) return undefined;
    return [est.instagram && `@${est.instagram.replace("@", "")}`, est.whatsapp, est.address].filter(Boolean).join(" · ") || undefined;
  }, [est]);

  const config: PromoConfig = {
    format,
    segment,
    title,
    subtitle,
    ctaNearQR,
    ctaFooter,
    rewardText,
    primaryColor,
    accentColor,
    backgroundColor,
    textColor,
    showBrand,
    establishmentName: est?.name ?? "Seu estabelecimento",
    logoUrl: est?.logo_url,
    qrDataUrl,
    publicUrl,
    benefits: ["Cartão sempre no celular", "Nenhum aplicativo necessário", "Recompensas exclusivas", "Cadastro em segundos"],
    contactLine,
  };

  const dims = FORMATS[format];

  // Fit-preview scale
  const [previewScale, setPreviewScale] = useState(0.35);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function fit() {
      if (!previewWrapRef.current) return;
      const rect = previewWrapRef.current.getBoundingClientRect();
      const pad = 24;
      const sx = (rect.width - pad) / dims.w;
      const sy = (rect.height - pad) / dims.h;
      setPreviewScale(Math.max(0.08, Math.min(sx, sy)));
    }
    fit();
    const ro = new ResizeObserver(fit);
    if (previewWrapRef.current) ro.observe(previewWrapRef.current);
    window.addEventListener("resize", fit);
    return () => { ro.disconnect(); window.removeEventListener("resize", fit); };
  }, [dims.w, dims.h]);

  async function withCapture(cb: (dataUrl: string) => Promise<void> | void, type: "png" | "jpeg" = "png") {
    if (!posterRef.current) return;
    try {
      setExporting(true);
      const opts = { pixelRatio: 1, cacheBust: true, backgroundColor: type === "jpeg" ? "#ffffff" : undefined };
      const dataUrl = type === "png" ? await toPng(posterRef.current, opts) : await toJpeg(posterRef.current, { ...opts, quality: 0.95 });
      await cb(dataUrl);
    } catch (e: any) {
      toast.error("Falha ao gerar arte: " + (e?.message ?? "erro"));
    } finally {
      setExporting(false);
    }
  }

  const fileBase = `${est?.slug ?? "fidelize"}-${format}`;

  function downloadDataUrl(dataUrl: string, filename: string) {
    const a = document.createElement("a");
    a.href = dataUrl; a.download = filename; a.click();
  }

  async function exportPNG() { await withCapture((d) => downloadDataUrl(d, `${fileBase}.png`), "png"); }
  async function exportJPG() { await withCapture((d) => downloadDataUrl(d, `${fileBase}.jpg`), "jpeg"); }
  async function exportPDF() {
    await withCapture(async (d) => {
      const pdf = new jsPDF({ orientation: dims.w > dims.h ? "landscape" : "portrait", unit: "px", format: [dims.w, dims.h] });
      pdf.addImage(d, "PNG", 0, 0, dims.w, dims.h);
      pdf.save(`${fileBase}.pdf`);
    }, "png");
  }
  async function printArt() {
    await withCapture(async (d) => {
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(`<html><head><title>Imprimir</title><style>@page{margin:0}body{margin:0;display:flex;justify-content:center;align-items:center}img{max-width:100%;max-height:100vh}</style></head><body><img src="${d}" onload="setTimeout(()=>window.print(),300)"/></body></html>`);
      w.document.close();
    }, "png");
  }
  async function shareArt() {
    await withCapture(async (d) => {
      const blob = await (await fetch(d)).blob();
      const file = new File([blob], `${fileBase}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: est?.name, text: title });
      } else {
        downloadDataUrl(d, `${fileBase}.png`);
        toast.info("Seu navegador não suporta compartilhamento direto. Baixamos o arquivo.");
      }
    }, "png");
  }

  function applySegmentPalette(seg: Segment) {
    const p = SEGMENT_DEFAULTS[seg];
    setPrimaryColor(p.primary); setAccentColor(p.accent); setBackgroundColor(p.bg);
  }

  if (!est) return <div className="text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Divulgação</div>
        <h1 className="font-display text-3xl font-bold">Divulgue seu programa de fidelidade</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">Crie materiais personalizados com seu QR Code e facilite a entrada de novos clientes no seu programa.</p>
      </div>

      {/* Format picker */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {(Object.keys(FORMATS) as PromoFormat[]).map((k) => (
          <button
            key={k}
            onClick={() => setFormat(k)}
            className={`shrink-0 rounded-xl border px-4 py-3 text-left transition ${format === k ? "border-primary bg-primary-soft text-primary" : "border-border hover:border-primary/40"}`}
          >
            <div className="text-sm font-semibold">{FORMATS[k].label}</div>
            <div className="text-[11px] text-muted-foreground">{FORMATS[k].w}×{FORMATS[k].h}px · {FORMATS[k].description}</div>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        {/* EDITOR */}
        <Card>
          <CardContent className="p-5">
            <Tabs defaultValue="content">
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="content"><Sparkles className="mr-1 h-3 w-3" /> Conteúdo</TabsTrigger>
                <TabsTrigger value="style"><Palette className="mr-1 h-3 w-3" /> Estilo</TabsTrigger>
                <TabsTrigger value="advanced"><Settings2 className="mr-1 h-3 w-3" /> Avançado</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4 pt-4">
                {campaigns && campaigns.length > 0 && (
                  <div>
                    <Label className="text-xs">Campanha</Label>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {activeCampaign ? <><strong className="text-foreground">{activeCampaign.name}</strong> · {activeCampaign.stamps_required} carimbos → {activeCampaign.reward_title}</> : "Nenhuma campanha ativa"}
                    </div>
                  </div>
                )}
                <div>
                  <Label htmlFor="title" className="text-xs">Título</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
                </div>
                <div>
                  <Label htmlFor="subtitle" className="text-xs">Subtítulo</Label>
                  <Textarea id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} rows={3} maxLength={220} />
                </div>
                <div>
                  <Label htmlFor="reward" className="text-xs">Texto da recompensa <span className="text-muted-foreground">(deixe vazio para usar da campanha)</span></Label>
                  <Textarea id="reward" value={rewardTextOverride} onChange={(e) => setRewardTextOverride(e.target.value)} rows={2} placeholder={rewardText} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="near" className="text-xs">Chamada perto do QR</Label>
                    <Input id="near" value={ctaNearQR} onChange={(e) => setCtaNearQR(e.target.value)} maxLength={40} />
                  </div>
                  <div>
                    <Label htmlFor="foot" className="text-xs">CTA do rodapé</Label>
                    <Input id="foot" value={ctaFooter} onChange={(e) => setCtaFooter(e.target.value)} maxLength={40} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="style" className="space-y-4 pt-4">
                <div>
                  <Label className="text-xs">Segmento</Label>
                  <Select value={segment} onValueChange={(v) => { setSegment(v as Segment); applySegmentPalette(v as Segment); }}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(SEGMENT_LABEL) as Segment[]).map((k) => <SelectItem key={k} value={k}>{SEGMENT_LABEL[k]}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">Adiciona elementos gráficos discretos e sugere paleta.</p>
                </div>
                <ColorField label="Cor principal" value={primaryColor} onChange={setPrimaryColor} />
                <ColorField label="Cor secundária" value={accentColor} onChange={setAccentColor} />
                <ColorField label="Fundo" value={backgroundColor} onChange={setBackgroundColor} />
                <ColorField label="Cor dos textos" value={textColor} onChange={setTextColor} />
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="brand" className="text-xs">Mostrar "Powered by Fidelize"</Label>
                    <p className="text-[11px] text-muted-foreground">Discreta marca no rodapé.</p>
                  </div>
                  <Switch id="brand" checked={showBrand} onCheckedChange={setShowBrand} />
                </div>
                <div>
                  <Label className="text-xs">Link público</Label>
                  <div className="mt-1 flex gap-2">
                    <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs break-all">{publicUrl}</code>
                    <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Copiado"); }}><Copy className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  O QR Code é gerado em alta resolução com correção de erros H (30%), garantindo leitura mesmo com a cor da sua marca.
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* PREVIEW */}
        <Card>
          <CardContent className="p-0">
            <div ref={previewWrapRef} className="relative bg-[linear-gradient(45deg,#f8f9fb_25%,transparent_25%),linear-gradient(-45deg,#f8f9fb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f8f9fb_75%),linear-gradient(-45deg,transparent_75%,#f8f9fb_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0] rounded-t-lg overflow-hidden" style={{ height: "min(70vh, 720px)" }}>
              <div className="absolute inset-0 grid place-items-center">
                <div style={{ width: dims.w * previewScale, height: dims.h * previewScale }}>
                  <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left", width: dims.w, height: dims.h }}>
                    <PromoPoster ref={posterRef} config={config} />
                  </div>
                </div>
              </div>
              <div className="absolute top-3 right-3 rounded-md bg-background/80 backdrop-blur px-2 py-1 text-[11px] text-muted-foreground border">
                {dims.w} × {dims.h}px
              </div>
            </div>
            <div className="p-4 border-t flex flex-wrap gap-2">
              <Button onClick={exportPNG} disabled={exporting} className="gradient-brand text-primary-foreground">
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileImage className="mr-2 h-4 w-4" />}
                Baixar PNG
              </Button>
              <Button onClick={exportJPG} disabled={exporting} variant="outline"><FileImage className="mr-2 h-4 w-4" />JPG</Button>
              <Button onClick={exportPDF} disabled={exporting} variant="outline"><FileText className="mr-2 h-4 w-4" />PDF</Button>
              <Button onClick={printArt} disabled={exporting} variant="outline"><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
              <Button onClick={shareArt} disabled={exporting} variant="outline"><Share2 className="mr-2 h-4 w-4" />Compartilhar</Button>
              <Button onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado"); }} variant="ghost"><Copy className="mr-2 h-4 w-4" />Copiar link</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Download className="h-3 w-3" /> Dica: para Instagram Story use o formato <strong className="text-foreground">Story</strong>; para o feed, <strong className="text-foreground">Feed</strong>; para imprimir e colar, <strong className="text-foreground">Cartaz A4</strong>.
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 rounded-md border cursor-pointer" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
      </div>
    </div>
  );
}
