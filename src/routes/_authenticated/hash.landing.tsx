import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getLandingPublic, saveLandingContent } from "@/lib/landing-content.functions";
import {
  DEFAULT_BRANDS,
  DEFAULT_HERO,
  type BrandItem,
  type CatalogProduct,
  type LandingBrandsContent,
  type LandingHeroContent,
  type LandingHeroCopy,
  type LandingHeroDevice,
  type MenuDish,
} from "@/lib/landing-content";
import { DEFAULT_BRAND, type BrandIdentity } from "@/lib/brand";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { HeroAppPreview } from "@/components/landing/HeroAppPreview";
import { BrandMarquee } from "@/components/landing/BrandMarquee";
import { ImagePlus, Loader2, Plus, Save, Trash2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/hash/landing")({
  component: LandingAdmin,
});

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

/** Envia a imagem para o bucket privado e devolve uma URL assinada de longa duração. */
async function uploadImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `landing/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("landing-media").upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);
  const { data, error: signErr } = await supabase.storage.from("landing-media").createSignedUrl(path, TEN_YEARS);
  if (signErr || !data?.signedUrl) throw new Error(signErr?.message || "Falha ao gerar link da imagem.");
  return data.signedUrl;
}

function ImageField({ value, onChange, label }: { value?: string | null; onChange: (v: string) => void; label: string }) {
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem muito grande (máx. 5 MB).");
    setBusy(true);
    try {
      onChange(await uploadImage(file));
      toast.success("Imagem atualizada.");
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível enviar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Cole uma URL ou envie um arquivo" />
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-primary">
            <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={busy} />
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            {busy ? "Enviando..." : "Enviar imagem"}
          </label>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function LandingAdmin() {
  const load = useServerFn(getLandingPublic);
  const save = useServerFn(saveLandingContent);
  const { data, isLoading } = useQuery({ queryKey: ["landing-content-admin"], queryFn: () => load() });

  const [hero, setHero] = useState<LandingHeroContent>(DEFAULT_HERO);
  const [brands, setBrands] = useState<LandingBrandsContent>(DEFAULT_BRANDS);
  const [brand, setBrand] = useState<BrandIdentity>(DEFAULT_BRAND);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setHero(data.hero);
    setBrands(data.brands);
    if ((data as any).brand) setBrand((data as any).brand);
  }, [data]);

  const copy = hero.copy ?? DEFAULT_HERO.copy;
  const device = hero.device ?? DEFAULT_HERO.device;
  const patchDevice = (patch: Partial<LandingHeroDevice>) =>
    setHero((h) => ({ ...h, device: { ...(h.device ?? DEFAULT_HERO.device), ...patch } }));
  const patchCopy = (patch: Partial<LandingHeroCopy>) => setHero((h) => ({ ...h, copy: { ...(h.copy ?? DEFAULT_HERO.copy), ...patch } }));
  const patchDish = (i: number, patch: Partial<MenuDish>) =>
    setHero((h) => ({ ...h, menu: { ...h.menu, dishes: h.menu.dishes.map((d, k) => (k === i ? { ...d, ...patch } : d)) } }));
  const patchProduct = (i: number, patch: Partial<CatalogProduct>) =>
    setHero((h) => ({
      ...h,
      catalog: { ...h.catalog, products: h.catalog.products.map((p, k) => (k === i ? { ...p, ...patch } : p)) },
    }));
  const patchBrand = (i: number, patch: Partial<BrandItem>) =>
    setBrands((b) => ({ ...b, brands: b.brands.map((x, k) => (k === i ? { ...x, ...patch } : x)) }));

  async function onSave() {
    setSaving(true);
    try {
      await save({ data: { hero, brands, brand } });
      try {
        localStorage.removeItem("fidelize.brand.v1");
      } catch { /* storage bloqueado */ }
      // Avisa as abas abertas da landing para recarregarem na hora.
      const channel = supabase.channel("landing-content");
      await channel.subscribe();
      await channel.send({ type: "broadcast", event: "updated", payload: { at: Date.now() } });
      supabase.removeChannel(channel);
      toast.success("Conteúdo atualizado. A página inicial já foi recarregada em tempo real.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="font-display text-2xl font-bold">Página inicial</h1>
          <p className="text-sm text-muted-foreground">
            Controle o conteúdo do celular da hero e o carrossel de marcas. Os preços vêm automaticamente de Planos.
          </p>
        </div>
        <Button onClick={onSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar alterações
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Tabs defaultValue="chamada" className="min-w-0">
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="inline-flex w-max flex-nowrap">
            <TabsTrigger value="chamada">Chamada</TabsTrigger>
            <TabsTrigger value="celular">Celular</TabsTrigger>
            <TabsTrigger value="cardapio">Cardápio</TabsTrigger>
            <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
            <TabsTrigger value="marcas">Marcas</TabsTrigger>
            <TabsTrigger value="logo">Logo</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="chamada" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chamada principal da hero</CardTitle>
                <CardDescription>
                  Selo, título, subtítulo e os dois botões que aparecem no topo da página inicial.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs">Selo (botão pequeno acima do título)</Label>
                  <Input value={copy.badge} onChange={(e) => patchCopy({ badge: e.target.value })} />
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-2">
                    <Label className="text-xs">Frase de gatilho (início)</Label>
                    <Input value={copy.titlePrefix} onChange={(e) => patchCopy({ titlePrefix: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Trecho destacado</Label>
                    <Input value={copy.titleHighlight} onChange={(e) => patchCopy({ titleHighlight: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Subtítulo</Label>
                  <Textarea rows={3} value={copy.subtitle} onChange={(e) => patchCopy({ subtitle: e.target.value })} />
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3 rounded-xl border p-3">
                    <span className="text-xs font-semibold text-muted-foreground">Botão principal</span>
                    <Input
                      value={copy.primaryCta.label}
                      placeholder="Texto do botão"
                      onChange={(e) => patchCopy({ primaryCta: { ...copy.primaryCta, label: e.target.value } })}
                    />
                    <Input
                      value={copy.primaryCta.href}
                      placeholder="#precos ou /auth"
                      onChange={(e) => patchCopy({ primaryCta: { ...copy.primaryCta, href: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-3 rounded-xl border p-3">
                    <span className="text-xs font-semibold text-muted-foreground">Botão secundário</span>
                    <Input
                      value={copy.secondaryCta.label}
                      placeholder="Texto do botão"
                      onChange={(e) => patchCopy({ secondaryCta: { ...copy.secondaryCta, label: e.target.value } })}
                    />
                    <Input
                      value={copy.secondaryCta.href}
                      placeholder="#ecossistema"
                      onChange={(e) => patchCopy({ secondaryCta: { ...copy.secondaryCta, href: e.target.value } })}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-xs">
                    Selos abaixo dos botões — use <code>{"{preco}"}</code> para inserir o menor preço ativo
                  </Label>
                  {copy.bullets.map((b, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={b}
                        onChange={(e) => patchCopy({ bullets: copy.bullets.map((x, k) => (k === i ? e.target.value : x)) })}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => patchCopy({ bullets: copy.bullets.filter((_, k) => k !== i) })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" onClick={() => patchCopy({ bullets: [...copy.bullets, "Novo selo"] })}>
                    <Plus className="mr-2 h-4 w-4" /> Adicionar selo
                  </Button>
                </div>

                <div className="space-y-3 rounded-xl border border-border/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs">
                      Prova social — use <code>{"{destaque}"}</code> para posicionar o trecho em destaque
                    </Label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={copy.socialProof.enabled}
                        onChange={(e) => patchCopy({ socialProof: { ...copy.socialProof, enabled: e.target.checked } })}
                      />
                      Exibir
                    </label>
                  </div>
                  <Input
                    value={copy.socialProof.text}
                    placeholder="Mais de {destaque} usando a Fidelize."
                    onChange={(e) => patchCopy({ socialProof: { ...copy.socialProof, text: e.target.value } })}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={copy.socialProof.highlight}
                      placeholder="2.000 lojistas"
                      onChange={(e) => patchCopy({ socialProof: { ...copy.socialProof, highlight: e.target.value } })}
                    />
                    <Input
                      value={copy.socialProof.avatarLabel}
                      placeholder="+2k"
                      onChange={(e) => patchCopy({ socialProof: { ...copy.socialProof, avatarLabel: e.target.value } })}
                    />
                  </div>
                </div>

              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="celular" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Celular da hero (mobile e desktop)</CardTitle>
                <CardDescription>
                  Todo o conteúdo exibido dentro do celular e nos cartões flutuantes ao redor dele.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Rótulo superior" value={device.eyebrow} onChange={(v) => patchDevice({ eyebrow: v })} />
                  <Field label="Nome da loja" value={device.storeName} onChange={(v) => patchDevice({ storeName: v })} />
                </div>

                <Separator />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tela 1 · Cartão fidelidade</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Título do cartão" value={device.cardTitle} onChange={(v) => patchDevice({ cardTitle: v })} />
                  <Field label="Frase do rodapé" value={device.cardFooter} onChange={(v) => patchDevice({ cardFooter: v })} />
                  <div className="space-y-2">
                    <Label className="text-xs">Total de carimbos (4 a 20)</Label>
                    <Input
                      type="number"
                      min={4}
                      max={20}
                      value={device.stamps}
                      onChange={(e) => patchDevice({ stamps: Number(e.target.value) || 10 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Carimbos preenchidos</Label>
                    <Input
                      type="number"
                      min={0}
                      max={device.stamps}
                      value={device.stampsFilled}
                      onChange={(e) => patchDevice({ stampsFilled: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <Field label="Rótulo do prêmio" value={device.rewardLabel} onChange={(v) => patchDevice({ rewardLabel: v })} />
                  <Field label="Prêmio" value={device.rewardValue} onChange={(v) => patchDevice({ rewardValue: v })} />
                </div>

                <Separator />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Telas 2 e 3</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Título do story" value={device.storyTitle} onChange={(v) => patchDevice({ storyTitle: v })} />
                  <Field label="Legenda do story" value={device.storySubtitle} onChange={(v) => patchDevice({ storySubtitle: v })} />
                  <Field label="Título do catálogo" value={device.catalogTitle} onChange={(v) => patchDevice({ catalogTitle: v })} />
                </div>

                <Separator />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cartões flutuantes</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="CRM · título" value={device.crmTitle} onChange={(v) => patchDevice({ crmTitle: v })} />
                  <Field label="CRM · número" value={device.crmValue} onChange={(v) => patchDevice({ crmValue: v })} />
                  <Field label="CRM · legenda" value={device.crmCaption} onChange={(v) => patchDevice({ crmCaption: v })} />
                  <Field label="Atendimento · título" value={device.chatTitle} onChange={(v) => patchDevice({ chatTitle: v })} />
                  <Field label="Avaliações · título" value={device.reviewsTitle} onChange={(v) => patchDevice({ reviewsTitle: v })} />
                  <Field label="Avaliações · legenda" value={device.reviewsCaption} onChange={(v) => patchDevice({ reviewsCaption: v })} />
                  <Field label="Entrega · título" value={device.deliveryTitle} onChange={(v) => patchDevice({ deliveryTitle: v })} />
                  <Field label="Entrega · legenda" value={device.deliveryCaption} onChange={(v) => patchDevice({ deliveryCaption: v })} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cardapio" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aba Cardápio</CardTitle>
                <CardDescription>Pratos exibidos em stories dentro do celular.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs">Título da tela</Label>
                  <Input
                    value={hero.menu.title}
                    onChange={(e) => setHero((h) => ({ ...h, menu: { ...h.menu, title: e.target.value } }))}
                  />
                </div>
                <Separator />
                {hero.menu.dishes.map((d, i) => (
                  <div key={i} className="space-y-3 rounded-xl border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Prato {i + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setHero((h) => ({ ...h, menu: { ...h.menu, dishes: h.menu.dishes.filter((_, k) => k !== i) } }))
                        }
                        disabled={hero.menu.dishes.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input value={d.name} placeholder="Nome" onChange={(e) => patchDish(i, { name: e.target.value })} />
                      <Input value={d.price} placeholder="Preço" onChange={(e) => patchDish(i, { price: e.target.value })} />
                    </div>
                    <Input value={d.desc} placeholder="Descrição" onChange={(e) => patchDish(i, { desc: e.target.value })} />
                    <ImageField label="Foto do prato" value={d.img} onChange={(v) => patchDish(i, { img: v })} />
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() =>
                    setHero((h) => ({
                      ...h,
                      menu: { ...h.menu, dishes: [...h.menu.dishes, { name: "Novo prato", desc: "", price: "R$ 0,00", img: "" }] },
                    }))
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> Adicionar prato
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="catalogo" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aba Catálogo</CardTitle>
                <CardDescription>Produtos reais exibidos na grade (até 4 aparecem no celular).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs">Título da tela</Label>
                  <Input
                    value={hero.catalog.title}
                    onChange={(e) => setHero((h) => ({ ...h, catalog: { ...h.catalog, title: e.target.value } }))}
                  />
                </div>
                <Separator />
                {hero.catalog.products.map((p, i) => (
                  <div key={i} className="space-y-3 rounded-xl border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Produto {i + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setHero((h) => ({
                            ...h,
                            catalog: { ...h.catalog, products: h.catalog.products.filter((_, k) => k !== i) },
                          }))
                        }
                        disabled={hero.catalog.products.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input value={p.name} placeholder="Nome" onChange={(e) => patchProduct(i, { name: e.target.value })} />
                      <Input value={p.price} placeholder="Preço" onChange={(e) => patchProduct(i, { price: e.target.value })} />
                    </div>
                    <ImageField label="Foto do produto" value={p.img} onChange={(v) => patchProduct(i, { img: v })} />
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() =>
                    setHero((h) => ({
                      ...h,
                      catalog: { ...h.catalog, products: [...h.catalog.products, { name: "Novo produto", price: "R$ 0", img: "" }] },
                    }))
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> Adicionar produto
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="marcas" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Carrossel de marcas</CardTitle>
                <CardDescription>
                  Sem logo enviada, marcas conhecidas (Nike, Apple, Adidas...) usam o glifo padrão; as demais viram texto.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs">Título da seção</Label>
                  <Input value={brands.title} onChange={(e) => setBrands((b) => ({ ...b, title: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Subtítulo</Label>
                  <Input value={brands.subtitle} onChange={(e) => setBrands((b) => ({ ...b, subtitle: e.target.value }))} />
                </div>
                <Separator />
                {brands.brands.map((b, i) => (
                  <div key={i} className="space-y-3 rounded-xl border p-3">
                    <div className="flex items-center gap-2">
                      <Input value={b.name} placeholder="Nome da marca" onChange={(e) => patchBrand(i, { name: e.target.value })} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBrands((s) => ({ ...s, brands: s.brands.filter((_, k) => k !== i) }))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <ImageField label="Logo (opcional)" value={b.img} onChange={(v) => patchBrand(i, { img: v })} />
                  </div>
                ))}
                <Button variant="outline" onClick={() => setBrands((s) => ({ ...s, brands: [...s.brands, { name: "Nova marca" }] }))}>
                  <Plus className="mr-2 h-4 w-4" /> Adicionar marca
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logo" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Logo da plataforma</CardTitle>
                <CardDescription>
                  Aplicada no menu (desktop e mobile), no topo das telas públicas e no login. Envie um arquivo ou cole uma URL
                  https. Prefira PNG/SVG com fundo transparente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <ImageField
                  label="Logo horizontal — fundo claro"
                  value={brand.logoUrl}
                  onChange={(v) => setBrand((b) => ({ ...b, logoUrl: v }))}
                />
                <ImageField
                  label="Logo horizontal — tema escuro (opcional)"
                  value={brand.logoDarkUrl}
                  onChange={(v) => setBrand((b) => ({ ...b, logoDarkUrl: v }))}
                />
                <ImageField
                  label="Símbolo quadrado — menu colapsado (opcional)"
                  value={brand.markUrl}
                  onChange={(v) => setBrand((b) => ({ ...b, markUrl: v }))}
                />
                <div className="space-y-2">
                  <Label className="text-xs">Texto alternativo</Label>
                  <Input
                    value={brand.alt}
                    maxLength={60}
                    onChange={(e) => setBrand((b) => ({ ...b, alt: e.target.value }))}
                    placeholder="Fidelize"
                  />
                </div>

                <Separator />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border bg-white p-4">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Fundo claro</p>
                    <img src={brand.logoUrl} alt="" className="h-8 w-auto max-w-full object-contain object-left" />
                  </div>
                  <div className="rounded-xl border bg-[#0b0713] p-4">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">Fundo escuro</p>
                    <img src={brand.logoDarkUrl} alt="" className="h-8 w-auto max-w-full object-contain object-left" />
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border p-4">
                    <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-primary/10">
                      <img src={brand.markUrl} alt="" className="h-full w-full object-contain p-0.5" />
                    </div>
                    <span className="text-xs text-muted-foreground">Menu colapsado</span>
                  </div>
                </div>

                <Button variant="outline" size="sm" onClick={() => setBrand(DEFAULT_BRAND)}>
                  Restaurar logo padrão
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
          <Card className="lg:sticky lg:top-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" /> Pré-visualização
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="mb-4 rounded-xl border bg-[#020617] p-4 text-left text-white">
                {copy.badge ? (
                  <span className="inline-flex rounded-full border border-[#a78bfa55] bg-[#a78bfa14] px-2 py-0.5 text-[10px] text-[#a78bfa]">
                    {copy.badge}
                  </span>
                ) : null}
                <p className="mt-2 font-display text-lg font-extrabold leading-tight">
                  {copy.titlePrefix} <span className="text-[#a78bfa]">{copy.titleHighlight}</span>.
                </p>
                <p className="mt-1.5 text-[11px] leading-snug text-white/60">{copy.subtitle}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-md bg-[#a78bfa] px-2.5 py-1 text-[11px] font-bold text-[#020617]">
                    {copy.primaryCta.label}
                  </span>
                  <span className="rounded-md border border-white/20 px-2.5 py-1 text-[11px]">{copy.secondaryCta.label}</span>
                </div>
              </div>
              <div className="scale-90 origin-top">
                <HeroAppPreview content={hero} />
              </div>
              <div className="mt-4 overflow-hidden rounded-xl border py-4">
                <BrandMarquee brands={brands.brands} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
