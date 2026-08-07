import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Building2, Megaphone, Trash2, X, Upload, Save, Play, Calendar, Eye, Smartphone, Tablet, Monitor } from "lucide-react";
import { SponsoredAdCard, type AdTheme } from "@/components/SponsoredAdCard";
import { AD_DISPLAY_MODELS, AD_DISPLAY_MODEL_META, type AdDisplayModel } from "@/lib/sponsored-ads-core";
import { adminSaveAdCampaign } from "@/lib/sponsored-ads-admin.functions";
import { supabase } from "@/integrations/supabase/client";

interface AdminCampaignFormProps {
  campaign?: any;
  onDone: () => void;
  onCancel: () => void;
}

const THEMES: { id: AdTheme; label: string }[] = [
  { id: "premium_dark", label: "Premium Dark" },
  { id: "premium_light", label: "Premium Light" },
  { id: "gradient_promo", label: "Gradient Promo" },
  { id: "editorial", label: "Editorial" },
  { id: "minimal_product", label: "Minimal Product" },
  { id: "seasonal", label: "Seasonal" },
];

export function AdminCampaignForm({ campaign, onDone, onCancel }: AdminCampaignFormProps) {
  const qc = useQueryClient();
  const saveAdFn = useServerFn(adminSaveAdCampaign);
  
  const [targetType, setTargetType] = useState<"merchant" | "institutional">(campaign?.establishment_id ? "merchant" : "institutional");
  const [search, setSearch] = useState("");
  const [selectedMerchant, setSelectedMerchant] = useState<any>(campaign?.establishment || null);
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "tablet" | "desktop">("mobile");
  
  const [form, setForm] = useState<any>({
    internal_name: campaign?.internal_name || "",
    title: campaign?.title || "",
    description: campaign?.description || "",
    image_path: campaign?.image_path || "",
    video_url: campaign?.video_url || "",
    cta_label: campaign?.cta_label || "Aproveitar",
    destination_type: campaign?.destination_type || "establishment",
    destination_slug: campaign?.destination_slug || "",
    display_model: (campaign?.display_model as AdDisplayModel) || "premium_banner",
    theme: (campaign?.theme as AdTheme) || "premium_dark",
    slot_id: campaign?.slot_id || "discovery_hero",
    category_id: campaign?.category_id || "all",
    starts_at: campaign?.starts_at ? new Date(campaign.starts_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    ends_at: campaign?.ends_at ? new Date(campaign.ends_at).toISOString().slice(0, 16) : "",
    priority: campaign?.priority || "normal",
    display_order: campaign?.display_order || 0,
    hide_title: campaign?.hide_title ?? false,
    hide_description: campaign?.hide_description ?? false,
    hide_merchant_name: campaign?.hide_merchant_name ?? false,
    hide_prices: campaign?.hide_prices ?? false,
    hide_logo: campaign?.hide_logo ?? false,
    hide_cta: campaign?.hide_cta ?? false,
    full_bleed_mode: campaign?.full_bleed_mode ?? false,
  });

  const merchants = useQuery({
    queryKey: ["admin-merchant-search", search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const { data, error } = await supabase
        .from("establishments")
        .select("id, name, slug, logo_url")
        .or(`name.ilike.%${search}%,slug.ilike.%${search}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: targetType === "merchant"
  });

  const saveAd = useMutation({
    mutationFn: (status: string) => saveAdFn({ data: { ...form, id: campaign?.id, status, establishment_id: targetType === "merchant" ? selectedMerchant?.id : null } }),
    onSuccess: () => {
      toast.success(campaign ? "Campanha atualizada." : "Campanha criada.");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const ext = file.name.split('.').pop();
    const path = `admin/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    
    const { error } = await supabase.storage.from("sponsored-ads").upload(path, file);
    if (error) {
      toast.error("Erro no upload: " + error.message);
      return;
    }
    
    setForm({ ...form, image_path: path });
  };

  const getSignedUrl = useQuery({
    queryKey: ["ad-image-preview", form.image_path],
    queryFn: async () => {
      if (!form.image_path) return null;
      const { data } = await supabase.storage.from("sponsored-ads").createSignedUrl(form.image_path, 3600);
      return data?.signedUrl || null;
    },
    enabled: !!form.image_path
  });

  const previewData = {
    id: "preview",
    title: form.title || "Título do Anúncio",
    description: form.description || "Descrição atrativa da sua oferta...",
    merchantName: targetType === "merchant" ? (selectedMerchant?.name || "Estabelecimento") : "Afidelize",
    imageUrl: getSignedUrl.data || selectedMerchant?.logo_url || "",
    videoUrl: form.video_url,
    theme: form.theme,
    ctaLabel: form.cta_label,
    hideTitle: form.hide_title,
    hideDescription: form.hide_description,
    hideMerchantName: form.hide_merchant_name,
    hidePrices: form.hide_prices,
    hideLogo: form.hide_logo,
    hideCTA: form.hide_cta,
    fullBleedMode: form.full_bleed_mode,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <section className="rounded-3xl border border-border/60 bg-card/40 p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Megaphone className="h-4 w-4 text-primary" />
            Configuração Básica
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Origem da Campanha</label>
              <div className="mt-2 flex gap-2">
                {(["merchant", "institutional"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTargetType(t)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                      targetType === t ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground"
                    }`}
                  >
                    {t === "merchant" ? "Estabelecimento" : "Institucional"}
                  </button>
                ))}
              </div>
            </div>

            {targetType === "merchant" && (
              <div className="relative">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Selecionar Estabelecimento</label>
                {selectedMerchant ? (
                  <div className="mt-1.5 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg overflow-hidden border border-border/60">
                        <img src={selectedMerchant.logo_url} alt="" className="h-full w-full object-cover" />
                      </div>
                      <span className="text-sm font-bold">{selectedMerchant.name}</span>
                    </div>
                    <button onClick={() => setSelectedMerchant(null)} className="p-1 text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative mt-1.5">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar por nome ou slug..."
                      className="w-full rounded-xl border border-border/60 bg-background pl-9 pr-3 py-2 text-sm"
                    />
                    {merchants.data && merchants.data.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-card p-1 shadow-xl">
                        {merchants.data.map(m => (
                          <button
                            key={m.id}
                            onClick={() => { setSelectedMerchant(m); setSearch(""); }}
                            className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-muted"
                          >
                            <img src={m.logo_url || undefined} className="h-6 w-6 rounded border border-border/60" />
                            <span className="font-medium">{m.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome Interno</label>
              <input
                value={form.internal_name}
                onChange={e => setForm({ ...form, internal_name: e.target.value })}
                placeholder="Ex: Promo Black Friday 2024"
                className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border/60 bg-card/40 p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Eye className="h-4 w-4 text-primary" />
            Conteúdo & Visual
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Título</label>
              <input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">CTA</label>
              <input
                value={form.cta_label}
                onChange={e => setForm({ ...form, cta_label: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descrição</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Modelo</label>
              <select
                value={form.display_model}
                onChange={e => setForm({ ...form, display_model: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              >
                {AD_DISPLAY_MODELS.map(m => (
                  <option key={m} value={m}>{AD_DISPLAY_MODEL_META[m].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tema</label>
              <select
                value={form.theme}
                onChange={e => setForm({ ...form, theme: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              >
                {THEMES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
             <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mídia</label>
             <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/20 py-4 text-xs font-bold text-muted-foreground">
                    <Upload className="h-4 w-4" /> {form.image_path ? "Trocar Imagem" : "Subir Imagem"}
                  </div>
                </div>
                <input
                  value={form.video_url}
                  onChange={e => setForm({ ...form, video_url: e.target.value })}
                  placeholder="URL do Vídeo (opcional)"
                  className="flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
                />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "hide_title", label: "Ocultar Título" },
              { id: "hide_description", label: "Ocultar Descrição" },
              { id: "hide_merchant_name", label: "Ocultar Marca" },
              { id: "hide_prices", label: "Ocultar Preços" },
              { id: "hide_logo", label: "Ocultar Logo" },
              { id: "hide_cta", label: "Ocultar Botão" },
              { id: "full_bleed_mode", label: "Modo Full Bleed" },
            ].map(flag => (
              <label key={flag.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={form[flag.id]}
                  onChange={e => setForm({ ...form, [flag.id]: e.target.checked })}
                  className="rounded border-border/60"
                />
                {flag.label}
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border/60 bg-card/40 p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Calendar className="h-4 w-4 text-primary" />
            Programação & Prioridade
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Início</label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={e => setForm({ ...form, starts_at: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fim (Opcional)</label>
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={e => setForm({ ...form, ends_at: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prioridade</label>
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              >
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="max">Máxima</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ordem (Peso)</label>
              <input
                type="number"
                value={form.display_order}
                onChange={e => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="sticky top-6 rounded-3xl border border-border/60 bg-card/40 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Smartphone className="h-4 w-4 text-primary" />
              Preview Real-time
            </div>
            <div className="flex gap-1 rounded-lg border border-border/60 p-0.5">
              {[
                { id: "mobile", icon: Smartphone },
                { id: "tablet", icon: Tablet },
                { id: "desktop", icon: Monitor },
              ].map(d => (
                <button
                  key={d.id}
                  onClick={() => setPreviewDevice(d.id as any)}
                  className={`p-1.5 rounded-md transition-all ${
                    previewDevice === d.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  <d.icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-center py-8 bg-muted/10 rounded-2xl border border-dashed border-border/60">
             <div className={cn(
               "transition-all duration-300",
               previewDevice === "mobile" ? "w-[320px]" : previewDevice === "tablet" ? "w-[500px]" : "w-full px-4"
             )}>
                <SponsoredAdCard data={previewData as any} model={form.display_model} initialExpanded={true} />
             </div>
          </div>

          <div className="flex flex-col gap-3 pt-6 border-t border-border/60">
             <div className="flex gap-3">
               <button
                 onClick={() => saveAd.mutate("draft")}
                 disabled={saveAd.isPending}
                 className="flex-1 rounded-2xl border border-border/60 px-4 py-3 text-sm font-bold hover:bg-muted"
               >
                 Salvar Rascunho
               </button>
               <button
                 onClick={() => saveAd.mutate("active")}
                 disabled={saveAd.isPending}
                 className="flex-[1.5] flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/20 active:scale-[0.98]"
               >
                 <Play className="h-4 w-4" /> Publicar Agora
               </button>
             </div>
             <button
               onClick={onCancel}
               className="w-full text-center py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
             >
               Descartar alterações
             </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}
