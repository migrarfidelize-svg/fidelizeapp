import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Palette, Check, ImageIcon, Trash2, ExternalLink, Loader2 } from "lucide-react";

import { getMyEstablishments } from "@/lib/loyalty.functions";
import { getMyMenuOverview, updateMenuTheme, listMenuItems } from "@/lib/menu.functions";
import {
  MENU_PRESETS, MENU_LAYOUTS, MENU_PATTERNS, resolveMenuTheme, menuBackgroundCss,
  type MenuLayoutId, type MenuPatternId, type MenuPresetId, type MenuPreset,
  MENU_ENTRIES,
  MENU_BG_SWATCHES,
  applyBgColor,
  isValidHex,
  type MenuEntryId,
} from "@/lib/menu-themes";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/app/cardapio/aparencia")({
  head: () => ({
    meta: [
      { title: "Aparência do Cardápio — Fidelize" },
      { name: "description", content: "Escolha o tema, o fundo e o layout da vitrine pública do seu cardápio digital." },
    ],
  }),
  component: MenuAppearancePage,
});

function MenuAppearancePage() {
  const qc = useQueryClient();
  const fetchEsts = useServerFn(getMyEstablishments);
  const fetchOverview = useServerFn(getMyMenuOverview);
  const saveTheme = useServerFn(updateMenuTheme);

  const ests = useQuery({ queryKey: ["my-establishments"], queryFn: () => fetchEsts() });
  const est = ests.data?.[0]?.establishment as
    | { id: string; slug: string; name?: string | null; logo_url?: string | null; cover_url?: string | null; primary_color?: string | null }
    | undefined;
  const estId = est?.id;

  const overview = useQuery({
    queryKey: ["menu-overview", estId],
    queryFn: () => fetchOverview({ data: { establishment_id: estId! } }),
    enabled: !!estId,
  });

  const fetchItems = useServerFn(listMenuItems);
  const menuData = useQuery({
    queryKey: ["menu-preview-data", estId],
    queryFn: () => fetchItems({ data: { establishment_id: estId! } }),
    enabled: !!estId,
  });

  const [preset, setPreset] = useState<MenuPresetId>("papel");
  const [layout, setLayout] = useState<MenuLayoutId>("list");
  const [pattern, setPattern] = useState<MenuPatternId>("grain");
  const [entry, setEntry] = useState<MenuEntryId>("dishes");
  const [bgColor, setBgColor] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const t = resolveMenuTheme(overview.data?.menu?.theme);
    setPreset(t.preset);
    setLayout(t.layout);
    setPattern(t.pattern);
    setEntry(t.entry);
    setBgColor(t.bg_color);
    setBgImage(t.bg_image_url);
  }, [overview.data?.menu?.theme]);

  const mut = useMutation({
    mutationFn: () =>
      saveTheme({ data: { establishment_id: estId!, theme: { preset, layout, pattern, entry, bg_color: bgColor, bg_image_url: bgImage } } }),
    onSuccess: () => {
      toast.success("Aparência salva. A vitrine pública já está atualizada.");
      qc.invalidateQueries({ queryKey: ["menu-overview", estId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadBg = async (file: File) => {
    if (!estId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `est_${estId}/background/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("menu-images").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
      setBgImage(data.publicUrl);
      toast.success("Imagem de fundo enviada");
    } catch (e: any) {
      toast.error(e.message || "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const accent = est?.primary_color || "#B8371D";
  const publicUrl = est?.slug ? `/cardapio/${est.slug}` : "";

  return (
    <div className="space-y-6">
      <PageHero
        icon={Palette}
        eyebrow="Cardápio virtual"
        title="Aparência da vitrine"
        subtitle="Escolha o tema de cores, a textura de fundo (ou sua própria imagem) e o layout dos pratos. A prévia ao lado mostra exatamente como o cliente vai ver."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          {/* TEMAS */}
          <Card>
            <CardHeader><CardTitle>1. Tema de cores</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MENU_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  className={`relative overflow-hidden rounded-2xl border p-3 text-left transition ${
                    preset === p.id ? "border-primary ring-2 ring-primary/40" : "border-border/60 hover:border-primary/50"
                  }`}
                >
                  {preset === p.id && (
                    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <ThemeSwatch p={p} />
                  <div className="mt-3 text-sm font-semibold">{p.name}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* FUNDO */}
          <Card>
            <CardHeader><CardTitle>2. Fundo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {MENU_PATTERNS.map((pt) => {
                  const p = applyBgColor(MENU_PRESETS.find((x) => x.id === preset)!, bgColor);
                  return (
                    <button
                      key={pt.id}
                      onClick={() => { setPattern(pt.id); setBgImage(null); }}
                      className={`rounded-xl border p-2 text-center transition ${
                        pattern === pt.id && !bgImage ? "border-primary ring-2 ring-primary/40" : "border-border/60 hover:border-primary/50"
                      }`}
                    >
                      <span
                        className="block h-12 w-20 rounded-lg border border-border/40"
                        style={{ background: menuBackgroundCss({ pattern: pt.id, bg_image_url: null }, p, accent) }}
                      />
                      <span className="mt-1.5 block text-[11px] font-medium">{pt.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-border/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Cor de fundo</div>
                    <p className="text-xs text-muted-foreground">
                      Sobrescreve a cor do tema. O texto e os cartões se ajustam sozinhos para manter contraste.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Escolher cor de fundo"
                      value={bgColor && isValidHex(bgColor) ? bgColor : MENU_PRESETS.find((x) => x.id === preset)!.bg}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded-lg border border-border/60 bg-transparent p-1"
                    />
                    {bgColor && (
                      <Button variant="ghost" size="sm" onClick={() => setBgColor(null)}>
                        Usar cor do tema
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {MENU_BG_SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setBgColor(c)}
                      title={c}
                      className={`h-8 w-8 rounded-full border transition ${
                        bgColor?.toLowerCase() === c.toLowerCase()
                          ? "border-primary ring-2 ring-primary/40"
                          : "border-border/60 hover:border-primary/50"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-border/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Imagem de fundo própria</div>
                    <p className="text-xs text-muted-foreground">
                      Opcional. Aplicamos um véu escuro/claro por cima para o texto continuar legível.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <label>
                      <input
                        type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBg(f); e.currentTarget.value = ""; }}
                      />
                      <Button asChild variant="outline" size="sm" disabled={uploading}>
                        <span>
                          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
                          {uploading ? "Enviando…" : "Enviar imagem"}
                        </span>
                      </Button>
                    </label>
                    {bgImage && (
                      <Button variant="ghost" size="sm" onClick={() => setBgImage(null)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Remover
                      </Button>
                    )}
                  </div>
                </div>
                {bgImage && (
                  <img src={bgImage} alt="Fundo do cardápio" className="mt-3 h-28 w-full rounded-xl object-cover" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* LAYOUT */}
          <Card>
            <CardHeader><CardTitle>3. Layout dos pratos</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {MENU_LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLayout(l.id)}
                  className={`relative rounded-2xl border p-3 text-left transition ${
                    layout === l.id ? "border-primary ring-2 ring-primary/40" : "border-border/60 hover:border-primary/50"
                  }`}
                >
                  {layout === l.id && (
                    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <LayoutWire id={l.id} />
                  <div className="mt-3 text-sm font-semibold">{l.name}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{l.description}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* TELA INICIAL */}
          <Card>
            <CardHeader><CardTitle>4. Ao entrar no cardápio</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MENU_ENTRIES.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setEntry(e.id)}
                  className={`relative rounded-2xl border p-4 text-left transition ${
                    entry === e.id ? "border-primary ring-2 ring-primary/40" : "border-border/60 hover:border-primary/50"
                  }`}
                >
                  {entry === e.id && (
                    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <div className="text-sm font-semibold">{e.name}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="sticky bottom-3 z-20 flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-background/90 p-3 backdrop-blur">
            <Button onClick={() => mut.mutate()} disabled={!estId || mut.isPending}>
              {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar aparência
            </Button>
            {publicUrl && (
              <Button asChild variant="outline">
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Ver vitrine pública
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* PRÉVIA */}
        <Card className="xl:sticky xl:top-4 h-fit">
          <CardHeader><CardTitle>Prévia ao vivo</CardTitle></CardHeader>
          <CardContent>
            <MenuPreview
              preset={preset} layout={layout} pattern={pattern}
              bgImage={bgImage} bgColor={bgColor} accent={accent}
              name={est?.name ?? "Seu Restaurante"}
              logoUrl={est?.logo_url ?? null}
              coverUrl={est?.cover_url ?? null}
              categories={(menuData.data?.categories ?? []).map((c: any) => c.name)}
              items={(menuData.data?.items ?? []) as PreviewItem[]}
              loading={menuData.isLoading || ests.isLoading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ThemeSwatch({ p }: { p: MenuPreset }) {
  return (
    <div className="h-16 w-full overflow-hidden rounded-xl border border-border/40" style={{ background: p.bg }}>
      <div className="flex h-full items-center gap-2 p-2">
        <span className="h-10 w-10 rounded-lg" style={{ background: p.bar }} />
        <span className="flex-1 space-y-1">
          <span className="block h-2.5 w-3/4 rounded-full" style={{ background: p.ink, opacity: 0.85 }} />
          <span className="block h-2 w-1/2 rounded-full" style={{ background: p.ink, opacity: 0.35 }} />
          <span className="block h-6 rounded-md" style={{ background: p.surface, border: `1px solid ${p.line}` }} />
        </span>
      </div>
    </div>
  );
}

function LayoutWire({ id }: { id: MenuLayoutId }) {
  const bar = "bg-muted-foreground/25";
  if (id === "grid") {
    return (
      <div className="grid h-16 grid-cols-2 gap-1.5 rounded-xl bg-muted/50 p-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-md bg-background p-1">
            <div className="h-4 rounded-sm bg-muted-foreground/20" />
            <div className={`mt-1 h-1.5 w-2/3 rounded-full ${bar}`} />
          </div>
        ))}
      </div>
    );
  }
  if (id === "magazine") {
    return (
      <div className="h-16 space-y-1.5 rounded-xl bg-muted/50 p-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2 rounded-md bg-background px-1.5 py-1">
            <div className="flex-1 space-y-1">
              <div className={`h-1.5 w-1/2 rounded-full ${bar}`} />
              <div className={`h-1 w-3/4 rounded-full ${bar}`} />
            </div>
            <div className="h-5 w-5 rounded-sm bg-muted-foreground/20" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="h-16 space-y-1.5 rounded-xl bg-muted/50 p-2">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-2 rounded-md bg-background p-1.5">
          <div className="h-6 w-8 rounded-sm bg-muted-foreground/20" />
          <div className="flex-1 space-y-1">
            <div className={`h-1.5 w-2/3 rounded-full ${bar}`} />
            <div className={`h-1 w-1/2 rounded-full ${bar}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export type PreviewItem = {
  name: string;
  short_desc?: string | null;
  price?: number | null;
  promo_price?: number | null;
  image_url?: string | null;
  active?: boolean | null;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Miniatura do prato: usa a foto real quando existe, senão um placeholder do tema. */
function Thumb({
  src, accent, className, emojiClass,
}: { src?: string | null; accent: string; className: string; emojiClass?: string }) {
  if (src) {
    return <img src={src} alt="" loading="lazy" className={`${className} object-cover`} style={{ background: `${accent}1A` }} />;
  }
  return (
    <div className={`${className} grid place-items-center ${emojiClass ?? "text-base"}`} style={{ background: `${accent}1A` }}>
      🍽️
    </div>
  );
}

function MenuPreview({
  preset, layout, pattern, bgImage, bgColor, accent, name, logoUrl, categories, items, loading,
}: {
  preset: MenuPresetId; layout: MenuLayoutId; pattern: MenuPatternId;
  bgImage: string | null; bgColor: string | null; accent: string;
  name: string; logoUrl: string | null; categories: string[]; items: PreviewItem[]; loading?: boolean;
}) {
  const p = applyBgColor(MENU_PRESETS.find((x) => x.id === preset)!, bgColor);
  const bg = menuBackgroundCss({ pattern, bg_image_url: bgImage }, p, accent);

  const fallback: PreviewItem[] = [
    { name: "Burguer da casa", short_desc: "Blend 180g, cheddar e picles", price: 39.9 },
    { name: "Salada mediterrânea", short_desc: "Grão de bico, pepino e hortelã", price: 28 },
    { name: "Tiramisù", short_desc: "Café espresso e mascarpone", price: 22 },
    { name: "Limonada suíça", short_desc: "Feita na hora", price: 12 },
  ];
  const real = (items ?? []).filter((i) => i.active !== false);
  const usingReal = real.length > 0;
  const dishes = (usingReal ? real : fallback).slice(0, 6);
  const chips = ["Tudo", ...(categories?.length ? categories : ["Entradas", "Pratos"])].slice(0, 4);

  const priceOf = (d: PreviewItem) => {
    const v = d.promo_price ?? d.price;
    return typeof v === "number" ? brl(v) : "—";
  };

  return (
    <div className="space-y-2">
      <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-[2rem] border-4 border-foreground/10 shadow-xl">
        <div style={{ background: bg, color: p.ink }} className="h-[440px] overflow-y-auto">
          <div className="h-20 w-full" style={{ background: `linear-gradient(135deg, ${accent}, ${p.bar})` }} />
          <div className="-mt-8 px-3">
            <div className="flex items-center gap-2 rounded-2xl p-3" style={{ background: p.surface, border: `1px solid ${p.line}` }}>
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: accent }}>
                  {name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-bold" style={{ fontFamily: p.fontHead }}>{name}</div>
                <div className="truncate text-[10px] opacity-60">Cardápio digital • Aberto agora</div>
              </div>
            </div>

            <div className="mt-3 flex gap-1.5 overflow-hidden">
              {chips.map((c, i) => (
                <span
                  key={c + i}
                  className="shrink-0 truncate rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={i === 0
                    ? { background: p.bar, color: p.barInk }
                    : { background: p.surface, color: p.ink, border: `1px solid ${p.line}` }}
                >
                  {c}
                </span>
              ))}
            </div>

            <div className={`mt-3 pb-4 ${layout === "grid" ? "grid grid-cols-2 gap-2" : "space-y-2"}`}>
              {dishes.map((d, idx) => {
                if (layout === "grid") {
                  return (
                    <div key={idx} className="overflow-hidden rounded-xl" style={{ background: p.surface, border: `1px solid ${p.line}` }}>
                      <Thumb src={d.image_url} accent={accent} className="h-16 w-full" emojiClass="text-lg" />
                      <div className="p-2">
                        <div className="truncate text-[11px] font-bold" style={{ fontFamily: p.fontHead }}>{d.name}</div>
                        <div className="mt-1 text-[11px] font-bold" style={{ color: accent }}>{priceOf(d)}</div>
                      </div>
                    </div>
                  );
                }
                if (layout === "magazine") {
                  return (
                    <div key={idx} className="flex items-center gap-2 rounded-xl px-2.5 py-2" style={{ background: p.surface, border: `1px solid ${p.line}` }}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-bold" style={{ fontFamily: p.fontHead }}>{d.name}</div>
                        <div className="truncate text-[10px] opacity-60">{d.short_desc ?? ""}</div>
                      </div>
                      <div className="text-[11px] font-bold" style={{ color: accent }}>{priceOf(d)}</div>
                      <Thumb src={d.image_url} accent={accent} className="h-8 w-8 shrink-0 rounded-md" emojiClass="text-xs" />
                    </div>
                  );
                }
                return (
                  <div key={idx} className="flex gap-2 rounded-xl p-2" style={{ background: p.surface, border: `1px solid ${p.line}` }}>
                    <Thumb src={d.image_url} accent={accent} className="h-12 w-12 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-bold" style={{ fontFamily: p.fontHead }}>{d.name}</div>
                      <div className="truncate text-[10px] opacity-60">{d.short_desc ?? ""}</div>
                      <div className="mt-0.5 text-[11px] font-bold" style={{ color: accent }}>{priceOf(d)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        {loading
          ? "Carregando seus pratos…"
          : usingReal
            ? "Prévia com seus pratos, fotos e categorias reais."
            : "Sem pratos cadastrados ainda — mostrando exemplos."}
      </p>
    </div>
  );
}
