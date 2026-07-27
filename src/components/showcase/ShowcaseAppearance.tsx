import { useBlocker } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Palette, Check, ImageIcon, Trash2, ExternalLink, Loader2, RotateCcw, Undo2, ArrowLeft, ArrowRight, Sparkles, Store, Paintbrush, LayoutGrid, DoorOpen } from "lucide-react";



import { getMyEstablishments } from "@/lib/loyalty.functions";
import { getMyMenuOverview, updateMenuTheme, listMenuItems } from "@/lib/menu.functions";
import {
  MENU_PRESETS, MENU_LAYOUTS, MENU_PATTERNS, resolveMenuTheme, menuBackgroundCss,
  type MenuLayoutId, type MenuPatternId, type MenuPresetId, type MenuPreset,
  MENU_ENTRIES,
  MENU_BG_SWATCHES,
  MENU_ACCENT_SWATCHES,
  MENU_TEXT_SWATCHES,
  applyCustomColors,
  isValidHex,
  DEFAULT_MENU_THEME,
  type MenuEntryId,
} from "@/lib/menu-themes";

import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { LogoUploadButton } from "@/components/LogoUploadButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { showcase, type ShowcaseKind } from "@/lib/showcase";

export function ShowcaseAppearance({ kind }: { kind: ShowcaseKind }) {
  const L = showcase(kind);
  const isCatalog = kind === "catalog";
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
    queryKey: ["menu-overview", estId, kind],
    queryFn: () => fetchOverview({ data: { establishment_id: estId!, kind } }),
    enabled: !!estId,
  });

  const fetchItems = useServerFn(listMenuItems);
  const menuData = useQuery({
    queryKey: ["menu-preview-data", estId, kind],
    queryFn: () => fetchItems({ data: { establishment_id: estId!, kind } }),
    enabled: !!estId,
  });

  const [preset, setPreset] = useState<MenuPresetId>("papel");
  const [layout, setLayout] = useState<MenuLayoutId>("list");
  const [pattern, setPattern] = useState<MenuPatternId>("grain");
  const [entry, setEntry] = useState<MenuEntryId>("dishes");
  const [bgColor, setBgColor] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [textColor, setTextColor] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const applyThemeToForm = (t: {
    preset: MenuPresetId; layout: MenuLayoutId; pattern: MenuPatternId; entry: MenuEntryId;
    bg_color: string | null; accent_color: string | null; text_color: string | null; bg_image_url: string | null;
  }) => {
    setPreset(t.preset);
    setLayout(isCatalog && t.layout === "magazine" ? "grid" : t.layout);
    setPattern(t.pattern);
    setEntry(t.entry);
    setBgColor(t.bg_color);
    setAccentColor(t.accent_color);
    setTextColor(t.text_color);
    setBgImage(t.bg_image_url);
  };

  const savedTheme = useMemo(() => resolveMenuTheme(overview.data?.menu?.theme), [overview.data?.menu?.theme]);

  useEffect(() => {
    applyThemeToForm(savedTheme);
  }, [savedTheme]);

  const current = { preset, layout, pattern, entry, bg_color: bgColor, accent_color: accentColor, text_color: textColor, bg_image_url: bgImage };
  const dirty =
    JSON.stringify(current) !==
    JSON.stringify({
      preset: savedTheme.preset, layout: savedTheme.layout, pattern: savedTheme.pattern, entry: savedTheme.entry,
      bg_color: savedTheme.bg_color, accent_color: savedTheme.accent_color, text_color: savedTheme.text_color,
      bg_image_url: savedTheme.bg_image_url,
    });

  useBlocker({
    shouldBlockFn: () => dirty && !window.confirm("Você tem alterações de aparência não salvas. Sair mesmo assim?"),
    enableBeforeUnload: () => dirty,
  });

  const restoreDefaults = () => {
    if (!window.confirm("Restaurar a aparência padrão? Suas cores e layout personalizados serão descartados (salve para confirmar).")) return;
    applyThemeToForm(DEFAULT_MENU_THEME);
    toast.info("Padrão restaurado na prévia. Clique em Salvar aparência para aplicar.");
  };

  const mut = useMutation({
    mutationFn: () =>
      saveTheme({ data: { establishment_id: estId!, kind, theme: { preset, layout, pattern, entry, bg_color: bgColor, accent_color: accentColor, text_color: textColor, bg_image_url: bgImage } } }),
    onSuccess: () => {
      toast.success("Aparência salva. A vitrine pública já está atualizada.");
      qc.invalidateQueries({ queryKey: ["menu-overview", estId, kind] });
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
  const publicUrl = est?.slug ? `${L.publicBase}/${est.slug}` : "";

  return (
    <div className="space-y-6">
      <PageHero
        icon={Palette}
        eyebrow={L.eyebrow}
        title="Aparência da vitrine"
        subtitle={`Escolha o tema de cores, a textura de fundo (ou sua própria imagem) e o layout dos ${L.itemsLower}. A prévia ao lado mostra exatamente como o cliente vai ver.`}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          {/* LOGO */}
          {est && (
            <Card>
              <CardHeader><CardTitle>Logo {isCatalog ? "do catálogo" : "do cardápio"}</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 p-3">
                  <div
                    className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-xl border border-border/60"
                    style={{ background: est.logo_url ? "#ffffff" : "hsl(var(--muted))" }}
                  >
                    {est.logo_url ? (
                      <img src={est.logo_url} alt={est.name ?? ""} className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">
                        {(est.name ?? "??").slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      {est.logo_url
                        ? `Aparece no topo da página pública ${isCatalog ? "do catálogo" : "do cardápio"}.`
                        : `Envie uma logo para exibir no topo ${isCatalog ? "do catálogo" : "do cardápio"} público.`}
                    </p>
                    <LogoUploadButton
                      establishmentId={est.id}
                      currentLogoUrl={est.logo_url}
                      size="sm"
                      variant="outline"
                      invalidateKeys={[["my-establishments"], ["menu-overview", est.id]]}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TEMAS */}
          {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Tema de cores</CardTitle></CardHeader>

            <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {MENU_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  className={`relative overflow-hidden rounded-xl border p-2 text-left transition ${
                    preset === p.id ? "border-primary ring-2 ring-primary/40" : "border-border/60 hover:border-primary/50"
                  }`}
                >
                  {preset === p.id && (
                    <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                  <ThemeSwatch p={p} />
                  <div className="mt-2 truncate text-xs font-semibold">{p.name}</div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-muted-foreground">{p.description}</p>
                </button>
              ))}
            </CardContent>
          </Card>
          )}


          {/* FUNDO */}
          {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Fundo e cores</CardTitle></CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {MENU_PATTERNS.map((pt) => {
                  const p = applyCustomColors(MENU_PRESETS.find((x) => x.id === preset)!, { bg_color: bgColor, accent_color: accentColor, text_color: textColor });
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

              <div className="rounded-2xl border border-border/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Cor de destaque</div>
                    <p className="text-xs text-muted-foreground">
                      Usada em preços, botões e na categoria ativa. O texto sobre ela se ajusta sozinho.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Escolher cor de destaque"
                      value={accentColor && isValidHex(accentColor) ? accentColor : MENU_PRESETS.find((x) => x.id === preset)!.bar}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded-lg border border-border/60 bg-transparent p-1"
                    />
                    {accentColor && (
                      <Button variant="ghost" size="sm" onClick={() => setAccentColor(null)}>
                        Usar cor do tema
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {MENU_ACCENT_SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setAccentColor(c)}
                      title={c}
                      className={`h-8 w-8 rounded-full border transition ${
                        accentColor?.toLowerCase() === c.toLowerCase()
                          ? "border-primary ring-2 ring-primary/40"
                          : "border-border/60 hover:border-primary/50"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Cor do texto</div>
                    <p className="text-xs text-muted-foreground">
                      Nomes dos {L.itemsLower}, descrições e títulos. Escolha uma cor com bom contraste no seu fundo.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Escolher cor do texto"
                      value={textColor && isValidHex(textColor) ? textColor : MENU_PRESETS.find((x) => x.id === preset)!.ink}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded-lg border border-border/60 bg-transparent p-1"
                    />
                    {textColor && (
                      <Button variant="ghost" size="sm" onClick={() => setTextColor(null)}>
                        Usar cor do tema
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {MENU_TEXT_SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setTextColor(c)}
                      title={c}
                      className={`h-8 w-8 rounded-full border transition ${
                        textColor?.toLowerCase() === c.toLowerCase()
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
                  <img src={bgImage} alt="Fundo da vitrine" className="mt-3 h-28 w-full rounded-xl object-cover" />
                )}
              </div>
            </CardContent>
          </Card>
          )}


          {/* LAYOUT */}
          {step === 3 && (
          <Card>
            <CardHeader><CardTitle>Layout dos {L.itemsLower}</CardTitle></CardHeader>

            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {MENU_LAYOUTS.filter((l) => !(isCatalog && l.id === "magazine")).map((l) => (
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
          )}


          {/* TELA INICIAL — só faz sentido no cardápio (modo Stories) */}
          {!isCatalog && step === 4 && (
          <Card>
            <CardHeader><CardTitle>Ao entrar no cardápio</CardTitle></CardHeader>

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
          )}

          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
            <div className="flex items-center gap-1.5">
              {steps.map((s, i) => (
                <button
                  key={s.id}
                  aria-label={s.title}
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-2 bg-border hover:bg-primary/50"}`}
                />
              ))}
            </div>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
                Continuar <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setStep(0)}>
                <RotateCcw className="mr-2 h-4 w-4" /> Revisar
              </Button>
            )}
          </div>

          <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/90 p-3 backdrop-blur">

            <Button onClick={() => mut.mutate()} disabled={!estId || mut.isPending || !dirty}>
              {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar aparência
            </Button>
            <Button variant="outline" onClick={restoreDefaults} disabled={!estId}>
              <RotateCcw className="mr-2 h-4 w-4" /> Restaurar padrão
            </Button>
            {dirty && (
              <Button variant="ghost" onClick={() => applyThemeToForm(savedTheme)}>
                <Undo2 className="mr-2 h-4 w-4" /> Descartar alterações
              </Button>
            )}
            {dirty && (
              <span className="text-xs font-medium text-amber-500">Alterações não salvas</span>
            )}

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
        <div className="xl:sticky xl:top-4 h-fit">
          <div className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-muted/40 to-background p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> Prévia ao vivo
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Ao vivo
              </span>
            </div>
            <MenuPreview
              kind={kind}
              preset={preset} layout={layout} pattern={pattern}
              bgImage={bgImage} bgColor={bgColor} accentColor={accentColor} textColor={textColor} accent={accent}
              name={est?.name ?? (isCatalog ? "Sua Loja" : "Seu Restaurante")}
              logoUrl={est?.logo_url ?? null}
              coverUrl={est?.cover_url ?? null}
              categories={(menuData.data?.categories ?? []).map((c: any) => c.name)}
              items={(menuData.data?.items ?? []) as PreviewItem[]}
              loading={menuData.isLoading || ests.isLoading}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

function ThemeSwatch({ p }: { p: MenuPreset }) {
  return (
    <div className="h-11 w-full overflow-hidden rounded-lg border border-border/40" style={{ background: p.bg }}>
      <div className="flex h-full items-center gap-1.5 p-1.5">
        <span className="h-7 w-7 rounded-md" style={{ background: p.bar }} />
        <span className="flex-1 space-y-1">
          <span className="block h-1.5 w-3/4 rounded-full" style={{ background: p.ink, opacity: 0.85 }} />
          <span className="block h-1.5 w-1/2 rounded-full" style={{ background: p.ink, opacity: 0.35 }} />
          <span className="block h-3 rounded" style={{ background: p.surface, border: `1px solid ${p.line}` }} />
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
  src, accent, className, emojiClass, emoji,
}: { src?: string | null; accent: string; className: string; emojiClass?: string; emoji?: string }) {
  if (src) {
    return <img src={src} alt="" loading="lazy" className={`${className} object-cover`} style={{ background: `${accent}1A` }} />;
  }
  return (
    <div className={`${className} grid place-items-center ${emojiClass ?? "text-base"}`} style={{ background: `${accent}1A` }}>
      {emoji ?? "🍽️"}
    </div>
  );
}

function MenuPreview({
  kind = "menu", preset, layout, pattern, bgImage, bgColor, accentColor, textColor, accent: brandAccent, name, logoUrl, coverUrl, categories, items, loading,
}: {
  kind?: ShowcaseKind;
  preset: MenuPresetId; layout: MenuLayoutId; pattern: MenuPatternId;
  bgImage: string | null; bgColor: string | null; accentColor?: string | null; textColor?: string | null; accent: string;
  name: string; logoUrl: string | null; coverUrl?: string | null;
  categories: string[]; items: PreviewItem[]; loading?: boolean;
}) {
  const isCatalog = kind === "catalog";
  const L = showcase(kind);
  const emoji = isCatalog ? "🛍️" : "🍽️";
  const p = applyCustomColors(MENU_PRESETS.find((x) => x.id === preset)!, {
    bg_color: bgColor, accent_color: accentColor ?? null, text_color: textColor ?? null,
  });
  const accent = accentColor || p.bar || brandAccent;
  const bg = menuBackgroundCss({ pattern, bg_image_url: bgImage }, p, accent);


  const fallback: PreviewItem[] = isCatalog
    ? [
        { name: "Fone Bluetooth XZ", short_desc: "Cancelamento de ruído • 30h", price: 249.9 },
        { name: "Camiseta premium", short_desc: "Algodão pima • P ao GG", price: 89.9 },
        { name: "Garrafa térmica 1L", short_desc: "Inox • gelado por 24h", price: 119 },
        { name: "Kit skincare", short_desc: "Limpeza + hidratação", price: 159.9 },
      ]
    : [
        { name: "Burguer da casa", short_desc: "Blend 180g, cheddar e picles", price: 39.9 },
        { name: "Salada mediterrânea", short_desc: "Grão de bico, pepino e hortelã", price: 28 },
        { name: "Tiramisù", short_desc: "Café espresso e mascarpone", price: 22 },
        { name: "Limonada suíça", short_desc: "Feita na hora", price: 12 },
      ];
  const real = (items ?? []).filter((i) => i.active !== false);
  const usingReal = real.length > 0;
  const dishes = (usingReal ? real : fallback).slice(0, 6);
  const chips = [
    "Tudo",
    ...(categories?.length ? categories : isCatalog ? ["Novidades", "Mais vendidos"] : ["Entradas", "Pratos"]),
  ].slice(0, 4);

  const priceOf = (d: PreviewItem) => {
    const v = d.promo_price ?? d.price;
    return typeof v === "number" ? brl(v) : "—";
  };

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || paused) return;
    let raf = 0;
    let dir = 1;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 48);
      last = now;
      const max = el.scrollHeight - el.clientHeight;
      if (max > 8) {
        el.scrollTop += dir * (dt * 0.022);
        if (el.scrollTop >= max - 1) dir = -1;
        if (el.scrollTop <= 0) dir = 1;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, layout, preset, pattern, items]);

  return (
    <div className="space-y-3">
      <div
        className="showcase-device relative mx-auto w-full max-w-[320px]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-6 rounded-[3rem] opacity-60 blur-2xl"
          style={{ background: `radial-gradient(60% 50% at 50% 0%, ${accent}55, transparent 70%)` }}
        />
        <div className="relative overflow-hidden rounded-[2.5rem] border-[6px] border-foreground/15 bg-foreground/5 shadow-2xl ring-1 ring-white/10">
          <span className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-foreground/70" />
          <span className="absolute inset-x-0 bottom-1.5 z-20 mx-auto h-1 w-24 rounded-full bg-foreground/30" />
        <div ref={scrollRef} style={{ background: bg, color: p.ink }} className="h-[470px] overflow-y-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          <div
            className="h-20 w-full bg-cover bg-center"
            style={
              coverUrl
                ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.5)), url(${coverUrl})` }
                : { background: `linear-gradient(135deg, ${accent}, ${p.bar})` }
            }
          />
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
                <div className="truncate text-[10px] opacity-60">{isCatalog ? "Catálogo digital • Peça pelo WhatsApp" : "Cardápio digital • Aberto agora"}</div>
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

            <div
              className={`mt-3 pb-4 ${
                layout === "grid"
                  ? "grid grid-cols-2 gap-2"
                  : layout === "lookbook"
                    ? "columns-2 gap-2"
                    : "space-y-2"
              }`}
            >
              {dishes.map((d, idx) => {
                if (layout === "lookbook") {
                  const ratios = ["h-24", "h-20", "h-28", "h-16"];
                  return (
                    <div key={idx} className="mb-2 break-inside-avoid overflow-hidden rounded-xl" style={{ background: p.line }}>
                      <div className="relative">
                        <Thumb src={d.image_url} accent={accent} emoji={emoji} className={`w-full ${ratios[idx % ratios.length]}`} emojiClass="text-lg" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                          <div className="truncate text-[10px] font-semibold text-white" style={{ fontFamily: p.fontHead }}>{d.name}</div>
                          <div className="text-[10px] text-white/80">{priceOf(d)}</div>
                        </div>
                      </div>
                    </div>
                  );
                }
                if (layout === "grid") {

                  return (
                    <div key={idx} className="overflow-hidden rounded-xl" style={{ background: p.surface, border: `1px solid ${p.line}` }}>
                      <Thumb src={d.image_url} accent={accent} emoji={emoji} className="h-16 w-full" emojiClass="text-lg" />
                      <div className="p-2">
                        <div className="truncate text-[11px] font-bold" style={{ fontFamily: p.fontHead }}>{d.name}</div>
                        <div className="mt-1 text-[11px] font-bold" style={{ color: accent }}>{priceOf(d)}</div>
                        {isCatalog && (
                          <div className="mt-1.5 rounded-full py-1 text-center text-[9px] font-bold" style={{ background: accent, color: p.barInk }}>
                            Adicionar
                          </div>
                        )}
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
                      <Thumb src={d.image_url} accent={accent} emoji={emoji} className="h-8 w-8 shrink-0 rounded-md" emojiClass="text-xs" />
                    </div>
                  );
                }
                return (
                  <div key={idx} className="flex gap-2 rounded-xl p-2" style={{ background: p.surface, border: `1px solid ${p.line}` }}>
                    <Thumb src={d.image_url} accent={accent} emoji={emoji} className="h-12 w-12 shrink-0 rounded-lg" />
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
      </div>



      <p className="text-center text-[11px] text-muted-foreground">
        {loading
          ? `Carregando seus ${L.itemsLower}…`
          : usingReal
            ? `Prévia com seus ${L.itemsLower}, fotos e ${L.categories.toLowerCase()} reais.`
            : `Sem ${L.itemsLower} cadastrados ainda — mostrando exemplos.`}
      </p>
    </div>
  );
}
