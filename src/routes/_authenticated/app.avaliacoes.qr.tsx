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
  Save, Layers, Eye, Trash2, Palette, ShoppingBag, Move, RotateCcw, XCircle,
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
import { DisplayStorePreview } from "@/components/DisplayStorePreview";

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

/** Draggable elements on the poster canvas. */
type LayoutKey = "header" | "title" | "subtitle" | "primaryQr" | "secondaryQr" | "nfc" | "ctaNear" | "ctaFooter";
type LayoutPos = { x: number; y: number }; // percent 0-100 (element center)
type PosterLayout = Record<LayoutKey, LayoutPos>;

const DEFAULT_LAYOUT: PosterLayout = {
  header:      { x: 50, y: 13 },
  title:       { x: 50, y: 26 },
  subtitle:    { x: 50, y: 34 },
  primaryQr:   { x: 50, y: 58 },
  secondaryQr: { x: 72, y: 58 },
  nfc:         { x: 50, y: 74 },
  ctaNear:     { x: 50, y: 86 },
  ctaFooter:   { x: 50, y: 93 },
};

/** URL validation for QR destinations. */
type UrlCheck = { level: "empty" | "ok" | "warn" | "error"; message: string };

function checkGoogleUrl(v: string): UrlCheck {
  const t = v.trim();
  if (!t) return { level: "empty", message: 'Copie o link "Deixe uma avaliação" do seu Google Business.' };
  let u: URL;
  try { u = new URL(t); } catch { return { level: "error", message: "URL inválida — verifique se copiou o link completo." }; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { level: "error", message: "O link deve começar com https://" };
  const ok = /^(g\.page|maps\.app\.goo\.gl|search\.google\.com|www\.google\.com|goo\.gl|maps\.google\.com)$/i;
  if (!ok.test(u.hostname)) return { level: "warn", message: `"${u.hostname}" não parece um domínio do Google (g.page, maps.app.goo.gl, google.com).` };
  if (u.protocol === "http:") return { level: "warn", message: "Preferimos https:// para evitar avisos de segurança no celular." };
  return { level: "ok", message: `Link Google válido — ${u.hostname}` };
}

function checkGenericUrl(v: string): UrlCheck {
  const t = v.trim();
  if (!t) return { level: "empty", message: "Cole o link do cardápio, loja, WhatsApp ou Instagram." };
  let u: URL;
  try { u = new URL(t); } catch { return { level: "error", message: "URL inválida — comece com https:// e verifique se está completa." }; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { level: "error", message: "O link deve começar com https://" };
  if (u.protocol === "http:") return { level: "warn", message: "Preferimos https:// para evitar avisos de segurança no celular." };
  return { level: "ok", message: `Link válido — ${u.hostname}` };
}

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
  const [nfcStyle, setNfcStyle] = useState<"block" | "badge">("block");
  const [title, setTitle] = useState("Como foi seu atendimento?");
  const [subtitle, setSubtitle] = useState("Sua opinião ajuda nossa equipe a melhorar. Leva menos de 30 segundos.");
  const [ctaNearQR, setCtaNearQR] = useState("Aponte a câmera para avaliar");
  const [ctaFooter, setCtaFooter] = useState("Escaneie e conte pra gente");
  const [primaryColor, setPrimaryColor] = useState("#00c2c7");
  const [backgroundColor, setBackgroundColor] = useState("#0d1117");
  const [textColor, setTextColor] = useState("#ffffff");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [primaryLabel, setPrimaryLabel] = useState("Avalie nosso atendimento");
  const [secondaryEnabled, setSecondaryEnabled] = useState(false);
  const [secondaryUrl, setSecondaryUrl] = useState("");
  const [secondaryLabel, setSecondaryLabel] = useState("Ver nosso cardápio");
  const [secondaryQrDataUrl, setSecondaryQrDataUrl] = useState("");
  const [exporting, setExporting] = useState(false);
  const [displayMode, setDisplayMode] = useState(false);
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [designName, setDesignName] = useState("");
  const [layout, setLayout] = useState<PosterLayout>(DEFAULT_LAYOUT);
  const [editLayout, setEditLayout] = useState(false);
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
        if (s.nfcStyle === "block" || s.nfcStyle === "badge") setNfcStyle(s.nfcStyle);
        if (s.title) setTitle(s.title);
        if (s.subtitle) setSubtitle(s.subtitle);
        if (s.ctaNearQR) setCtaNearQR(s.ctaNearQR);
        if (s.ctaFooter) setCtaFooter(s.ctaFooter);
        if (s.primaryColor) setPrimaryColor(s.primaryColor);
        if (s.backgroundColor) setBackgroundColor(s.backgroundColor);
        if (s.textColor) setTextColor(s.textColor);
        if (typeof s.primaryLabel === "string") setPrimaryLabel(s.primaryLabel);
        if (typeof s.secondaryEnabled === "boolean") setSecondaryEnabled(s.secondaryEnabled);
        if (typeof s.secondaryUrl === "string") setSecondaryUrl(s.secondaryUrl);
        if (typeof s.secondaryLabel === "string") setSecondaryLabel(s.secondaryLabel);
        if (s.layout && typeof s.layout === "object") setLayout({ ...DEFAULT_LAYOUT, ...s.layout });
      }
      const rawDesigns = window.localStorage.getItem(designsKey);
      if (rawDesigns) setDesigns(JSON.parse(rawDesigns));
    } catch { /* ignore */ }
  }, [storageKey, designsKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        template, format, destination, googleUrl, showGoogleLogo, nfcMode, nfcStyle,
        title, subtitle, ctaNearQR, ctaFooter,
        primaryColor, backgroundColor, textColor,
        primaryLabel, secondaryEnabled, secondaryUrl, secondaryLabel,
        layout,
      }));
    } catch { /* ignore */ }
  }, [storageKey, template, format, destination, googleUrl, showGoogleLogo, nfcMode, nfcStyle, title, subtitle, ctaNearQR, ctaFooter, primaryColor, backgroundColor, textColor, primaryLabel, secondaryEnabled, secondaryUrl, secondaryLabel, layout]);

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
  const rawTargetUrl = destination === "fidelize" ? fidelizeUrl : googleUrl.trim();
  const primaryIsPlaceholder = destination === "google" && !rawTargetUrl;
  const targetUrl = rawTargetUrl || (destination === "google"
    ? "https://g.page/exemplo-fidelize/review"
    : "https://fidelize.app/preview");

  const googleCheck = useMemo(() => checkGoogleUrl(googleUrl), [googleUrl]);
  const secondaryRawUrl = secondaryUrl.trim();
  const secondaryCheck = useMemo(() => checkGenericUrl(secondaryUrl), [secondaryUrl]);
  const googleReady = destination === "google" && googleCheck.level === "ok";
  const secondaryIsPlaceholder = secondaryEnabled && !secondaryRawUrl;
  const secondaryReady = secondaryEnabled && secondaryCheck.level === "ok";
  const primaryBlocking = destination === "google" && (googleCheck.level === "error" || googleCheck.level === "empty");
  const secondaryBlocking = secondaryEnabled && (secondaryCheck.level === "error" || secondaryCheck.level === "empty");

  useEffect(() => {
    QRCode.toDataURL(targetUrl, {
      width: 1200, margin: 1, errorCorrectionLevel: "H",
      color: { dark: "#111827", light: "#ffffff" },
    }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [targetUrl]);

  useEffect(() => {
    if (!secondaryEnabled) {
      setSecondaryQrDataUrl("");
      // restore centered primary QR when the second QR is turned off (only if
      // it's still at the auto-shifted position — never override manual drags).
      setLayout((prev) => (prev.primaryQr.x === 30 && prev.primaryQr.y === 58
        ? { ...prev, primaryQr: DEFAULT_LAYOUT.primaryQr }
        : prev));
      return;
    }
    // Auto-shift the two QRs side-by-side the moment the toggle is enabled,
    // but only if the user hasn't manually repositioned them yet.
    setLayout((prev) => {
      const primaryUntouched = prev.primaryQr.x === DEFAULT_LAYOUT.primaryQr.x && prev.primaryQr.y === DEFAULT_LAYOUT.primaryQr.y;
      const secondaryUntouched = prev.secondaryQr.x === DEFAULT_LAYOUT.secondaryQr.x && prev.secondaryQr.y === DEFAULT_LAYOUT.secondaryQr.y;
      if (!primaryUntouched && !secondaryUntouched) return prev;
      return {
        ...prev,
        primaryQr: primaryUntouched ? { x: 30, y: 58 } : prev.primaryQr,
        secondaryQr: secondaryUntouched ? { x: 70, y: 58 } : prev.secondaryQr,
      };
    });
    const u = secondaryRawUrl || "https://fidelize.app/preview-cardapio";
    QRCode.toDataURL(u, {
      width: 1200, margin: 1, errorCorrectionLevel: "H",
      color: { dark: "#111827", light: "#ffffff" },
    }).then(setSecondaryQrDataUrl).catch(() => setSecondaryQrDataUrl(""));
  }, [secondaryEnabled, secondaryRawUrl]);

  const dims = FORMATS[format];

  /**
   * Renders the poster to PNG at 300 DPI print resolution.
   * pixelRatio is computed from the on-screen preview size so the output
   * always matches (mm ÷ 25.4 × 300) px, no matter how big the preview is.
   */
  async function renderPosterPng(): Promise<string> {
    const el = posterRef.current;
    if (!el) throw new Error("Preview indisponível");
    const rect = el.getBoundingClientRect();
    const targetPx = Math.max(600, Math.round((dims.mm.w / 25.4) * 300));
    const pixelRatio = Math.max(2, targetPx / Math.max(1, rect.width));
    // Force layout-guides off during export
    const wasEditing = editLayout;
    if (wasEditing) setEditLayout(false);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      return await toPng(el, {
        pixelRatio,
        cacheBust: true,
        filter: (node) => !(node instanceof HTMLElement && node.dataset?.exportIgnore === "true"),
      });
    } finally {
      if (wasEditing) setEditLayout(true);
    }
  }

  async function exportPng() {
    if (!posterRef.current) return;
    if (primaryBlocking) { toast.error(googleCheck.message); return; }
    if (secondaryBlocking) { toast.error(secondaryCheck.message); return; }
    setExporting(true);
    try {
      const url = await renderPosterPng();
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-avaliacao-${est?.slug ?? "estabelecimento"}-${format}-300dpi.png`;
      a.click();
      toast.success(`PNG 300 DPI baixado (${Math.round((dims.mm.w/25.4)*300)}×${Math.round((dims.mm.h/25.4)*300)}px)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar PNG");
    } finally { setExporting(false); }
  }

  async function exportPdf() {
    if (!posterRef.current) return;
    if (primaryBlocking) { toast.error(googleCheck.message); return; }
    if (secondaryBlocking) { toast.error(secondaryCheck.message); return; }
    setExporting(true);
    try {
      const url = await renderPosterPng();
      const mmW = dims.mm.w;
      const mmH = dims.mm.h;
      const pdf = new jsPDF({ unit: "mm", format: [mmW, mmH], orientation: mmW > mmH ? "landscape" : "portrait", compress: true });
      pdf.addImage(url, "PNG", 0, 0, mmW, mmH, undefined, "FAST");
      pdf.save(`qr-avaliacao-${est?.slug ?? "estabelecimento"}-${format}-300dpi.pdf`);
      toast.success(`PDF 300 DPI baixado (${mmW}×${mmH}mm)`);
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
            {/* Destination — Main QR */}
            <div className="space-y-3">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">QR principal</Label>

              {/* Fidelize / Google toggle */}
              <div className="grid grid-cols-2 gap-1 rounded-xl border bg-background/60 p-1">
                <button
                  type="button"
                  onClick={() => setDestination("fidelize")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${destination === "fidelize" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Star className="h-3.5 w-3.5" /> Avaliação Fidelize
                </button>
                <button
                  type="button"
                  onClick={() => setDestination("google")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${destination === "google" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <GoogleG className="h-3.5 w-3.5" /> Google Reviews
                </button>
              </div>

              {destination === "fidelize" ? (
                <div className="rounded-lg border bg-background/50 p-3 text-xs">
                  <div className="text-muted-foreground">Link público (pré-definido)</div>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-muted/60 px-2 py-1 text-primary">{fidelizeUrl}</code>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copyLink}><Copy className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={googleUrl}
                    onChange={(e) => setGoogleUrl(e.target.value)}
                    placeholder="https://g.page/r/XXXXXX/review"
                    maxLength={500}
                    aria-invalid={googleCheck.level === "error"}
                    className={`text-xs transition-colors ${
                      googleCheck.level === "error" ? "border-destructive focus-visible:ring-destructive/40" :
                      googleCheck.level === "warn"  ? "border-amber-500/60" :
                      googleCheck.level === "ok"    ? "border-emerald-500/60" : ""
                    }`}
                  />
                  <ValidationLine check={googleCheck} />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{googleUrl.length}/500</span>
                    {googleUrl && (
                      <button type="button" onClick={() => setGoogleUrl("")} className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive">
                        <XCircle className="h-3 w-3" /> limpar
                      </button>
                    )}
                  </div>
                  <label className="mt-1 flex cursor-pointer items-center justify-between gap-3 rounded-lg border bg-background/50 p-2.5">
                    <span className="flex items-center gap-2 text-xs font-medium">
                      <GoogleG className="h-4 w-4" /> Mostrar logo do Google no cartaz
                    </span>
                    <Switch checked={showGoogleLogo} onCheckedChange={setShowGoogleLogo} />
                  </label>
                </div>
              )}

              {/* Editable label shown ON the poster below the main QR */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">Texto no cartaz (QR principal)</Label>
                <Input
                  value={primaryLabel}
                  onChange={(e) => setPrimaryLabel(e.target.value)}
                  placeholder="Ex: Avalie nosso atendimento"
                  maxLength={40}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Secondary QR — Cardápio / Loja / etc */}
            <div className="space-y-3 rounded-xl border border-dashed border-border/60 p-3">
              <label className="flex cursor-pointer items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4 text-primary" /> Adicionar 2º QR Code
                  </div>
                  <div className="text-[11px] text-muted-foreground">Cardápio, loja, WhatsApp, Instagram — qualquer link extra no mesmo cartaz.</div>
                </div>
                <Switch checked={secondaryEnabled} onCheckedChange={setSecondaryEnabled} />
              </label>

              {secondaryEnabled && (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium text-muted-foreground">Link do 2º QR</Label>
                    <Input
                      value={secondaryUrl}
                      onChange={(e) => setSecondaryUrl(e.target.value)}
                      placeholder="https://seurestaurante.com/cardapio"
                      maxLength={500}
                      aria-invalid={secondaryCheck.level === "error"}
                      className={`text-xs transition-colors ${
                        secondaryCheck.level === "error" ? "border-destructive focus-visible:ring-destructive/40" :
                        secondaryCheck.level === "warn"  ? "border-amber-500/60" :
                        secondaryCheck.level === "ok"    ? "border-emerald-500/60" : ""
                      }`}
                    />
                    <ValidationLine check={secondaryCheck} />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{secondaryUrl.length}/500</span>
                      {secondaryUrl && (
                        <button type="button" onClick={() => setSecondaryUrl("")} className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive">
                          <XCircle className="h-3 w-3" /> limpar
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium text-muted-foreground">Texto no cartaz (2º QR)</Label>
                    <Input
                      value={secondaryLabel}
                      onChange={(e) => setSecondaryLabel(e.target.value)}
                      placeholder="Ex: Ver nosso cardápio"
                      maxLength={40}
                      className="text-xs"
                    />
                  </div>
                </div>
              )}
            </div>



            {/* Templates */}
            <div className="space-y-3">
              <Label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                <Layers className="h-3.5 w-3.5" /> Modelo de cartaz
              </Label>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => {
                  const t = TEMPLATES[k];
                  const active = template === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => applyTemplate(k)}
                      title={`${t.label} — ${t.description}`}
                      className={`group relative overflow-hidden rounded-lg border-2 p-1.5 text-left transition ${active ? "border-primary ring-2 ring-primary/30" : "border-border/60 hover:border-primary/40"}`}
                    >
                      <div className="mb-1 grid h-6 grid-cols-3 gap-0.5 rounded-sm p-0.5" style={{ background: t.defaults.backgroundColor }}>
                        <div className="rounded-[2px]" style={{ background: t.defaults.primaryColor }} />
                        <div className="rounded-[2px]" style={{ background: t.defaults.textColor, opacity: 0.6 }} />
                        <div className="rounded-[2px]" style={{ background: t.defaults.primaryColor, opacity: 0.5 }} />
                      </div>
                      <div className={`text-[10px] font-bold leading-tight truncate ${active ? "text-primary" : "text-foreground"}`}>{t.label}</div>
                    </button>
                  );
                })}
              </div>
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

              {/* CTA: Loja física */}
              <button
                type="button"
                onClick={() => document.getElementById("loja-displays")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="group relative w-full overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-r from-primary/15 via-primary/10 to-accent/15 p-3 text-left transition hover:border-primary hover:shadow-[0_0_30px_-8px_hsl(var(--primary)/0.6)]"
              >
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <div className="relative flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-foreground">Adquira seu display físico de balcão</div>
                    <div className="text-[11px] text-muted-foreground">Transforme mais clientes em avaliações 5★ — acrílico premium, NFC e brilho de vitrine.</div>
                  </div>
                  <span className="text-primary transition-transform group-hover:translate-x-1">→</span>
                </div>
              </button>
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
              <Switch
                checked={nfcMode}
                onCheckedChange={(v) => {
                  setNfcMode(v);
                  if (v) setLayout((prev) => ({ ...prev, nfc: { ...DEFAULT_LAYOUT.nfc } }));
                }}
              />
            </label>

            {nfcMode && (
              <div className="space-y-3 rounded-lg border border-primary/30 bg-primary-soft/40 p-3 text-xs">
                <div>
                  <div className="mb-1.5 font-semibold text-primary">Balão "Toque aqui"</div>
                  <div className="grid grid-cols-2 gap-1 rounded-md border bg-background/70 p-0.5">
                    <button
                      type="button"
                      onClick={() => { setNfcStyle("block"); setLayout((prev) => ({ ...prev, nfc: { ...DEFAULT_LAYOUT.nfc } })); }}
                      className={`rounded px-2 py-1.5 text-[11px] font-semibold transition ${nfcStyle === "block" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Mostrar balão
                    </button>
                    <button
                      type="button"
                      onClick={() => setNfcStyle("badge")}
                      className={`rounded px-2 py-1.5 text-[11px] font-semibold transition ${nfcStyle === "badge" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Ocultar balão
                    </button>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {nfcStyle === "block"
                      ? 'O selo NFC aparece no rodapé + balão "Toque aqui" no cartaz.'
                      : "Apenas o selo NFC discreto no rodapé. O balão fica oculto."}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-primary">URL para NFC</div>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-background/70 px-2 py-1">{targetUrl || "—"}</code>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copyNfcUrl}><Copy className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="mt-1.5 text-[11px] text-muted-foreground">
                    Use um app como <strong>NFC Tools</strong> (Android/iOS) para gravar essa URL na tag adesiva.
                  </div>
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

            {/* Saved designs */}
            <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary">
                <Palette className="h-3.5 w-3.5" /> Meus designs salvos
              </div>
              <div className="flex gap-2">
                <Input
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  placeholder="Nome do design (ex: Balcão azul)"
                  className="h-9 text-xs"
                  maxLength={40}
                />
                <Button onClick={saveCurrentDesign} size="sm" className="h-9 shrink-0">
                  <Save className="mr-1.5 h-3.5 w-3.5" /> Salvar
                </Button>
              </div>
              {designs.length > 0 ? (
                <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  {designs.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 rounded-lg border bg-background/70 p-1.5">
                      <button
                        type="button"
                        onClick={() => loadDesign(d)}
                        className="flex flex-1 items-center gap-2 rounded px-1.5 py-0.5 text-left hover:bg-primary/10"
                      >
                        <div
                          className="h-6 w-6 shrink-0 rounded-md ring-1 ring-border"
                          style={{ background: `linear-gradient(135deg, ${d.data.backgroundColor} 50%, ${d.data.primaryColor} 50%)` }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold">{d.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {TEMPLATES[d.data.template].label} · {FORMATS[d.data.format].label}
                          </div>
                        </div>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteDesign(d.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground">
                  Nenhum design salvo ainda. Ajuste as cores/textos e clique em Salvar para guardar variações.
                </div>
              )}
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

            {/* ===== STORE PREVIEW: Adquirir display físico ===== */}
            <div id="loja-displays" className="scroll-mt-4"><DisplayStorePreview /></div>
          </CardContent>
        </Card>

        {/* PREVIEW */}
        <div className="min-w-0">
          <div className="sticky top-4 flex flex-col items-center gap-3">
            {/* CTA: Loja física */}
            <button
              type="button"
              onClick={() => document.getElementById("loja-displays")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="group relative flex w-full max-w-[420px] items-center justify-between overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-r from-primary/15 via-primary/10 to-accent/15 p-3 text-left transition hover:border-primary hover:shadow-[0_0_30px_-8px_hsl(var(--primary)/0.6)]"
            >
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative flex items-center gap-2 text-xs font-bold">
                <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                Quero meu display físico de balcão
              </span>
              <span className="relative text-primary transition-transform group-hover:translate-x-1">→</span>
            </button>

            <div
              className="relative w-full max-w-[420px]"
              style={displayMode ? { perspective: "1600px", perspectiveOrigin: "50% 65%" } : undefined}
            >
              {/* Showroom backdrop — dark wall + wooden counter (only in display mode) */}
              {displayMode && (
                <div className="pointer-events-none absolute -inset-x-10 -inset-y-8 -z-10 overflow-hidden rounded-3xl">
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(ellipse at 50% 25%, #1a2540 0%, #0a0e1a 55%, #05070d 100%)",
                    }}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 h-[45%]"
                    style={{
                      background:
                        "linear-gradient(180deg, #3a2a1e 0%, #251710 45%, #120a06 100%)",
                      boxShadow: "inset 0 40px 60px -20px rgba(0,0,0,0.6)",
                    }}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 h-[45%] opacity-40"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, transparent 0 40px, rgba(255,255,255,0.04) 40px 41px)",
                    }}
                  />
                  {/* warm counter glow */}
                  <div
                    className="absolute inset-x-0 bottom-[35%] h-24"
                    style={{
                      background:
                        "radial-gradient(ellipse at 50% 100%, rgba(255,220,170,0.15), transparent 60%)",
                    }}
                  />
                </div>
              )}

              <div className="pointer-events-none absolute -inset-8 rounded-3xl bg-gradient-to-br from-primary/15 via-transparent to-transparent blur-3xl" />

              <div
                className="relative overflow-hidden rounded-lg shadow-2xl ring-1 ring-primary/20 transition-transform duration-500"
                style={{
                  aspectRatio: dims.aspect,
                  transform: displayMode ? "rotateX(12deg) rotateY(-3deg)" : undefined,
                  transformOrigin: "bottom center",
                  boxShadow: displayMode
                    ? "0 40px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,229,255,0.15)"
                    : undefined,
                }}
              >
                <PosterCanvas
                  ref={posterRef}
                  template={template}
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
                  nfcStyle={nfcStyle}
                  primaryLabel={primaryLabel}
                  secondaryEnabled={secondaryEnabled}
                  secondaryQrDataUrl={secondaryQrDataUrl}
                  secondaryLabel={secondaryLabel}
                  layout={layout}
                  setLayout={setLayout}
                  editable={editLayout}
                />

                {/* Acrylic glare overlay (mounted inside so it inherits transform) */}
                {displayMode && (
                  <>
                    <div
                      className="pointer-events-none absolute inset-0 z-20"
                      style={{
                        background:
                          "linear-gradient(115deg, rgba(255,255,255,0) 38%, rgba(255,255,255,0.32) 48%, rgba(255,255,255,0.05) 55%, rgba(255,255,255,0.18) 66%, rgba(255,255,255,0) 78%)",
                        mixBlendMode: "screen",
                      }}
                    />
                    <div
                      className="pointer-events-none absolute inset-0 z-20"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 30%)",
                        mixBlendMode: "screen",
                      }}
                    />
                    {/* side acrylic edges */}
                    <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[3px] bg-gradient-to-b from-white/70 via-white/25 to-white/40" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-[3px] bg-gradient-to-b from-white/70 via-white/25 to-white/40" />
                  </>
                )}
              </div>

              {/* Acrylic L-stand base (horizontal foot rotated flat) */}
              {displayMode && (
                <div
                  className="pointer-events-none absolute left-1/2 z-10"
                  style={{
                    bottom: "-2px",
                    width: "108%",
                    height: "34px",
                    transform: "translateX(-50%) rotateX(78deg)",
                    transformOrigin: "top center",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(220,230,240,0.35) 55%, rgba(180,200,220,0.15) 100%)",
                    borderRadius: "6px",
                    boxShadow:
                      "0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.7)",
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 45%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.5) 55%, transparent 100%)",
                      opacity: 0.55,
                      mixBlendMode: "screen",
                    }}
                  />
                </div>
              )}

              {/* Contact shadow under stand */}
              {displayMode && (
                <div
                  className="pointer-events-none mx-auto mt-4 h-6 w-[80%] rounded-[50%]"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 45%, transparent 75%)",
                    filter: "blur(6px)",
                  }}
                />
              )}
            </div>

            {/* Layout editor controls */}
            <div className="flex w-full max-w-[420px] flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={editLayout ? "default" : "outline"}
                onClick={() => setEditLayout((v) => !v)}
                className="h-8 gap-1.5 text-xs"
              >
                <Move className="h-3.5 w-3.5" />
                {editLayout ? "Concluir edição" : "Editar posições"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => { setLayout(DEFAULT_LAYOUT); toast.success("Posições restauradas"); }}
                className="h-8 gap-1.5 text-xs"
                disabled={JSON.stringify(layout) === JSON.stringify(DEFAULT_LAYOUT)}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Resetar posições
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {editLayout
                ? "Arraste cada elemento (logo, título, QR, textos) para reposicionar. Toque em Concluir para exportar."
                : displayMode
                ? "Simulação em display acrílico de balcão — inclinado 12° para trás."
                : `Preview em escala. Exportação em 300 DPI — ${Math.round((dims.mm.w/25.4)*300)}×${Math.round((dims.mm.h/25.4)*300)}px (${dims.mm.w}×${dims.mm.h}mm).`}
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
  template: TemplateKey;
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
  nfcStyle: "block" | "badge";
  primaryLabel: string;
  secondaryEnabled: boolean;
  secondaryQrDataUrl: string;
  secondaryLabel: string;
  layout: PosterLayout;
  setLayout: (updater: (prev: PosterLayout) => PosterLayout) => void;
  editable: boolean;
}

const PosterCanvas = forwardRef<HTMLDivElement, PosterProps>(function PosterCanvas(props, ref) {
  const bg = props.template === "glass"
    ? `radial-gradient(120% 80% at 50% 0%, color-mix(in oklab, ${props.primaryColor} 22%, transparent) 0%, transparent 60%), ${props.backgroundColor}`
    : props.backgroundColor;
  const overlay = props.template === "editorial"
    ? "repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0 1px, transparent 1px 4px)"
    : props.template === "bold"
      ? `radial-gradient(circle at 20% 10%, color-mix(in oklab, #ffffff 20%, transparent) 0%, transparent 40%)`
      : "none";
  return (
    <div
      ref={ref}
      className="absolute inset-0"
      style={{ background: bg, color: props.textColor }}
    >
      {overlay !== "none" && (
        <div className="pointer-events-none absolute inset-0" style={{ background: overlay }} />
      )}
      <PortraitBody {...props} />
    </div>
  );
});

/**
 * Renders a single draggable poster element positioned by percentage.
 * When editable=true, the item shows a dashed guide and reacts to pointer drag,
 * updating its (x, y) center coordinates in the shared layout state.
 */
function DraggableItem({
  itemKey, layout, setLayout, editable, className = "", style, children,
}: {
  itemKey: LayoutKey;
  layout: PosterLayout;
  setLayout: (updater: (prev: PosterLayout) => PosterLayout) => void;
  editable: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pos = layout[itemKey];

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable) return;
    const parent = ref.current?.parentElement;
    if (!parent) return;
    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || !draggingRef.current) return;
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100));
    setLayout((prev) => ({ ...prev, [itemKey]: { x, y } }));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`absolute ${editable ? "cursor-move select-none" : ""} ${className}`}
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: "translate(-50%, -50%)",
        touchAction: editable ? "none" : undefined,
        ...style,
      }}
    >
      {editable && (
        <div
          data-export-ignore="true"
          className="pointer-events-none absolute -inset-2 rounded-md border border-dashed border-primary/70 bg-primary/5"
        >
          <div className="absolute -top-4 left-0 whitespace-nowrap rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary-foreground shadow">
            {LAYOUT_LABELS[itemKey]}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

const LAYOUT_LABELS: Record<LayoutKey, string> = {
  header: "Logo",
  title: "Título",
  subtitle: "Subtítulo",
  primaryQr: "QR principal",
  secondaryQr: "2º QR",
  nfc: "NFC",
  ctaNear: "Chamada",
  ctaFooter: "Rodapé",
};

function PortraitBody(p: PosterProps) {
  const primarySize = p.secondaryEnabled ? 104 : 128;
  return (
    <div className="relative h-full w-full">
      {/* Header block (logo + name + stars) */}
      <DraggableItem itemKey="header" layout={p.layout} setLayout={p.setLayout} editable={p.editable}>
        <div className="flex flex-col items-center gap-1">
          <BrandLogo url={p.logoUrl} name={p.establishmentName} primary={p.primaryColor} />
          <div className="text-sm font-bold" style={{ color: p.textColor }}>{p.establishmentName}</div>
          <Stars color={p.primaryColor} size={14} center />
        </div>
      </DraggableItem>

      {/* Title */}
      <DraggableItem itemKey="title" layout={p.layout} setLayout={p.setLayout} editable={p.editable} className="w-[90%]">
        <h2 className="text-center text-xl font-black leading-tight" style={{ color: p.textColor }}>{p.title}</h2>
      </DraggableItem>

      {/* Subtitle */}
      <DraggableItem itemKey="subtitle" layout={p.layout} setLayout={p.setLayout} editable={p.editable} className="w-[80%]">
        <p className="text-center text-[11px] opacity-70" style={{ color: p.textColor }}>{p.subtitle}</p>
      </DraggableItem>

      {/* Primary QR */}
      <DraggableItem itemKey="primaryQr" layout={p.layout} setLayout={p.setLayout} editable={p.editable}>
        <LabeledQr
          qr={p.qrDataUrl}
          label={p.primaryLabel}
          primary={p.primaryColor}
          text={p.textColor}
          badge={p.destination === "google" && p.showGoogleLogo ? "google" : null}
          size={primarySize}
        />
      </DraggableItem>

      {/* Secondary QR */}
      {p.secondaryEnabled && (
        <DraggableItem itemKey="secondaryQr" layout={p.layout} setLayout={p.setLayout} editable={p.editable}>
          <LabeledQr
            qr={p.secondaryQrDataUrl}
            label={p.secondaryLabel}
            primary={p.primaryColor}
            text={p.textColor}
            badge={null}
            size={104}
          />
        </DraggableItem>
      )}

      {/* NFC "Toque aqui" block — only when NFC mode + block style + no secondary */}
      {p.nfcMode && p.nfcStyle === "block" && !p.secondaryEnabled && (
        <DraggableItem itemKey="nfc" layout={p.layout} setLayout={p.setLayout} editable={p.editable}>
          <NfcBlock primary={p.primaryColor} />
        </DraggableItem>
      )}

      {/* CTA near QR */}
      <DraggableItem itemKey="ctaNear" layout={p.layout} setLayout={p.setLayout} editable={p.editable} className="w-[90%]">
        <div className="text-center text-xs font-bold uppercase tracking-widest" style={{ color: p.primaryColor }}>
          {p.nfcMode && p.nfcStyle === "block" && !p.secondaryEnabled ? "Aproxime o celular" : p.ctaNearQR}
        </div>
      </DraggableItem>

      {/* CTA footer */}
      <DraggableItem itemKey="ctaFooter" layout={p.layout} setLayout={p.setLayout} editable={p.editable} className="w-[90%]">
        <div className="flex flex-col items-center gap-1">
          <div className="text-center text-[10px] opacity-70" style={{ color: p.textColor }}>{p.ctaFooter}</div>
          {p.nfcMode && <NfcBadge primary={p.primaryColor} />}
        </div>
      </DraggableItem>
    </div>
  );
}

/** Compact inline validation message for URL fields. */
function ValidationLine({ check }: { check: UrlCheck }) {
  if (check.level === "empty") {
    return <div className="text-[11px] text-muted-foreground">{check.message}</div>;
  }
  if (check.level === "ok") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-500">
        <CheckCircle2 className="h-3.5 w-3.5" /> {check.message}
      </div>
    );
  }
  if (check.level === "warn") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-500">
        <AlertTriangle className="h-3.5 w-3.5" /> {check.message}
      </div>
    );
  }
  return (
    <div role="alert" className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive">
      <XCircle className="h-3.5 w-3.5" /> {check.message}
    </div>
  );
}

function LabeledQr({ qr, label, primary, text, badge, size }: { qr: string; label: string; primary: string; text: string; badge: "google" | null; size: number }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="rounded-xl bg-white p-2.5 shadow-lg">
        {qr ? (
          <img src={qr} alt={label} className="block" style={{ width: size, height: size }} />
        ) : (
          <div className="grid place-items-center text-[10px] text-slate-400" style={{ width: size, height: size }}>gerando…</div>
        )}
      </div>
      {label && (
        <div className="max-w-[16ch] text-center text-[10px] font-bold leading-tight" style={{ color: text }}>
          {label}
        </div>
      )}
      {badge === "google" && <GoogleBadge />}
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
