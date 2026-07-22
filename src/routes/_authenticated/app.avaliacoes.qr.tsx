import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import {
  Star, Copy, Share2, FileImage, FileText, Lock, Sparkles, Radio, CheckCircle2, AlertTriangle,
  Save, Layers, Eye, Trash2, Palette,
} from "lucide-react";

import { PageHero } from "@/components/PageHero";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { useMyFeature } from "@/hooks/useMyFeature";

export const Route = createFileRoute("/_authenticated/app/avaliacoes/qr")({
  head: () => ({ meta: [{ title: "QR de Avaliação — Fidelize" }] }),
  component: ReviewQrPage,
});

/** Poster formats — landscape 15×10cm is the default. */
type FormatKey = "counter15x10" | "story" | "feed" | "a5";
const FORMATS: Record<FormatKey, { label: string; aspect: string; mm: { w: number; h: number }; description: string; orientation: "landscape" | "portrait" | "square" }> = {
  counter15x10: { label: "Balcão 10×15", aspect: "2 / 3", mm: { w: 100, h: 150 }, description: "Padrão vertical para balcão e mesa", orientation: "portrait" },
  a5:           { label: "A5 vertical", aspect: "1 / 1.414", mm: { w: 148, h: 210 }, description: "Cartaz de parede", orientation: "portrait" },
  feed:         { label: "Feed 1:1", aspect: "1 / 1", mm: { w: 200, h: 200 }, description: "Instagram/Feed", orientation: "square" },
  story:        { label: "Story 9:16", aspect: "9 / 16", mm: { w: 108, h: 192 }, description: "Story/Reels", orientation: "portrait" },
};

type Destination = "fidelize" | "google";
type TemplateKey = "glass" | "minimal" | "bold" | "editorial";

const TEMPLATES: Record<TemplateKey, { label: string; description: string; defaults: { primaryColor: string; backgroundColor: string; textColor: string } }> = {
  glass:     { label: "Glass Cyan",  description: "Fundo escuro com brilho cyan (padrão)", defaults: { primaryColor: "#00c2c7", backgroundColor: "#0d1117", textColor: "#ffffff" } },
  minimal:   { label: "Minimal",     description: "Branco limpo, tipografia sóbria",       defaults: { primaryColor: "#111827", backgroundColor: "#ffffff", textColor: "#111827" } },
  bold:      { label: "Bold",        description: "Cor cheia, contraste alto",             defaults: { primaryColor: "#ffffff", backgroundColor: "#ff5b3d", textColor: "#ffffff" } },
  editorial: { label: "Editorial",   description: "Sépia sofisticado, estilo revista",     defaults: { primaryColor: "#8b6f3a", backgroundColor: "#f4ede0", textColor: "#2a1f14" } },
};

type SavedDesign = {
  id: string;
  name: string;
  createdAt: number;
  data: {
    template: TemplateKey;
    format: FormatKey;
    destination: Destination;
    googleUrl: string;
    showGoogleLogo: boolean;
    nfcMode: boolean;
    title: string;
    subtitle: string;
    ctaNearQR: string;
    ctaFooter: string;
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
  };
};

function ReviewQrPage() {

  const getEsts = useServerFn(getMyEstablishments);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as
    | { id: string; name: string; slug: string; primary_color?: string; accent_color?: string; logo_url?: string | null }
    | undefined;

  const { allowed, isLoading: featLoading } = useMyFeature(est?.id, "public_reviews");

  // Persisted preferences
  const storageKey = est ? `review-qr:${est.id}` : "review-qr:draft";
  const designsKey = est ? `review-qr-designs:${est.id}` : "review-qr-designs:draft";

  const [template, setTemplate] = useState<TemplateKey>("glass");
  const [format, setFormat] = useState<FormatKey>("counter15x10");

  const [destination, setDestination] = useState<Destination>("fidelize");
  const [googleUrl, setGoogleUrl] = useState("");
  const [showGoogleLogo, setShowGoogleLogo] = useState(true);
  const [nfcMode, setNfcMode] = useState(false);
  const [title, setTitle] = useState("Como foi seu atendimento?");
  const [subtitle, setSubtitle] = useState("Sua opinião ajuda nossa equipe a melhorar. Leva menos de 30 segundos.");
  const [ctaNearQR, setCtaNearQR] = useState("Aponte a câmera para avaliar");
  const [ctaFooter, setCtaFooter] = useState("Escaneie e conte pra gente");
  const [primaryColor, setPrimaryColor] = useState("#00c2c7");
  const [backgroundColor, setBackgroundColor] = useState("#0d1117");
  const [textColor, setTextColor] = useState("#ffffff");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [exporting, setExporting] = useState(false);
  const [displayMode, setDisplayMode] = useState(false);
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [designName, setDesignName] = useState("");
  const posterRef = useRef<HTMLDivElement>(null);


  // Load persisted state
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.template) setTemplate(s.template);
        if (s.format) setFormat(s.format);
        if (s.destination) setDestination(s.destination);
        if (typeof s.googleUrl === "string") setGoogleUrl(s.googleUrl);
        if (typeof s.showGoogleLogo === "boolean") setShowGoogleLogo(s.showGoogleLogo);
        if (typeof s.nfcMode === "boolean") setNfcMode(s.nfcMode);
        if (s.title) setTitle(s.title);
        if (s.subtitle) setSubtitle(s.subtitle);
        if (s.ctaNearQR) setCtaNearQR(s.ctaNearQR);
        if (s.ctaFooter) setCtaFooter(s.ctaFooter);
        if (s.primaryColor) setPrimaryColor(s.primaryColor);
        if (s.backgroundColor) setBackgroundColor(s.backgroundColor);
        if (s.textColor) setTextColor(s.textColor);
      }
      const rawDesigns = window.localStorage.getItem(designsKey);
      if (rawDesigns) setDesigns(JSON.parse(rawDesigns));
    } catch { /* ignore */ }
  }, [storageKey, designsKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        template, format, destination, googleUrl, showGoogleLogo, nfcMode,
        title, subtitle, ctaNearQR, ctaFooter,
        primaryColor, backgroundColor, textColor,
      }));
    } catch { /* ignore */ }
  }, [storageKey, template, format, destination, googleUrl, showGoogleLogo, nfcMode, title, subtitle, ctaNearQR, ctaFooter, primaryColor, backgroundColor, textColor]);

  function applyTemplate(key: TemplateKey) {
    setTemplate(key);
    const t = TEMPLATES[key];
    setPrimaryColor(t.defaults.primaryColor);
    setBackgroundColor(t.defaults.backgroundColor);
    setTextColor(t.defaults.textColor);
  }

  function persistDesigns(next: SavedDesign[]) {
    setDesigns(next);
    try { window.localStorage.setItem(designsKey, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function saveCurrentDesign() {
    const name = designName.trim() || `Design ${designs.length + 1}`;
    const entry: SavedDesign = {
      id: (crypto?.randomUUID?.() ?? String(Date.now())),
      name,
      createdAt: Date.now(),
      data: {
        template, format, destination, googleUrl, showGoogleLogo, nfcMode,
        title, subtitle, ctaNearQR, ctaFooter,
        primaryColor, backgroundColor, textColor,
      },
    };
    persistDesigns([entry, ...designs].slice(0, 20));
    setDesignName("");
    toast.success(`Design "${name}" salvo`);
  }

  function loadDesign(d: SavedDesign) {
    const s = d.data;
    setTemplate(s.template);
    setFormat(s.format);
    setDestination(s.destination);
    setGoogleUrl(s.googleUrl);
    setShowGoogleLogo(s.showGoogleLogo);
    setNfcMode(s.nfcMode);
    setTitle(s.title);
    setSubtitle(s.subtitle);
    setCtaNearQR(s.ctaNearQR);
    setCtaFooter(s.ctaFooter);
    setPrimaryColor(s.primaryColor);
    setBackgroundColor(s.backgroundColor);
    setTextColor(s.textColor);
    toast.success(`Design "${d.name}" carregado`);
  }

  function deleteDesign(id: string) {
    persistDesigns(designs.filter(d => d.id !== id));
    toast.success("Design removido");
  }



  const fidelizeUrl = est ? `${typeof window !== "undefined" ? window.location.origin : ""}/avaliar/${est.slug}` : "";
  const targetUrl = destination === "google" ? googleUrl.trim() : fidelizeUrl;
  const googleReady = destination === "google" && /^https?:\/\/(g\.page|maps\.app\.goo\.gl|search\.google\.com|www\.google\.com|goo\.gl)/i.test(targetUrl);

  useEffect(() => {
    if (!targetUrl) { setQrDataUrl(""); return; }
    QRCode.toDataURL(targetUrl, {
      width: 1200,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#111827", light: "#ffffff" },
    }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [targetUrl]);

  const dims = FORMATS[format];

  async function exportPng() {
    if (!posterRef.current) return;
    if (!targetUrl) { toast.error("Configure o destino do QR primeiro"); return; }
    setExporting(true);
    try {
      const url = await toPng(posterRef.current, { pixelRatio: 3, cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-avaliacao-${est?.slug ?? "estabelecimento"}-${format}.png`;
      a.click();
      toast.success("PNG baixado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar PNG");
    } finally { setExporting(false); }
  }

  async function exportPdf() {
    if (!posterRef.current) return;
    if (!targetUrl) { toast.error("Configure o destino do QR primeiro"); return; }
    setExporting(true);
    try {
      const url = await toPng(posterRef.current, { pixelRatio: 4, cacheBust: true });
      const mmW = dims.mm.w;
      const mmH = dims.mm.h;
      const pdf = new jsPDF({ unit: "mm", format: [mmW, mmH], orientation: mmW > mmH ? "landscape" : "portrait" });
      pdf.addImage(url, "PNG", 0, 0, mmW, mmH);
      pdf.save(`qr-avaliacao-${est?.slug ?? "estabelecimento"}-${format}.pdf`);
      toast.success("PDF baixado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar PDF");
    } finally { setExporting(false); }
  }

  async function share() {
    if (!targetUrl) return;
    try {
      if (navigator.share) await navigator.share({ title: "Avalie nosso atendimento", url: targetUrl });
      else { await navigator.clipboard.writeText(targetUrl); toast.success("Link copiado"); }
    } catch { /* cancelled */ }
  }

  async function copyLink() {
    if (!targetUrl) return;
    await navigator.clipboard.writeText(targetUrl);
    toast.success("Link copiado");
  }

  async function copyNfcUrl() {
    if (!targetUrl) return;
    await navigator.clipboard.writeText(targetUrl);
    toast.success("URL copiada — cole no app do seu NFC tag (NFC Tools, etc.)");
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
              <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Cartaz 15×10 para balcão, mesa e recibo</li>
              <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> QR para Google Reviews + modo NFC</li>
            </ul>
            <Button asChild size="lg" className="mt-2"><Link to="/app/planos">Ver planos disponíveis</Link></Button>
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
        subtitle="Cartaz pronto para balcão, mesa e recibos. Encaminha o cliente direto para avaliar o atendimento — Fidelize ou Google Reviews."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* CONTROLS — glass panel */}
        <Card className="border-primary/15 bg-card/70 backdrop-blur-xl">
          <CardContent className="space-y-6 p-5">
            {/* Destination */}
            <div className="space-y-3">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Destino do QR</Label>
              <div className="grid grid-cols-2 gap-1 rounded-xl border bg-background/60 p-1">
                <button
                  type="button"
                  onClick={() => setDestination("fidelize")}
                  className={`rounded-lg py-2.5 text-sm font-semibold transition ${destination === "fidelize" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Fidelize
                </button>
                <button
                  type="button"
                  onClick={() => setDestination("google")}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${destination === "google" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <GoogleG className="h-4 w-4" />
                  Google Reviews
                </button>
              </div>

              {destination === "fidelize" ? (
                <div className="rounded-lg border bg-background/50 p-3 text-xs">
                  <div className="text-muted-foreground">Link público</div>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-muted/60 px-2 py-1 text-primary">{fidelizeUrl}</code>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copyLink}><Copy className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs">Link do Google Reviews (Place URL ou g.page)</Label>
                  <Input
                    value={googleUrl}
                    onChange={(e) => setGoogleUrl(e.target.value)}
                    placeholder="https://g.page/r/XXXXXX/review"
                    className="text-xs"
                  />
                  {googleReady ? (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-500">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Link Google válido
                    </div>
                  ) : googleUrl ? (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-500">
                      <AlertTriangle className="h-3.5 w-3.5" /> Confira se é um link do Google (g.page, maps.app.goo.gl, google.com)
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground">
                      Copie o link "Deixe uma avaliação" do seu perfil no Google Business.
                    </div>
                  )}
                  <label className="mt-1 flex cursor-pointer items-center justify-between gap-3 rounded-lg border bg-background/50 p-2.5">
                    <span className="flex items-center gap-2 text-xs font-medium">
                      <GoogleG className="h-4 w-4" /> Mostrar logo do Google no cartaz
                    </span>
                    <Switch checked={showGoogleLogo} onCheckedChange={setShowGoogleLogo} />
                  </label>
                </div>
              )}
            </div>

            {/* Format */}
            <div className="space-y-3">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Formato do cartaz</Label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(FORMATS) as FormatKey[]).map((k) => {
                  const f = FORMATS[k];
                  const active = format === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setFormat(k)}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition ${active ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/40"}`}
                    >
                      <div
                        className={`border-2 rounded-sm ${active ? "border-primary" : "border-muted-foreground/50"}`}
                        style={{
                          width: f.orientation === "landscape" ? 32 : f.orientation === "square" ? 22 : 18,
                          height: f.orientation === "landscape" ? 22 : f.orientation === "square" ? 22 : 32,
                        }}
                      />
                      <span className={`text-[10px] font-bold ${active ? "text-primary" : "text-muted-foreground"}`}>{f.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="text-[11px] text-muted-foreground">{dims.description} · {dims.mm.w}×{dims.mm.h}mm</div>
            </div>

            {/* NFC */}
            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3">
              <div className="flex items-start gap-2">
                <Radio className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-semibold">Modo NFC</div>
                  <div className="text-[11px] text-muted-foreground">Exibe "Aproxime o celular" no cartaz e libera botão para gravar em NFC tag.</div>
                </div>
              </div>
              <Switch checked={nfcMode} onCheckedChange={setNfcMode} />
            </label>

            {nfcMode && (
              <div className="rounded-lg border border-primary/30 bg-primary-soft/40 p-3 text-xs">
                <div className="font-semibold text-primary">URL para NFC</div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-background/70 px-2 py-1">{targetUrl || "—"}</code>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copyNfcUrl}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="mt-1.5 text-[11px] text-muted-foreground">
                  Use um app como <strong>NFC Tools</strong> (Android/iOS) para gravar essa URL na tag adesiva.
                </div>
              </div>
            )}

            {/* Text fields */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Título</Label>
                <Input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subtítulo</Label>
                <Textarea value={subtitle} maxLength={160} rows={2} onChange={(e) => setSubtitle(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Chamada perto do QR</Label>
                  <Input value={ctaNearQR} maxLength={40} onChange={(e) => setCtaNearQR(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Rodapé</Label>
                  <Input value={ctaFooter} maxLength={40} onChange={(e) => setCtaFooter(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Colors */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cor principal</Label>
                <Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 p-1" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fundo</Label>
                <Input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="h-10 p-1" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Texto</Label>
                <Input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="h-10 p-1" />
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button onClick={exportPng} disabled={exporting || !targetUrl}>
                <FileImage className="mr-2 h-4 w-4" /> Baixar PNG
              </Button>
              <Button onClick={exportPdf} disabled={exporting || !targetUrl} variant="outline">
                <FileText className="mr-2 h-4 w-4" /> Baixar PDF
              </Button>
              <Button onClick={share} variant="outline" disabled={!targetUrl}>
                <Share2 className="mr-2 h-4 w-4" /> Compartilhar
              </Button>
              <Button onClick={copyLink} variant="outline" disabled={!targetUrl}>
                <Copy className="mr-2 h-4 w-4" /> Copiar link
              </Button>
            </div>
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link to="/app/avaliacoes">Ver avaliações recebidas →</Link>
            </Button>
          </CardContent>
        </Card>

        {/* PREVIEW */}
        <div className="min-w-0">
          <div className="sticky top-4 flex flex-col items-center gap-3">
            <div className="relative w-full max-w-[420px]">
              <div className="pointer-events-none absolute -inset-8 rounded-3xl bg-gradient-to-br from-primary/15 via-transparent to-transparent blur-3xl" />
              <div
                className="relative overflow-hidden rounded-lg shadow-2xl ring-1 ring-primary/20"
                style={{ aspectRatio: dims.aspect }}
              >
                <PosterCanvas
                  ref={posterRef}
                  format={format}
                  title={title}
                  subtitle={subtitle}
                  ctaNearQR={ctaNearQR}
                  ctaFooter={ctaFooter}
                  primaryColor={primaryColor}
                  backgroundColor={backgroundColor}
                  textColor={textColor}
                  qrDataUrl={qrDataUrl}
                  targetUrl={targetUrl}
                  establishmentName={est.name}
                  logoUrl={est.logo_url ?? null}
                  destination={destination}
                  showGoogleLogo={showGoogleLogo}
                  nfcMode={nfcMode}
                />
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Preview em escala. Exportação usa {dims.mm.w}×{dims.mm.h}mm ({dims.orientation === "landscape" ? "paisagem" : dims.orientation === "square" ? "quadrado" : "retrato"}).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Poster canvas                                                       */
/* ------------------------------------------------------------------ */

import { forwardRef } from "react";

interface PosterProps {
  format: FormatKey;
  title: string;
  subtitle: string;
  ctaNearQR: string;
  ctaFooter: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  qrDataUrl: string;
  targetUrl: string;
  establishmentName: string;
  logoUrl: string | null;
  destination: Destination;
  showGoogleLogo: boolean;
  nfcMode: boolean;
}

const PosterCanvas = forwardRef<HTMLDivElement, PosterProps>(function PosterCanvas(props, ref) {
  return (
    <div
      ref={ref}
      className="absolute inset-0 flex flex-col"
      style={{ background: props.backgroundColor, color: props.textColor }}
    >
      <PortraitBody {...props} />
    </div>
  );
});


function PortraitBody(p: PosterProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-between p-6 text-center">
      <div className="space-y-3">
        <BrandLogo url={p.logoUrl} name={p.establishmentName} primary={p.primaryColor} />
        <div className="text-sm font-bold" style={{ color: p.textColor }}>{p.establishmentName}</div>
        <Stars color={p.primaryColor} size={16} center />
        <h2 className="text-xl font-black leading-tight" style={{ color: p.textColor }}>{p.title}</h2>
        <p className="mx-auto max-w-[26ch] text-[11px] opacity-70" style={{ color: p.textColor }}>{p.subtitle}</p>
      </div>
      {p.nfcMode ? (
        <div className="flex items-center justify-center gap-3">
          <QrBlock qr={p.qrDataUrl} />
          <NfcBlock primary={p.primaryColor} />
        </div>
      ) : (
        <QrBlock qr={p.qrDataUrl} />
      )}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: p.primaryColor }}>
          {p.nfcMode ? "Aproxime o celular" : p.ctaNearQR}
        </div>
        <div className="text-[10px] opacity-70" style={{ color: p.textColor }}>{p.ctaFooter}</div>
        <div className="flex items-center justify-center gap-2">
          {p.destination === "google" && p.showGoogleLogo && <GoogleBadge />}
          {p.nfcMode && <NfcBadge primary={p.primaryColor} />}
        </div>
      </div>
    </div>
  );
}

function QrBlock({ qr }: { qr: string }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-lg">
      {qr ? (
        <img src={qr} alt="QR" className="h-[128px] w-[128px] block" />
      ) : (
        <div className="grid h-[128px] w-[128px] place-items-center text-[10px] text-slate-400">gerando…</div>
      )}
    </div>
  );
}

function NfcBlock({ primary }: { primary: string }) {
  return (
    <div
      className="flex h-[152px] w-[152px] flex-col items-center justify-center gap-1.5 rounded-xl p-3 shadow-lg"
      style={{
        background: `linear-gradient(135deg, color-mix(in oklab, ${primary} 22%, #ffffff) 0%, #ffffff 100%)`,
        border: `2px solid ${primary}`,
      }}
    >
      <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke={primary} strokeWidth="4" strokeLinecap="round">
        <path d="M20 22c6 6 6 14 0 20" />
        <path d="M28 16c10 8 10 24 0 32" />
        <path d="M36 10c14 10 14 34 0 44" />
        <circle cx="14" cy="32" r="2.5" fill={primary} stroke="none" />
      </svg>
      <div className="text-center text-[10px] font-black uppercase tracking-widest" style={{ color: primary }}>
        Toque aqui
      </div>
      <div className="text-center text-[8px] font-semibold uppercase tracking-widest text-slate-500">
        NFC
      </div>
    </div>
  );
}



function BrandLogo({ url, name, primary }: { url: string | null; name: string; primary: string }) {
  if (url) return <img src={url} alt={name} className="h-10 w-10 shrink-0 rounded-full object-cover ring-2" style={{ borderColor: primary }} />;
  const initial = name.slice(0, 1).toUpperCase();
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black text-white" style={{ background: primary }}>
      {initial}
    </div>
  );
}

function Stars({ color, size, center }: { color: string; size: number; center?: boolean }) {
  return (
    <div className={`flex gap-0.5 ${center ? "justify-center" : ""}`} style={{ color }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function GoogleG({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GoogleBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 shadow-sm">
      <GoogleColorG />
      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-800">Google Reviews</span>
    </div>
  );
}

function GoogleColorG() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function NfcBadge({ primary }: { primary: string }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{ background: `color-mix(in oklab, ${primary} 20%, transparent)`, border: `1px solid ${primary}` }}
    >
      <Radio className="h-3 w-3" style={{ color: primary }} />
      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: primary }}>NFC</span>
    </div>
  );
}
