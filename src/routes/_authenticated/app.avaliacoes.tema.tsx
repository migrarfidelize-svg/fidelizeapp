import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Palette, Check, ExternalLink, Loader2, Star } from "lucide-react";

import { getMyEstablishments } from "@/lib/loyalty.functions";
import { getReviewSettings, saveReviewTheme } from "@/lib/reviews.functions";
import {
  REVIEW_PRESETS, REVIEW_PATTERNS, resolveReviewTheme, reviewPatternStyle,
  type ReviewPresetId, type ReviewPatternId,
} from "@/lib/review-themes";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/app/avaliacoes/tema")({
  head: () => ({
    meta: [
      { title: "Tema das Avaliações — Fidelize" },
      { name: "description", content: "Escolha as cores, o fundo e os textos da página pública de avaliações do seu negócio." },
      { property: "og:title", content: "Tema das Avaliações — Fidelize" },
      { property: "og:description", content: "Personalize a página pública onde seus clientes avaliam o atendimento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewThemePage,
});

const ACCENT_SWATCHES = ["#00ffff", "#d4af37", "#0f766e", "#ea580c", "#be185d", "#38bdf8", "#8b5cf6", "#22c55e"];
const BG_SWATCHES = ["#050505", "#0a0908", "#061523", "#faf7f2", "#fffaf3", "#fff5f7", "#ffffff", "#111827"];

function ReviewThemePage() {
  const qc = useQueryClient();
  const fetchEsts = useServerFn(getMyEstablishments);
  const fetchSettings = useServerFn(getReviewSettings);
  const save = useServerFn(saveReviewTheme);

  const ests = useQuery({ queryKey: ["my-establishments"], queryFn: () => fetchEsts() });
  const est = ests.data?.[0]?.establishment as
    | { id: string; slug: string; name?: string | null; logo_url?: string | null; primary_color?: string | null }
    | undefined;
  const estId = est?.id;

  const settings = useQuery({
    queryKey: ["review-settings", estId],
    queryFn: () => fetchSettings({ data: { establishmentId: estId! } }),
    enabled: !!estId,
  });

  const [preset, setPreset] = useState<ReviewPresetId>("circuit");
  const [pattern, setPattern] = useState<ReviewPatternId>("grid");
  const [accent, setAccent] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [subheadline, setSubheadline] = useState("");
  const [showReviews, setShowReviews] = useState(true);
  const [showPowered, setShowPowered] = useState(true);

  useEffect(() => {
    const t = resolveReviewTheme((settings.data as any)?.theme);
    setPreset(t.preset);
    setPattern(t.pattern);
    setAccent(t.accent);
    setBgColor(t.bg_color);
    setHeadline(t.headline ?? "");
    setSubheadline(t.subheadline ?? "");
    setShowReviews(t.show_reviews);
    setShowPowered(t.show_powered_by);
  }, [settings.data]);

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          establishmentId: estId!,
          theme: {
            preset, pattern, accent, bg_color: bgColor,
            headline: headline.trim() || null,
            subheadline: subheadline.trim() || null,
            show_reviews: showReviews,
            show_powered_by: showPowered,
          },
        },
      }),
    onSuccess: () => {
      toast.success("Tema salvo. A página pública já está atualizada.");
      qc.invalidateQueries({ queryKey: ["review-settings", estId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const live = resolveReviewTheme({
    preset, pattern, accent, bg_color: bgColor,
    headline: headline || null, subheadline: subheadline || null,
    show_reviews: showReviews, show_powered_by: showPowered,
  });
  const c = live.colors;
  const finalAccent = accent || est?.primary_color || c.accent;
  const publicUrl = est?.slug ? `/avaliar/${est.slug}` : "";

  return (
    <div className="space-y-6">
      <PageHero
        icon={Palette}
        eyebrow="Avaliações"
        title="Tema e cores da página pública"
        subtitle="Escolha o visual da página onde seus clientes deixam a avaliação. A prévia mostra exatamente como ela vai aparecer."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Tema de cores</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 pb-4 sm:grid-cols-3 xl:grid-cols-4">
              {REVIEW_PRESETS.map((p) => {
                const active = p.id === preset;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreset(p.id)}
                    className={`rounded-lg border p-2 text-left transition ${active ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40"}`}
                  >
                    <div
                      className="relative h-11 w-full overflow-hidden rounded-md"
                      style={{ background: p.bg, border: `1px solid ${p.border}` }}
                    >
                      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${p.accent}, ${p.accent2})` }} />
                      <div className="absolute bottom-1.5 left-2 flex gap-0.5">
                        {[1, 2, 3].map((i) => <Star key={i} className="h-2.5 w-2.5" style={{ fill: p.accent, color: p.accent }} />)}
                      </div>
                      {active && (
                        <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 truncate text-xs font-medium">{p.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{p.description}</div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Cor de destaque</CardTitle></CardHeader>
            <CardContent className="space-y-3 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAccent(null)}
                  className={`rounded-md border px-2 py-1 text-xs ${accent === null ? "border-primary ring-1 ring-primary" : "border-border"}`}
                >
                  Padrão do tema
                </button>
                {ACCENT_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Destaque ${hex}`}
                    onClick={() => setAccent(hex)}
                    className={`h-7 w-7 rounded-full border ${accent === hex ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"}`}
                    style={{ background: hex }}
                  />
                ))}
                <Input
                  type="color"
                  value={accent ?? finalAccent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-8 w-12 cursor-pointer p-1"
                  aria-label="Cor personalizada de destaque"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Cor de fundo</CardTitle></CardHeader>
            <CardContent className="space-y-3 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBgColor(null)}
                  className={`rounded-md border px-2 py-1 text-xs ${bgColor === null ? "border-primary ring-1 ring-primary" : "border-border"}`}
                >
                  Padrão do tema
                </button>
                {BG_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Fundo ${hex}`}
                    onClick={() => setBgColor(hex)}
                    className={`h-7 w-7 rounded-full border ${bgColor === hex ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"}`}
                    style={{ background: hex }}
                  />
                ))}
                <Input
                  type="color"
                  value={bgColor ?? c.bg}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-8 w-12 cursor-pointer p-1"
                  aria-label="Cor personalizada de fundo"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Textura de fundo</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2 pb-4">
              {REVIEW_PATTERNS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPattern(p.id)}
                  className={`rounded-md border px-3 py-1.5 text-xs transition ${pattern === p.id ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40"}`}
                >
                  {p.name}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Textos e elementos</CardTitle></CardHeader>
            <CardContent className="space-y-4 pb-4">
              <div className="space-y-1.5">
                <Label htmlFor="headline">Título principal</Label>
                <Input
                  id="headline" maxLength={90} value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder={est?.name ?? "Nome do seu negócio"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subheadline">Subtítulo</Label>
                <Input
                  id="subheadline" maxLength={160} value={subheadline}
                  onChange={(e) => setSubheadline(e.target.value)}
                  placeholder="Deixe sua avaliação para nos ajudar a melhorar"
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Mostrar avaliações recentes</div>
                  <p className="text-xs text-muted-foreground">Exibe os comentários públicos abaixo do formulário.</p>
                </div>
                <Switch checked={showReviews} onCheckedChange={setShowReviews} />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Selo "Powered by Fidelize"</div>
                  <p className="text-xs text-muted-foreground">Rodapé discreto no fim da página.</p>
                </div>
                <Switch checked={showPowered} onCheckedChange={setShowPowered} />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => mut.mutate()} disabled={!estId || mut.isPending}>
              {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar tema
            </Button>
            {publicUrl ? (
              <Button variant="outline" asChild>
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Ver página pública
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        {/* Prévia */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2"><CardTitle className="text-base">Prévia</CardTitle></CardHeader>
            <CardContent className="pb-4">
              <div
                className="relative overflow-hidden rounded-xl p-5"
                style={{
                  backgroundColor: c.bg,
                  color: c.muted,
                  backgroundImage: `radial-gradient(400px 180px at 50% -10%, ${finalAccent}22, transparent 60%)`,
                }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{ opacity: c.dark ? 0.1 : 0.14, ...(reviewPatternStyle(pattern, finalAccent) ?? {}) }}
                />
                <div className="relative text-center">
                  <span
                    className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.25em]"
                    style={{ borderColor: `${finalAccent}33`, background: `${finalAccent}12`, color: finalAccent }}
                  >
                    Portal de Avaliação
                  </span>
                  {est?.logo_url ? (
                    <img
                      src={est.logo_url}
                      alt={est?.name ?? "Logo"}
                      className="mx-auto mt-3 h-14 w-14 rounded-xl border object-cover"
                      style={{ borderColor: c.border }}
                    />
                  ) : null}
                  <div className="mt-3 text-lg font-bold" style={{ color: c.ink }}>
                    {headline.trim() || est?.name || "Seu negócio"}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: c.muted }}>
                    {subheadline.trim() || "Deixe sua avaliação para nos ajudar a melhorar"}
                  </div>
                </div>

                <div
                  className="relative mt-4 overflow-hidden rounded-xl border p-4"
                  style={{ background: c.surface, borderColor: c.border }}
                >
                  <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${finalAccent}, ${c.accent2})` }} />
                  <div className="flex justify-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="h-6 w-6" style={{ fill: i <= 4 ? finalAccent : "transparent", color: finalAccent, opacity: i <= 4 ? 1 : 0.35 }} />
                    ))}
                  </div>
                  <div className="mt-3 h-8 rounded-md" style={{ background: `${finalAccent}18` }} />
                  <div className="mt-2 h-8 rounded-md" style={{ background: finalAccent, opacity: 0.9 }} />
                </div>

                {showReviews ? (
                  <div className="relative mt-3 rounded-xl border p-3" style={{ background: c.surface, borderColor: c.border }}>
                    <div className="text-[11px] font-semibold" style={{ color: c.ink }}>Ana S.</div>
                    <div className="mt-1 flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className="h-3 w-3" style={{ fill: finalAccent, color: finalAccent }} />)}
                    </div>
                    <p className="mt-2 text-[11px]" style={{ color: c.muted }}>Atendimento excelente, voltarei com certeza!</p>
                  </div>
                ) : null}

                {showPowered ? (
                  <div className="relative mt-4 text-center font-mono text-[9px] uppercase tracking-[0.25em]" style={{ color: c.muted, opacity: 0.6 }}>
                    Powered by <span style={{ color: finalAccent }}>Fidelize</span>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
