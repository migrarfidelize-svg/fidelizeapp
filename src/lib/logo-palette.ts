/**
 * Extrai uma paleta de cores da logo do estabelecimento usando um canvas HTML.
 * Sem dependências externas — roda inteiramente no browser.
 *
 * Estratégia:
 *  1. Baixa a imagem (crossOrigin=anonymous) e desenha em canvas reduzido (máx 96×96).
 *  2. Faz down-quantization (5 bits por canal → 32³ buckets) e conta frequência.
 *  3. Descarta pixels quase brancos / quase pretos / quase transparentes.
 *  4. Ordena candidatos por (frequência × saturação) para privilegiar cores marcantes.
 *  5. Deriva primary / accent / background / text a partir dos top candidatos.
 */

export type LogoPalette = {
  primary: string;
  accent: string;
  background: string;
  text: string;
  muted: string;
  swatches: string[]; // até 6 amostras dominantes ordenadas
};

const clamp = (v: number, min = 0, max = 255) => Math.min(max, Math.max(min, v));
const toHex = (n: number) => clamp(Math.round(n)).toString(16).padStart(2, "0");
export const rgbToHex = (r: number, g: number, b: number) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().replace("#", "");
  if (!(m.length === 3 || m.length === 6)) return null;
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

const hslHex = (h: number, s: number, l: number) => {
  const { r, g, b } = hslToRgb(h, clamp(s * 100, 0, 100) / 100, clamp(l * 100, 0, 100) / 100);
  return rgbToHex(r, g, b);
};

function relLuminance(r: number, g: number, b: number) {
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

export function readableTextOn(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#111827";
  return relLuminance(rgb.r, rgb.g, rgb.b) > 0.55 ? "#111827" : "#ffffff";
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem (CORS ou URL inválida)."));
    img.src = url;
  });
}

export async function extractPaletteFromUrl(url: string): Promise<LogoPalette> {
  if (!url) throw new Error("URL vazia.");
  const img = await loadImage(url);

  const maxSide = 96;
  const ratio = Math.min(1, maxSide / Math.max(img.width, img.height, 1));
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 200) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const { l, s } = rgbToHsl(r, g, b);
    if (l > 0.94 || l < 0.06) continue; // ignora quase branco/preto
    if (s < 0.08 && (l > 0.85 || l < 0.15)) continue;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const cur = buckets.get(key);
    if (cur) { cur.r += r; cur.g += g; cur.b += b; cur.n += 1; }
    else buckets.set(key, { r, g, b, n: 1 });
  }

  const candidates = Array.from(buckets.values())
    .map((b) => {
      const r = b.r / b.n, g = b.g / b.n, bl = b.b / b.n;
      const { h: hh, s, l } = rgbToHsl(r, g, bl);
      return { r, g, b: bl, n: b.n, h: hh, s, l, hex: rgbToHex(r, g, bl) };
    })
    .sort((a, b) => b.n * (0.35 + b.s) - a.n * (0.35 + a.s));

  if (candidates.length === 0) {
    // fallback: usa média simples de todos os pixels opacos
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n += 1;
    }
    n = Math.max(1, n);
    const hex = rgbToHex(r / n, g / n, b / n);
    return {
      primary: hex, accent: hex, background: "#0d1117", text: readableTextOn("#0d1117"),
      muted: hex, swatches: [hex],
    };
  }

  const primary = candidates[0];
  // acento: cor mais distinta em matiz do primário entre os top 6
  const distinct = candidates.slice(1, 6).sort((a, b) => {
    const da = Math.min(Math.abs(a.h - primary.h), 360 - Math.abs(a.h - primary.h));
    const db = Math.min(Math.abs(b.h - primary.h), 360 - Math.abs(b.h - primary.h));
    return db - da;
  });
  const accent = distinct[0] ?? primary;

  const primaryHex = primary.hex;
  // Gera background escuro com um toque do matiz do primário
  const bgHex = hslHex(primary.h, 0.35, 0.08);
  const textHex = readableTextOn(bgHex);
  const mutedHex = hslHex(primary.h, Math.max(0.15, primary.s * 0.5), Math.min(0.75, Math.max(0.45, primary.l + 0.1)));

  const swatches = candidates.slice(0, 6).map((c) => c.hex);

  return {
    primary: primaryHex,
    accent: accent.hex,
    background: bgHex,
    text: textHex,
    muted: mutedHex,
    swatches,
  };
}
