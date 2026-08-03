import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listDiscoverBannersAdmin,
  saveDiscoverBanner,
  deleteDiscoverBanner,
  getDiscoverSettings,
  saveDiscoverSettings,
} from "@/lib/discover.functions";
import { DEFAULT_DISCOVER_SETTINGS, type DiscoverBanner, type DiscoverSettings } from "@/lib/discover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Compass, Loader2, Plus, Save, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/hash/descobrir")({
  component: DiscoverAdmin,
  head: () => ({
    meta: [
      { title: "Descobrir & Banners · Fidelize" },
      { name: "description", content: "Gerencie banners promocionais e o raio de busca da área Descobrir." },
      { property: "og:title", content: "Descobrir & Banners · Fidelize" },
      { property: "og:description", content: "Banners e raio de busca da área Descobrir." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Draft = Omit<DiscoverBanner, "id"> & { id?: string };

const EMPTY: Draft = {
  title: "",
  subtitle: "",
  image_url: "",
  link_url: "",
  bg_color: "",
  text_color: "",
  cta_label: "",
  active: true,
  sort_order: 0,
  starts_at: null,
  ends_at: null,
  city: "",
};

function DiscoverAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(listDiscoverBannersAdmin);
  const save = useServerFn(saveDiscoverBanner);
  const remove = useServerFn(deleteDiscoverBanner);
  const loadSettings = useServerFn(getDiscoverSettings);
  const persistSettings = useServerFn(saveDiscoverSettings);

  const bannersQuery = useQuery({ queryKey: ["admin-discover-banners"], queryFn: () => list(), retry: false });
  const settingsQuery = useQuery({ queryKey: ["admin-discover-settings"], queryFn: () => loadSettings(), retry: false });

  const [settings, setSettings] = useState<DiscoverSettings>(DEFAULT_DISCOVER_SETTINGS);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) setSettings(settingsQuery.data);
  }, [settingsQuery.data]);

  useEffect(() => {
    if (bannersQuery.data) setDrafts(bannersQuery.data.map((b) => ({ ...b })));
  }, [bannersQuery.data]);

  function patch(i: number, values: Partial<Draft>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...values } : d)));
  }

  async function saveOne(d: Draft) {
    if (d.title.trim().length < 2) return toast.error("Informe um título.");
    setBusy(true);
    try {
      await save({
        data: {
          id: d.id,
          title: d.title.trim(),
          subtitle: d.subtitle || null,
          image_url: d.image_url || null,
          link_url: d.link_url || null,
          bg_color: d.bg_color || null,
          text_color: d.text_color || null,
          cta_label: d.cta_label || null,
          active: d.active,
          sort_order: Number(d.sort_order) || 0,
          starts_at: d.starts_at || null,
          ends_at: d.ends_at || null,
          city: d.city || null,
        },
      });
      toast.success("Banner salvo.");
      await qc.invalidateQueries({ queryKey: ["admin-discover-banners"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function removeOne(d: Draft, i: number) {
    if (!d.id) return setDrafts((prev) => prev.filter((_, idx) => idx !== i));
    setBusy(true);
    try {
      await remove({ data: { id: d.id } });
      toast.success("Banner removido.");
      await qc.invalidateQueries({ queryKey: ["admin-discover-banners"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover.");
    } finally {
      setBusy(false);
    }
  }

  async function saveConfig() {
    setBusy(true);
    try {
      await persistSettings({ data: { settings } });
      toast.success("Configuração salva.");
      await qc.invalidateQueries({ queryKey: ["admin-discover-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar configuração.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <Compass className="h-5 w-5 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Descobrir &amp; Banners</h1>
          <p className="text-sm text-muted-foreground">
            Controle os banners rotativos e o raio de busca por localização da área Descobrir.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Raio de busca</CardTitle>
          <CardDescription>Define quais distâncias o cliente pode escolher na carteira.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Raio padrão (km)</Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={settings.defaultRadiusKm}
              onChange={(e) => setSettings({ ...settings, defaultRadiusKm: Number(e.target.value) || 30 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Opções (km, separadas por vírgula)</Label>
            <Input
              value={settings.radiusOptions.join(", ")}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  radiusOptions: e.target.value
                    .split(",")
                    .map((v) => Number(v.trim()))
                    .filter((v) => Number.isFinite(v) && v > 0),
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Rotação dos banners (ms)</Label>
            <Input
              type="number"
              min={2000}
              step={500}
              value={settings.bannerIntervalMs}
              onChange={(e) => setSettings({ ...settings, bannerIntervalMs: Number(e.target.value) || 6000 })}
            />
          </div>
          <div className="sm:col-span-3">
            <Button onClick={saveConfig} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar configuração
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Banners</CardTitle>
            <CardDescription>Aparecem no topo do Descobrir, em carrossel automático.</CardDescription>
          </div>
          <Button variant="outline" onClick={() => setDrafts((p) => [{ ...EMPTY, sort_order: p.length }, ...p])}>
            <Plus className="mr-2 h-4 w-4" /> Novo banner
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {bannersQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!bannersQuery.isLoading && drafts.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum banner cadastrado ainda.</p>
          )}
          {drafts.map((d, i) => (
            <div key={d.id ?? `new-${i}`} className="space-y-3 rounded-2xl border border-border/60 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input value={d.title} onChange={(e) => patch(i, { title: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Subtítulo</Label>
                  <Input value={d.subtitle ?? ""} onChange={(e) => patch(i, { subtitle: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Imagem (URL)</Label>
                  <Input value={d.image_url ?? ""} onChange={(e) => patch(i, { image_url: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Link de destino</Label>
                  <Input value={d.link_url ?? ""} onChange={(e) => patch(i, { link_url: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cor de fundo</Label>
                  <Input placeholder="#2E1065" value={d.bg_color ?? ""} onChange={(e) => patch(i, { bg_color: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cor do texto</Label>
                  <Input placeholder="#FFFFFF" value={d.text_color ?? ""} onChange={(e) => patch(i, { text_color: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Rótulo do botão</Label>
                  <Input value={d.cta_label ?? ""} onChange={(e) => patch(i, { cta_label: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cidade (opcional)</Label>
                  <Input value={d.city ?? ""} onChange={(e) => patch(i, { city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Início</Label>
                  <Input
                    type="datetime-local"
                    value={d.starts_at ? String(d.starts_at).slice(0, 16) : ""}
                    onChange={(e) => patch(i, { starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fim</Label>
                  <Input
                    type="datetime-local"
                    value={d.ends_at ? String(d.ends_at).slice(0, 16) : ""}
                    onChange={(e) => patch(i, { ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    value={d.sort_order}
                    onChange={(e) => patch(i, { sort_order: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={d.active} onCheckedChange={(v) => patch(i, { active: v })} />
                  <span className="text-sm text-muted-foreground">Ativo</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => saveOne(d)} disabled={busy}>
                  <Save className="mr-2 h-4 w-4" /> Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => removeOne(d, i)} disabled={busy}>
                  <Trash2 className="mr-2 h-4 w-4" /> Remover
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
