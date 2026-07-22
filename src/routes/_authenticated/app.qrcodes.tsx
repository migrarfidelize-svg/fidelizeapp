import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { Palette as HeroIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Download, Share2, FileImage, FileText, Printer, Palette, Settings2, Sparkles, Loader2, Image as ImageIcon, Save, Trash2, CheckCircle2, AlertTriangle, Layers, Undo2, Redo2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { toPng, toJpeg } from "html-to-image";
import { jsPDF } from "jspdf";
import { PromoPoster, FORMATS, SEGMENT_LABEL, type PromoConfig, type PromoFormat, type Segment } from "@/components/PromoPoster";
import { LogoUploadButton } from "@/components/LogoUploadButton";
import { LoadingSkeleton } from "@/components/states";



export const Route = createFileRoute("/_authenticated/app/qrcodes")({
  head: () => ({ meta: [{ title: "Divulgação — Fidelize" }] }),
  component: QRCodes,
});

type SegmentPreset = {
  primary: string; accent: string; bg: string; text: string;
  title: string; subtitle: string; ctaNearQR: string; ctaFooter: string; rewardHint: string;
};
const SEGMENT_PRESETS: Record<Segment, SegmentPreset> = {
  espetinhos: {
    primary: "#c1121f", accent: "#f77f00", bg: "#fff8f0", text: "#1a0a05",
    title: "Seu próximo espetinho pode ser grátis!",
    subtitle: "Escaneie o QR Code, crie seu cartão digital e acumule carimbos a cada pedido. Sem app, sem burocracia.",
    ctaNearQR: "Aponte a câmera e participe",
    ctaFooter: "Peça, carimbe, ganhe.",
    rewardHint: "Complete {n} carimbos e ganhe {reward}.",
  },
  cafeteria: {
    primary: "#6f4e37", accent: "#c19a6b", bg: "#fdf6ec", text: "#1c1208",
    title: "Cada café te leva mais perto de um grátis.",
    subtitle: "Cadastre-se em segundos e comece a colecionar carimbos digitais a cada visita.",
    ctaNearQR: "Aponte a câmera do celular",
    ctaFooter: "Beba, colecione, ganhe.",
    rewardHint: "A cada {n} cafés, o próximo é por nossa conta.",
  },
  barbearia: {
    primary: "#1f2937", accent: "#d4a017", bg: "#f5f3ef", text: "#0f172a",
    title: "Estilo que rende recompensa.",
    subtitle: "Escaneie, crie seu cartão fidelidade e ganhe cortes exclusivos a cada visita.",
    ctaNearQR: "Escaneie para entrar",
    ctaFooter: "Corte, marque, ganhe.",
    rewardHint: "Complete {n} cortes e ganhe {reward}.",
  },
  petshop: {
    primary: "#2563eb", accent: "#f59e0b", bg: "#eff6ff", text: "#0f172a",
    title: "Mais mimos pro seu pet a cada visita.",
    subtitle: "Cadastre-se e acumule carimbos em banhos, tosas e produtos.",
    ctaNearQR: "Aponte a câmera",
    ctaFooter: "Cuide, colecione, ganhe.",
    rewardHint: "A cada {n} visitas, ganhe {reward}.",
  },
  lavajato: {
    primary: "#0284c7", accent: "#38bdf8", bg: "#f0f9ff", text: "#0c1e2b",
    title: "Lave, junte carimbos, ganhe um grátis.",
    subtitle: "Cartão fidelidade digital sem baixar nada. Rápido, fácil e sempre no seu celular.",
    ctaNearQR: "Escaneie e participe",
    ctaFooter: "Brilho recompensado.",
    rewardHint: "Complete {n} lavagens e ganhe {reward}.",
  },
  salao: {
    primary: "#be185d", accent: "#f472b6", bg: "#fdf2f8", text: "#2a0a1c",
    title: "Beleza que vira recompensa.",
    subtitle: "Escaneie o QR Code, monte seu cartão fidelidade e ganhe serviços exclusivos.",
    ctaNearQR: "Aponte a câmera",
    ctaFooter: "Cuide-se, colecione, ganhe.",
    rewardHint: "A cada {n} visitas, ganhe {reward}.",
  },
  restaurante: {
    primary: "#b91c1c", accent: "#f59e0b", bg: "#fff7ed", text: "#1a0a05",
    title: "Comer aqui tem recompensa.",
    subtitle: "Cadastre-se e ganhe carimbos a cada pedido. Sem baixar aplicativo.",
    ctaNearQR: "Aponte a câmera do celular",
    ctaFooter: "Peça, carimbe, ganhe.",
    rewardHint: "A cada {n} pedidos, ganhe {reward}.",
  },
  oficina: {
    primary: "#1f2937", accent: "#f97316", bg: "#f3f4f6", text: "#0f172a",
    title: "Cuide do seu carro e ganhe por isso.",
    subtitle: "Cartão fidelidade digital para clientes fiéis. Escaneie e comece agora.",
    ctaNearQR: "Escaneie para participar",
    ctaFooter: "Manutenção que compensa.",
    rewardHint: "A cada {n} serviços, ganhe {reward}.",
  },
  loja: {
    primary: "#7c3aed", accent: "#22d3ee", bg: "#f5f3ff", text: "#1a0f2e",
    title: "Compre, colecione, ganhe.",
    subtitle: "Escaneie o QR Code e monte seu cartão fidelidade em segundos.",
    ctaNearQR: "Aponte a câmera",
    ctaFooter: "Sua fidelidade vale prêmio.",
    rewardHint: "A cada {n} compras, ganhe {reward}.",
  },
  outro: {
    primary: "#7c3aed", accent: "#f472b6", bg: "#faf5ff", text: "#1a0f2e",
    title: "Ganhe recompensas a cada visita!",
    subtitle: "Escaneie o QR Code, crie seu cartão fidelidade digital e comece a acumular carimbos.",
    ctaNearQR: "Aponte a câmera e participe",
    ctaFooter: "Escaneie e participe agora",
    rewardHint: "Complete {n} carimbos e ganhe {reward}.",
  },
};
const SEGMENT_DEFAULTS: Record<Segment, { primary: string; accent: string; bg: string }> = Object.fromEntries(
  (Object.keys(SEGMENT_PRESETS) as Segment[]).map((k) => [k, { primary: SEGMENT_PRESETS[k].primary, accent: SEGMENT_PRESETS[k].accent, bg: SEGMENT_PRESETS[k].bg }])
) as Record<Segment, { primary: string; accent: string; bg: string }>;

// ============ WCAG contrast helpers ============
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(f, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const norm = [r, g, b].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * norm[0] + 0.7152 * norm[1] + 0.0722 * norm[2];
}
function contrastRatio(a: string, b: string) {
  const l1 = luminance(a), l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// ============ Palette extraction from background image ============
type Palette = { primary: string; accent: string; bg: string; text: string; overlaySuggestion: number };
function extractPalette(url: string): Promise<Palette> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const W = 80, H = 80;
        const c = document.createElement("canvas");
        c.width = W; c.height = H;
        const ctx = c.getContext("2d");
        if (!ctx) return reject(new Error("canvas indisponível"));
        ctx.drawImage(img, 0, 0, W, H);
        const data = ctx.getImageData(0, 0, W, H).data;
        const bins = new Map<string, { r: number; g: number; b: number; n: number }>();
        let sr = 0, sg = 0, sb = 0, sn = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          sr += r; sg += g; sb += b; sn++;
          const k = `${r >> 4},${g >> 4},${b >> 4}`;
          const cur = bins.get(k);
          if (cur) { cur.r += r; cur.g += g; cur.b += b; cur.n += 1; }
          else bins.set(k, { r, g, b, n: 1 });
        }
        if (sn === 0) return reject(new Error("imagem vazia"));
        const arr = [...bins.values()].map(o => ({ r: (o.r / o.n) | 0, g: (o.g / o.n) | 0, b: (o.b / o.n) | 0, n: o.n }));
        arr.sort((a, b) => b.n - a.n);
        const avg = { r: (sr / sn) | 0, g: (sg / sn) | 0, b: (sb / sn) | 0 };
        // Primary = most saturated among top bins; darken for good QR contrast
        const sat = (c: { r: number; g: number; b: number }) => {
          const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b);
          return mx === 0 ? 0 : (mx - mn) / mx;
        };
        const top = arr.slice(0, 10);
        const primaryRaw = [...top].sort((a, b) => sat(b) - sat(a))[0] ?? arr[0];
        // Accent = most different (weighted) from primary among top bins
        const dist2 = (a: any, b: any) => (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
        let accent = top.find((c) => c !== primaryRaw) ?? primaryRaw;
        for (const c of top) if (c !== primaryRaw && dist2(c, primaryRaw) > dist2(accent, primaryRaw)) accent = c;
        const toHex = (r: number, g: number, b: number) => "#" + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
        const shade = (c: { r: number; g: number; b: number }, k: number) => ({ r: (c.r * k) | 0, g: (c.g * k) | 0, b: (c.b * k) | 0 });
        const primary = ((): string => {
          // ensure contrast >= 4.0 vs white
          let k = 1;
          for (let i = 0; i < 6; i++) {
            const c = shade(primaryRaw, k);
            const hex = toHex(c.r, c.g, c.b);
            if (contrastRatio(hex, "#ffffff") >= 4.2) return hex;
            k -= 0.15;
          }
          return toHex(0x1f, 0x29, 0x37);
        })();
        const bgLum = (0.2126 * avg.r + 0.7152 * avg.g + 0.0722 * avg.b) / 255;
        const text = bgLum > 0.55 ? "#0f172a" : "#ffffff";
        const bgHex = text === "#ffffff" ? "#0b0f1a" : "#ffffff"; // used behind the overlay to lighten/darken
        const overlaySuggestion = bgLum > 0.7 ? 0.15 : bgLum > 0.45 ? 0.35 : 0.55;
        return resolve({ primary, accent: toHex(accent.r, accent.g, accent.b), bg: bgHex, text, overlaySuggestion });
      } catch (e) { reject(e as Error); }
    };
    img.onerror = () => reject(new Error("falha ao carregar imagem"));
    img.src = url;
  });
}



// ============ Variations (localStorage) ============
type SavedVariation = { id: string; name: string; savedAt: number; state: StoredState };
type StoredState = {
  format: PromoFormat; segment: Segment; title: string; subtitle: string;
  ctaNearQR: string; ctaFooter: string; rewardTextOverride: string;
  primaryColor: string; accentColor: string; backgroundColor: string; textColor: string;
  showBrand: boolean; bgImageUrl: string | null; bgZoom: number; bgOffsetX: number; bgOffsetY: number; bgOverlay: number;
  qrScale?: number;
  qrColor?: string;
  cornerStyle?: "sharp" | "rounded";
  cornerRadiusPct?: number;
};
const storageKey = (estId: string) => `fidelize-promos-v1-${estId}`;
function loadVariations(estId: string): SavedVariation[] {
  try { return JSON.parse(localStorage.getItem(storageKey(estId)) ?? "[]"); } catch { return []; }
}
function saveVariations(estId: string, list: SavedVariation[]) {
  localStorage.setItem(storageKey(estId), JSON.stringify(list));
}

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

  const [format, setFormat] = useState<PromoFormat>("story");
  const [segment, setSegment] = useState<Segment>("espetinhos");
  const [title, setTitle] = useState("Ganhe recompensas a cada visita!");
  const [subtitle, setSubtitle] = useState("Escaneie o QR Code, crie seu cartão fidelidade digital e comece a acumular carimbos. É rápido, gratuito e não precisa baixar aplicativo.");
  const [ctaNearQR, setCtaNearQR] = useState("Aponte a câmera e participe");
  const [ctaFooter, setCtaFooter] = useState("Escaneie e participe agora");
  const [rewardTextOverride, setRewardTextOverride] = useState("");
  const [primaryColor, setPrimaryColor] = useState<string>(SEGMENT_DEFAULTS.espetinhos.primary);
  const [qrColor, setQrColor] = useState<string>("#111827");
  const [accentColor, setAccentColor] = useState<string>(SEGMENT_DEFAULTS.espetinhos.accent);
  const [backgroundColor, setBackgroundColor] = useState<string>(SEGMENT_DEFAULTS.espetinhos.bg);
  const [textColor, setTextColor] = useState<string>("#111827");
  const [showBrand, setShowBrand] = useState(true);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [showCropMarks, setShowCropMarks] = useState(true);
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [bgZoom, setBgZoom] = useState(1);
  const [bgOffsetX, setBgOffsetX] = useState(0);
  const [bgOffsetY, setBgOffsetY] = useState(0);
  const [bgOverlay, setBgOverlay] = useState(0.35);
  // QR size: 1.0 baseline; auto picks a good default per format
  const AUTO_QR_SCALE: Record<PromoFormat, number> = { story: 1.05, feed: 0.95, counter: 1.15 };
  const [qrScale, setQrScale] = useState<number>(AUTO_QR_SCALE.story);
  const [qrAuto, setQrAuto] = useState(true);
  const [cornerStyle, setCornerStyle] = useState<"sharp" | "rounded">("sharp");
  const [cornerRadiusPct, setCornerRadiusPct] = useState<number>(0);
  useEffect(() => { if (qrAuto) setQrScale(AUTO_QR_SCALE[format]); }, [format, qrAuto]);
  const [exporting, setExporting] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [variations, setVariations] = useState<SavedVariation[]>([]);
  const [variationName, setVariationName] = useState("");

  useEffect(() => { if (est?.id) setVariations(loadVariations(est.id)); }, [est?.id]);

  useEffect(() => {
    if (est) {
      if (est.primary_color) setPrimaryColor(est.primary_color);
      if (est.accent_color) setAccentColor(est.accent_color);
    }
  }, [est?.id]);

  // QR generation
  useEffect(() => {
    if (!publicUrl) return;
    QRCode.toDataURL(publicUrl, { width: 1200, margin: 1, errorCorrectionLevel: "H", color: { dark: qrColor, light: "#ffffff" } }).then(setQrDataUrl);
  }, [publicUrl, qrColor]);

  // Scannability: QR dark modules vs white module background
  const qrContrast = useMemo(() => contrastRatio(qrColor, "#ffffff"), [qrColor]);
  const qrOk = qrContrast >= 4.5;
  const qrWarn = qrContrast < 4.5 && qrContrast >= 3.0;
  const qrBad = qrContrast < 3.0;

  // Contrast between QR white card and poster background (so it doesn't blend in)
  const cardVsBgContrast = useMemo(() => contrastRatio("#ffffff", backgroundColor), [backgroundColor]);
  const cardBlend = !bgImageUrl && cardVsBgContrast < 1.3;

  // Auto-fix: darken QR color progressively until it reaches WCAG 4.5:1 vs white
  function autoFixQrContrast() {
    const { r, g, b } = hexToRgb(qrColor);
    const toHex = (r: number, g: number, b: number) =>
      "#" + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
    let cur = { r, g, b };
    for (let i = 0; i < 24; i++) {
      const hex = toHex(cur.r, cur.g, cur.b);
      if (contrastRatio(hex, "#ffffff") >= 4.5) {
        setQrColor(hex);
        toast.success("Cor do QR ajustada para máxima legibilidade");
        return;
      }
      cur = { r: Math.round(cur.r * 0.88), g: Math.round(cur.g * 0.88), b: Math.round(cur.b * 0.88) };
    }
    setQrColor("#111827");
    toast.success("Cor do QR ajustada para máxima legibilidade");
  }


  const rewardText = useMemo(() => {
    if (rewardTextOverride.trim()) return rewardTextOverride.trim();
    if (!activeCampaign) return "Complete carimbos e ganhe uma recompensa exclusiva.";
    return `Complete ${activeCampaign.stamps_required} carimbos e ganhe ${activeCampaign.reward_title.toLowerCase()}.`;
  }, [rewardTextOverride, activeCampaign]);

  const contactLine = useMemo(() => {
    if (!est) return undefined;
    return [est.instagram && `@${est.instagram.replace("@", "")}`, est.whatsapp, est.address].filter(Boolean).join(" · ") || undefined;
  }, [est]);

  const buildConfig = useCallback((overrides: Partial<PromoConfig> = {}): PromoConfig => ({
    format, segment, title, subtitle, ctaNearQR, ctaFooter, rewardText,
    primaryColor, accentColor, backgroundColor, textColor, showBrand,
    establishmentName: est?.name ?? "Seu estabelecimento",
    logoUrl: est?.logo_url, qrDataUrl, publicUrl,
    benefits: ["Cartão sempre no celular", "Nenhum aplicativo necessário", "Recompensas exclusivas", "Cadastro em segundos"],
    contactLine, bgImageUrl, bgZoom, bgOffsetX, bgOffsetY, bgOverlay,
    showCropMarks, showSafeArea, qrScale, qrColor, cornerStyle, cornerRadiusPct,
    ...overrides,
  }), [format, segment, title, subtitle, ctaNearQR, ctaFooter, rewardText, primaryColor, accentColor, backgroundColor, textColor, showBrand, est, qrDataUrl, publicUrl, contactLine, bgImageUrl, bgZoom, bgOffsetX, bgOffsetY, bgOverlay, showCropMarks, showSafeArea, qrScale, qrColor, cornerStyle, cornerRadiusPct]);

  const config = buildConfig();
  const dims = FORMATS[format];

  // Fit preview
  const [previewScale, setPreviewScale] = useState(0.35);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function fit() {
      if (!previewWrapRef.current) return;
      const rect = previewWrapRef.current.getBoundingClientRect();
      const pad = 32;
      const sx = (rect.width - pad) / dims.w;
      const sy = (rect.height - pad) / dims.h;
      setPreviewScale(Math.max(0.06, Math.min(sx, sy)));
    }
    fit();
    const ro = new ResizeObserver(fit);
    if (previewWrapRef.current) ro.observe(previewWrapRef.current);
    window.addEventListener("resize", fit);
    return () => { ro.disconnect(); window.removeEventListener("resize", fit); };
  }, [dims.w, dims.h]);

  function onBgUpload(file: File) {
    if (file.size > 8 * 1024 * 1024) { toast.error("Imagem muito grande (máx 8MB)"); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const url = reader.result as string;
      setBgImageUrl(url);
      try {
        const palette = await extractPalette(url);
        setPrimaryColor(palette.primary);
        setAccentColor(palette.accent);
        setBackgroundColor(palette.bg);
        setTextColor(palette.text);
        setBgOverlay(palette.overlaySuggestion);
        toast.success("Imagem aplicada — cores ajustadas automaticamente");
      } catch {
        toast.success("Imagem de fundo aplicada");
      }
    };
    reader.readAsDataURL(file);
  }

  async function reExtractPalette() {
    if (!bgImageUrl) { toast.info("Envie uma imagem de fundo primeiro"); return; }
    try {
      const p = await extractPalette(bgImageUrl);
      setPrimaryColor(p.primary); setAccentColor(p.accent); setBackgroundColor(p.bg); setTextColor(p.text); setBgOverlay(p.overlaySuggestion);
      toast.success("Cores reajustadas a partir da imagem");
    } catch { toast.error("Não foi possível analisar a imagem"); }
  }

  const fileBase = `${est?.slug ?? "fidelize"}-${format}`;
  function downloadDataUrl(dataUrl: string, filename: string) {
    const a = document.createElement("a");
    a.href = dataUrl; a.download = filename; a.click();
  }

  async function capture(node: HTMLElement, type: "png" | "jpeg" = "png") {
    const opts: any = { pixelRatio: 1, cacheBust: true, backgroundColor: type === "jpeg" ? "#ffffff" : undefined };
    return type === "png" ? await toPng(node, opts) : await toJpeg(node, { ...opts, quality: 0.95 });
  }

  async function preflight(): Promise<boolean> {
    if (!qrDataUrl) { toast.error("QR ainda não foi gerado"); return false; }
    if (qrBad) {
      const ok = confirm("A cor do QR tem contraste muito baixo com o fundo branco (leitura pode falhar). Continuar mesmo assim?");
      if (!ok) return false;
    } else if (qrWarn) {
      toast.warning("Contraste do QR está no limite — teste a leitura antes de imprimir em grande escala.");
    }
    return true;
  }

  async function exportPNG() {
    if (!posterRef.current || !(await preflight())) return;
    setExporting(true);
    try { downloadDataUrl(await capture(posterRef.current, "png"), `${fileBase}.png`); }
    catch (e: any) { toast.error("Falha: " + e?.message); }
    finally { setExporting(false); }
  }
  async function exportJPG() {
    if (!posterRef.current || !(await preflight())) return;
    setExporting(true);
    try { downloadDataUrl(await capture(posterRef.current, "jpeg"), `${fileBase}.jpg`); }
    catch (e: any) { toast.error("Falha: " + e?.message); }
    finally { setExporting(false); }
  }
  async function exportPDF() {
    if (!posterRef.current || !(await preflight())) return;
    setExporting(true);
    try {
      const dataUrl = await capture(posterRef.current, "png");
      // Use physical mm when available (true-scale print), else pixels
      const pdf = dims.mm
        ? new jsPDF({ orientation: dims.mm.w > dims.mm.h ? "landscape" : "portrait", unit: "mm", format: [dims.mm.w, dims.mm.h] })
        : new jsPDF({ orientation: dims.w > dims.h ? "landscape" : "portrait", unit: "px", format: [dims.w, dims.h] });
      const w = dims.mm ? dims.mm.w : dims.w;
      const h = dims.mm ? dims.mm.h : dims.h;
      pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
      pdf.save(`${fileBase}.pdf`);
      if (dims.mm) toast.success(`PDF exportado em ${dims.mm.w}×${dims.mm.h}mm (com sangria)`);
    } catch (e: any) { toast.error("Falha: " + e?.message); }
    finally { setExporting(false); }
  }
  async function printArt() {
    if (!posterRef.current || !(await preflight())) return;
    setExporting(true);
    try {
      const d = await capture(posterRef.current, "png");
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Imprimir material do QR Code</title><style>@page{margin:0}body{margin:0;display:flex;justify-content:center;align-items:center}img{max-width:100%;max-height:100vh}</style></head><body><img src="${d}" alt="Material promocional do QR Code" onload="setTimeout(()=>window.print(),300)"/></body></html>`);
      w.document.close();
    } finally { setExporting(false); }
  }
  async function shareArt() {
    if (!posterRef.current || !(await preflight())) return;
    setExporting(true);
    try {
      const d = await capture(posterRef.current, "png");
      const blob = await (await fetch(d)).blob();
      const file = new File([blob], `${fileBase}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: est?.name, text: title });
      } else {
        downloadDataUrl(d, `${fileBase}.png`);
        toast.info("Compartilhamento indisponível — baixamos o arquivo.");
      }
    } finally { setExporting(false); }
  }

  // ---------- Variations ----------
  function currentState(): StoredState {
    return { format, segment, title, subtitle, ctaNearQR, ctaFooter, rewardTextOverride, primaryColor, accentColor, backgroundColor, textColor, showBrand, bgImageUrl, bgZoom, bgOffsetX, bgOffsetY, bgOverlay, qrScale, qrColor, cornerStyle, cornerRadiusPct };
  }
  function applyState(s: StoredState) {
    setFormat(s.format); setSegment(s.segment); setTitle(s.title); setSubtitle(s.subtitle);
    setCtaNearQR(s.ctaNearQR); setCtaFooter(s.ctaFooter); setRewardTextOverride(s.rewardTextOverride);
    setPrimaryColor(s.primaryColor); setAccentColor(s.accentColor); setBackgroundColor(s.backgroundColor); setTextColor(s.textColor);
    setShowBrand(s.showBrand); setBgImageUrl(s.bgImageUrl); setBgZoom(s.bgZoom); setBgOffsetX(s.bgOffsetX); setBgOffsetY(s.bgOffsetY); setBgOverlay(s.bgOverlay);
    if (typeof s.qrScale === "number") { setQrAuto(false); setQrScale(s.qrScale); }
    if (typeof s.qrColor === "string") setQrColor(s.qrColor);
    if (s.cornerStyle === "sharp" || s.cornerStyle === "rounded") setCornerStyle(s.cornerStyle);
    if (typeof s.cornerRadiusPct === "number") setCornerRadiusPct(s.cornerRadiusPct);
  }
  function saveVariation() {
    if (!est?.id) return;
    const name = variationName.trim() || `Variação ${variations.length + 1}`;
    const v: SavedVariation = { id: crypto.randomUUID(), name, savedAt: Date.now(), state: currentState() };
    const next = [v, ...variations];
    setVariations(next); saveVariations(est.id, next); setVariationName("");
    toast.success(`"${name}" salva`);
  }
  function loadVariation(id: string) {
    const v = variations.find((x) => x.id === id); if (!v) return;
    applyState(v.state); toast.success(`"${v.name}" carregada`);
  }
  function deleteVariation(id: string) {
    if (!est?.id) return;
    const next = variations.filter((x) => x.id !== id);
    setVariations(next); saveVariations(est.id, next);
  }
  function renameVariation(id: string) {
    if (!est?.id) return;
    const v = variations.find((x) => x.id === id); if (!v) return;
    const newName = prompt("Novo nome:", v.name)?.trim();
    if (!newName) return;
    const next = variations.map((x) => x.id === id ? { ...x, name: newName } : x);
    setVariations(next); saveVariations(est.id, next);
  }

  // Export ALL variations as PDFs — renders each hidden and captures
  const [batchNode, setBatchNode] = useState<PromoConfig | null>(null);
  const batchRef = useRef<HTMLDivElement>(null);
  const batchResolveRef = useRef<((n: HTMLElement) => void) | null>(null);
  useEffect(() => {
    if (batchNode && batchRef.current && batchResolveRef.current) {
      // wait a tick for images/QR to paint
      const el = batchRef.current;
      setTimeout(() => batchResolveRef.current?.(el), 400);
    }
  }, [batchNode]);
  function renderBatch(cfg: PromoConfig): Promise<HTMLElement> {
    return new Promise((resolve) => { batchResolveRef.current = resolve; setBatchNode(cfg); });
  }
  async function exportAllVariations() {
    if (!variations.length) { toast.info("Nenhuma variação salva"); return; }
    setExporting(true);
    try {
      for (const v of variations) {
        // regenerate QR with variation's primary
        const qrHex = v.state.qrColor ?? v.state.primaryColor;
        const qr = await QRCode.toDataURL(publicUrl, { width: 1200, margin: 1, errorCorrectionLevel: "H", color: { dark: qrHex, light: "#ffffff" } });
        const cfg: PromoConfig = {
          ...v.state, rewardText: v.state.rewardTextOverride.trim() || rewardText,
          establishmentName: est?.name ?? "", logoUrl: est?.logo_url, qrDataUrl: qr, publicUrl,
          benefits: config.benefits, contactLine, showCropMarks: true, showSafeArea: false,
          qrColor: qrHex,
        };
        const node = await renderBatch(cfg);
        const dataUrl = await capture(node, "png");
        const d = FORMATS[cfg.format];
        const pdf = d.mm
          ? new jsPDF({ orientation: d.mm.w > d.mm.h ? "landscape" : "portrait", unit: "mm", format: [d.mm.w, d.mm.h] })
          : new jsPDF({ orientation: d.w > d.h ? "landscape" : "portrait", unit: "px", format: [d.w, d.h] });
        const w = d.mm ? d.mm.w : d.w;
        const h = d.mm ? d.mm.h : d.h;
        pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
        pdf.save(`${est?.slug ?? "fidelize"}-${v.name.replace(/[^a-z0-9-]+/gi, "_")}.pdf`);
      }
      toast.success(`${variations.length} variação(ões) exportadas`);
    } catch (e: any) { toast.error("Falha em lote: " + e?.message); }
    finally { setBatchNode(null); setExporting(false); }
  }

  // ---------- History (undo/redo) ----------
  const HISTORY_LIMIT = 60;
  const historyRef = useRef<{ past: string[]; future: string[]; lastSig: string }>({ past: [], future: [], lastSig: "" });
  const isApplyingRef = useRef(false);
  const [historyTick, setHistoryTick] = useState(0);
  const stateSig = JSON.stringify(currentState());
  useEffect(() => {
    if (isApplyingRef.current) { isApplyingRef.current = false; historyRef.current.lastSig = stateSig; return; }
    if (historyRef.current.lastSig === stateSig) return;
    const t = setTimeout(() => {
      const h = historyRef.current;
      if (h.lastSig && h.lastSig !== stateSig) {
        h.past.push(h.lastSig);
        if (h.past.length > HISTORY_LIMIT) h.past.shift();
        h.future = [];
      }
      h.lastSig = stateSig;
      setHistoryTick((x) => x + 1);
    }, 350);
    return () => clearTimeout(t);
  }, [stateSig]);
  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;
  function undo() {
    const h = historyRef.current;
    const prev = h.past.pop(); if (!prev) return;
    h.future.push(h.lastSig); h.lastSig = prev;
    isApplyingRef.current = true;
    applyState(JSON.parse(prev)); setHistoryTick((x) => x + 1);
  }
  function redo() {
    const h = historyRef.current;
    const next = h.future.pop(); if (!next) return;
    h.past.push(h.lastSig); h.lastSig = next;
    isApplyingRef.current = true;
    applyState(JSON.parse(next)); setHistoryTick((x) => x + 1);
  }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      // still allow shortcuts even in inputs — designers expect it
      if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
      void target;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---------- Segment presets ----------
  function applySegmentPreset(seg: Segment, mode: "all" | "colors" | "texts" = "all") {
    const p = SEGMENT_PRESETS[seg];
    setSegment(seg);
    if (mode === "all" || mode === "colors") {
      setPrimaryColor(p.primary); setAccentColor(p.accent); setBackgroundColor(p.bg); setTextColor(p.text);
    }
    if (mode === "all" || mode === "texts") {
      setTitle(p.title); setSubtitle(p.subtitle); setCtaNearQR(p.ctaNearQR); setCtaFooter(p.ctaFooter);
      const n = activeCampaign?.stamps_required ?? 10;
      const r = activeCampaign?.reward_title?.toLowerCase() ?? "uma recompensa exclusiva";
      setRewardTextOverride(p.rewardHint.replace("{n}", String(n)).replace("{reward}", r));
    }
    toast.success(`Preset "${SEGMENT_LABEL[seg]}" aplicado`);
  }

  if (!est) return <LoadingSkeleton variant="page" />;

  return (
    <div className="space-y-6">
      <PageHero
        icon={HeroIcon}
        eyebrow={"Divulgação · Materiais"}
        title={"QR & Materiais gráficos"}
        subtitle={"Gere posters, artes de balcão e criativos prontos para redes sociais."}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Divulgação</div>
          <h1 className="font-display text-3xl font-bold">Divulgue seu programa de fidelidade</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">Crie materiais personalizados com QR Code — com sangria para impressão, validação de leitura e variações salvas.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          <Button size="sm" variant="ghost" onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)"><Redo2 className="h-4 w-4" /></Button>
          <span className="text-[11px] text-muted-foreground px-2">{historyRef.current.past.length} passos</span>
        </div>
      </div>





      {/* Format picker */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {(Object.keys(FORMATS) as PromoFormat[]).map((k) => {
          const f = FORMATS[k];
          return (
            <button key={k} onClick={() => setFormat(k)} className={`shrink-0 rounded-xl border px-4 py-3 text-left transition ${format === k ? "border-primary bg-primary-soft text-primary" : "border-border hover:border-primary/40"}`}>
              <div className="text-sm font-semibold flex items-center gap-2">{f.label}{f.print && <span className="text-[10px] rounded bg-primary/10 text-primary px-1.5 py-0.5 font-medium">PRINT</span>}</div>
              <div className="text-[11px] text-muted-foreground">{f.mm ? `${f.mm.w}×${f.mm.h}mm · ` : `${f.w}×${f.h}px · `}{f.description}</div>
            </button>
          );
        })}
      </div>

      {/* Scannability banner */}
      <div className={`rounded-lg border p-3 flex items-start gap-3 text-sm ${qrOk && !cardBlend ? "border-emerald-200 bg-emerald-50 text-emerald-900" : qrWarn || cardBlend ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-900"}`}>
        {qrOk && !cardBlend ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <AlertTriangle className="h-4 w-4 mt-0.5" />}
        <div className="flex-1 space-y-1">
          <div>
            <strong>Escaneabilidade: </strong>
            {qrOk && <>Ótima ({qrContrast.toFixed(1)}:1 de contraste do QR). </>}
            {qrWarn && <>Aceitável ({qrContrast.toFixed(1)}:1) — no limite para impressão pequena. </>}
            {qrBad && <>Baixa ({qrContrast.toFixed(1)}:1) — leitura pode falhar. </>}
            {cardBlend && <>O cartão branco do QR está se misturando com o fundo ({cardVsBgContrast.toFixed(2)}:1) — escureça o fundo ou aumente a camada de proteção.</>}
          </div>
          {(qrWarn || qrBad) && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={autoFixQrContrast}>
              <Wand2 className="mr-1 h-3 w-3" />Corrigir automaticamente
            </Button>
          )}
        </div>
      </div>


      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        {/* EDITOR */}
        <Card>
          <CardContent className="p-5">
            <Tabs defaultValue="content">
              <TabsList className="grid grid-cols-4">
                <TabsTrigger value="content"><Sparkles className="mr-1 h-3 w-3" />Conteúdo</TabsTrigger>
                <TabsTrigger value="style"><Palette className="mr-1 h-3 w-3" />Estilo</TabsTrigger>
                <TabsTrigger value="bg"><ImageIcon className="mr-1 h-3 w-3" />Fundo</TabsTrigger>
                <TabsTrigger value="advanced"><Settings2 className="mr-1 h-3 w-3" />Mais</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4 pt-4">
                {est && (
                  <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/20">
                    {est.logo_url ? (
                      <img src={est.logo_url} alt="Logo" className="h-12 w-12 rounded-md object-cover border" />
                    ) : (
                      <div className="h-12 w-12 rounded-md border border-dashed grid place-items-center text-[10px] text-muted-foreground text-center">sem logo</div>
                    )}
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="font-medium">Logo da marca</div>
                      <div className="text-muted-foreground">
                        {est.logo_url ? "Usado no material de divulgação." : "Envie para reforçar sua identidade nos posters."}
                      </div>
                    </div>
                    <LogoUploadButton establishmentId={est.id} currentLogoUrl={est.logo_url} />
                  </div>
                )}
                {campaigns && campaigns.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Campanha: {activeCampaign ? <><strong className="text-foreground">{activeCampaign.name}</strong> · {activeCampaign.stamps_required} carimbos → {activeCampaign.reward_title}</> : "nenhuma ativa"}
                  </div>
                )}
                <Field label="Título"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} /></Field>
                <Field label="Subtítulo"><Textarea value={subtitle} onChange={(e) => setSubtitle(e.target.value)} rows={3} maxLength={220} /></Field>
                <Field label="Recompensa (opcional — usa da campanha)"><Textarea value={rewardTextOverride} onChange={(e) => setRewardTextOverride(e.target.value)} rows={2} placeholder={rewardText} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Perto do QR"><Input value={ctaNearQR} onChange={(e) => setCtaNearQR(e.target.value)} maxLength={40} /></Field>
                  <Field label="CTA rodapé"><Input value={ctaFooter} onChange={(e) => setCtaFooter(e.target.value)} maxLength={40} /></Field>
                </div>
              </TabsContent>

              <TabsContent value="style" className="space-y-4 pt-4">
                <Field label="Segmento">
                  <Select value={segment} onValueChange={(v) => {
                    setSegment(v as Segment);
                    const p = SEGMENT_DEFAULTS[v as Segment];
                    setPrimaryColor(p.primary); setAccentColor(p.accent); setBackgroundColor(p.bg);
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(SEGMENT_LABEL) as Segment[]).map((k) => <SelectItem key={k} value={k}>{SEGMENT_LABEL[k]}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <div className="rounded-lg border bg-primary-soft/40 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium"><Wand2 className="h-3.5 w-3.5 text-primary" />Preset do segmento</div>
                  <p className="text-[11px] text-muted-foreground">Aplica paleta + textos sugeridos para <strong>{SEGMENT_LABEL[segment]}</strong>. Depois é só ajustar o que quiser.</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" onClick={() => applySegmentPreset(segment, "all")} className="gradient-brand text-primary-foreground h-7 text-xs"><Sparkles className="mr-1 h-3 w-3" />Aplicar tudo</Button>
                    <Button size="sm" variant="outline" onClick={() => applySegmentPreset(segment, "colors")} className="h-7 text-xs">Só cores</Button>
                    <Button size="sm" variant="outline" onClick={() => applySegmentPreset(segment, "texts")} className="h-7 text-xs">Só textos</Button>
                  </div>
                </div>
                <ColorField label="Cor principal" value={primaryColor} onChange={setPrimaryColor} />
                <ColorField label="Cor secundária" value={accentColor} onChange={setAccentColor} />
                <ColorField label="Fundo" value={backgroundColor} onChange={setBackgroundColor} />
                <ColorField label="Textos" value={textColor} onChange={setTextColor} />
                <div className="rounded-lg border p-3 space-y-2">
                  <ColorField label="Cor do QR Code" value={qrColor} onChange={setQrColor} />
                  <p className="text-[11px] text-muted-foreground">Só afeta os módulos do QR. Use uma cor bem escura para máxima leitura da câmera.</p>
                  <Button size="sm" variant="outline" onClick={() => setQrColor(primaryColor)} className="h-7 text-xs w-full">Usar cor principal</Button>
                </div>
              </TabsContent>

              <TabsContent value="bg" className="space-y-4 pt-4">
                <div className="rounded-lg border-dashed border-2 p-4 text-center">
                  {bgImageUrl ? (
                    <>
                      <img src={bgImageUrl} alt="" className="mx-auto max-h-32 rounded-md object-cover" />
                      <div className="mt-3 flex justify-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>Trocar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setBgImageUrl(null)}>Remover</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground mt-2">Fundo personalizado (JPG/PNG, máx 8MB)</p>
                      <Button size="sm" variant="outline" className="mt-3" onClick={() => fileInputRef.current?.click()}>Escolher imagem</Button>
                    </>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onBgUpload(e.target.files[0])} />
                </div>
                {bgImageUrl && (
                  <>
                    <Button size="sm" variant="outline" onClick={reExtractPalette} className="w-full">
                      <Wand2 className="mr-2 h-3.5 w-3.5" />Reajustar cores pela imagem
                    </Button>
                    <SliderField label={`Zoom (${bgZoom.toFixed(2)}×)`} value={bgZoom} min={1} max={3} step={0.05} onChange={setBgZoom} />
                    <SliderField label={`Horizontal (${bgOffsetX})`} value={bgOffsetX} min={-40} max={40} step={1} onChange={setBgOffsetX} />
                    <SliderField label={`Vertical (${bgOffsetY})`} value={bgOffsetY} min={-40} max={40} step={1} onChange={setBgOffsetY} />
                    <SliderField label={`Camada de proteção (${Math.round(bgOverlay * 100)}%)`} value={bgOverlay} min={0} max={0.85} step={0.05} onChange={setBgOverlay} />
                    <p className="text-[11px] text-muted-foreground">Ao enviar uma foto, as cores (principal, secundária, textos) são ajustadas automaticamente para manter contraste com o fundo. Use o botão acima para reaplicar.</p>
                  </>
                )}
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4 pt-4">
                <div className="rounded-lg border p-3 space-y-3">
                  <Row label="Tamanho do QR — auto por formato" hint={`Sugerido: Story ${AUTO_QR_SCALE.story}×, Feed ${AUTO_QR_SCALE.feed}×, Balcão ${AUTO_QR_SCALE.counter}×`}>
                    <Switch checked={qrAuto} onCheckedChange={(v) => { setQrAuto(v); if (v) setQrScale(AUTO_QR_SCALE[format]); }} />
                  </Row>
                  <SliderField
                    label={`Escala do QR (${qrScale.toFixed(2)}×)${qrAuto ? " · auto" : ""}`}
                    value={qrScale}
                    min={0.6}
                    max={1.5}
                    step={0.05}
                    onChange={(v) => { setQrAuto(false); setQrScale(v); }}
                  />
                  <p className="text-[11px] text-muted-foreground">Aumenta ou reduz o QR mantendo a área de respiro. A auto-escala escolhe o melhor tamanho por formato para leitura fácil à distância.</p>
                </div>

                <div className="rounded-lg border p-3 space-y-3">
                  <div className="text-xs font-medium">Formato dos cantos</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant={cornerRadiusPct === 0 ? "default" : "outline"} onClick={() => { setCornerStyle("sharp"); setCornerRadiusPct(0); }} className="h-8 text-xs">Quadrado</Button>
                    <Button size="sm" variant={cornerRadiusPct > 0 ? "default" : "outline"} onClick={() => { setCornerStyle("rounded"); if (cornerRadiusPct === 0) setCornerRadiusPct(6); }} className="h-8 text-xs">Arredondado</Button>
                  </div>
                  <SliderField
                    label={`Raio dos cantos (${cornerRadiusPct}%)`}
                    value={cornerRadiusPct}
                    min={0}
                    max={30}
                    step={1}
                    onChange={(v) => { setCornerRadiusPct(v); setCornerStyle(v > 0 ? "rounded" : "sharp"); }}
                  />
                  <p className="text-[11px] text-muted-foreground">0% = quadrado, 30% = super arredondado. Nos formatos de impressão, o arredondamento aparece dentro da linha de corte.</p>
                </div>


                <Row label="Mostrar guias de área segura" hint="Só na prévia — mostra até onde o conteúdo pode chegar">
                  <Switch checked={showSafeArea} onCheckedChange={setShowSafeArea} />
                </Row>
                <Row label="Marcas de corte (crop marks)" hint="Aparece só nos formatos de impressão">
                  <Switch checked={showCropMarks} onCheckedChange={setShowCropMarks} />
                </Row>
                <Row label='Mostrar "Powered by Fidelize"' hint="Discreta no rodapé">
                  <Switch checked={showBrand} onCheckedChange={setShowBrand} />
                </Row>
                <Field label="Link público">
                  <div className="flex gap-2">
                    <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs break-all">{publicUrl}</code>
                    <Button size="icon" variant="outline" aria-label="Copiar link público" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Copiado"); }}><Copy className="h-4 w-4" /></Button>
                  </div>
                </Field>
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  PDFs de impressão saem em <strong>mm reais</strong> com <strong>3mm de sangria</strong> e área segura. Ideal para gráficas.
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
                {dims.mm ? `${dims.mm.w}×${dims.mm.h}mm` : `${dims.w}×${dims.h}px`}
                {dims.bleed > 0 && <> · sangria 3mm</>}
              </div>
            </div>
            <div className="p-4 border-t flex flex-wrap gap-2">
              <Button onClick={exportPNG} disabled={exporting} className="gradient-brand text-primary-foreground">
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileImage className="mr-2 h-4 w-4" />}PNG
              </Button>
              <Button onClick={exportJPG} disabled={exporting} variant="outline"><FileImage className="mr-2 h-4 w-4" />JPG</Button>
              <Button onClick={exportPDF} disabled={exporting} variant="outline"><FileText className="mr-2 h-4 w-4" />PDF{dims.mm ? " (mm)" : ""}</Button>
              <Button onClick={printArt} disabled={exporting} variant="outline"><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
              <Button onClick={shareArt} disabled={exporting} variant="outline"><Share2 className="mr-2 h-4 w-4" />Compartilhar</Button>
              <Button onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado"); }} variant="ghost"><Copy className="mr-2 h-4 w-4" />Copiar link</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* VARIATIONS */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Minhas variações</h2>
            <span className="text-xs text-muted-foreground">— salve versões do editor e alterne rapidamente</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <Input placeholder="Nome (ex: Campanha de verão)" value={variationName} onChange={(e) => setVariationName(e.target.value)} className="max-w-xs" />
            <Button onClick={saveVariation} className="gradient-brand text-primary-foreground"><Save className="mr-2 h-4 w-4" />Salvar atual</Button>
            <Button onClick={exportAllVariations} disabled={exporting || !variations.length} variant="outline">
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Exportar todas em PDF
            </Button>
          </div>
          {variations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma variação salva ainda.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {variations.map((v) => (
                <div key={v.id} className="rounded-lg border p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{v.name}</div>
                      <div className="text-[11px] text-muted-foreground">{FORMATS[v.state.format].label} · {new Date(v.savedAt).toLocaleString("pt-BR")}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <div className="h-6 w-6 rounded" style={{ background: v.state.primaryColor, border: "1px solid rgba(0,0,0,0.1)" }} />
                      <div className="h-6 w-6 rounded" style={{ background: v.state.accentColor, border: "1px solid rgba(0,0,0,0.1)" }} />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{v.state.title}</div>
                  <div className="flex gap-1 mt-1">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => loadVariation(v.id)}>Carregar</Button>
                    <Button size="sm" variant="ghost" onClick={() => renameVariation(v.id)}>Renomear</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteVariation(v.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hidden batch render node */}
      {batchNode && (
        <div style={{ position: "fixed", left: -99999, top: 0 }} aria-hidden>
          <PromoPoster ref={batchRef} config={batchNode} />
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="text-xs">{label}</Label><div className="mt-1">{children}</div></div>;
}
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div><Label className="text-xs">{label}</Label>{hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}</div>
      {children}
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
function SliderField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Slider className="mt-2" value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}
