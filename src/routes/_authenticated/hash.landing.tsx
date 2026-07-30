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
  type MenuDish,
} from "@/lib/landing-content";
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

function LandingAdmin() {
  const load = useServerFn(getLandingPublic);
  const save = useServerFn(saveLandingContent);
  const { data, isLoading } = useQuery({ queryKey: ["landing-content-admin"], queryFn: () => load() });

  const [hero, setHero] = useState<LandingHeroContent>(DEFAULT_HERO);
  const [brands, setBrands] = useState<LandingBrandsContent>(DEFAULT_BRANDS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setHero(data.hero);
    setBrands(data.brands);
  }, [data]);

  const copy = hero.copy ?? DEFAULT_HERO.copy;
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
      await save({ data: { hero, brands } });
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Página inicial</h1>
          <p className="text-sm text-muted-foreground">
            Controle o conteúdo do celular da hero e o carrossel de marcas. Os preços vêm automaticamente de Planos.
          </p>
        </div>
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar alterações
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Tabs defaultValue="chamada" className="min-w-0">
          <TabsList>
            <TabsTrigger value="chamada">Chamada</TabsTrigger>
            <TabsTrigger value="cardapio">Cardápio</TabsTrigger>
            <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
            <TabsTrigger value="marcas">Marcas</TabsTrigger>
          </TabsList>

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
        </Tabs>

        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" /> Pré-visualização
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
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
