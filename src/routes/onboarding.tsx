import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createEstablishment, getMyEstablishments } from "@/lib/loyalty.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";
import { StampCard } from "@/components/StampCard";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";
import { LogoCropper } from "@/components/LogoCropper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAMP_ICON_OPTIONS, getStampIcon, stampIconLabel } from "@/lib/stampIcons";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [{ title: "Configurar minha empresa — Fidelize" }] }),
  component: Onboarding,
});

function slugify(v: string) {
  return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // 10 anos

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createEstablishment);
  const getEsts = useServerFn(getMyEstablishments);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [logoRev, setLogoRev] = useState(0); // força reload da <img> quando trocamos o logo
  const [f, setF] = useState({
    name: "", slug: "", description: "", primary_color: "#5B21B6", accent_color: "#F97066",
    logo_url: "" as string,
    campaign_name: "Cartão Fidelidade", stamps_required: 10, reward_title: "", reward_description: "",
    stamp_icon: "coffee",
  });

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((s) => ({ ...s, [k]: v, ...(k === "name" && !s.slug ? { slug: slugify(v as string) } : {}) }));
  }

  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) {
      toast.error("Envie uma imagem PNG, JPG, WEBP ou SVG.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5 MB).");
      return;
    }
    setRawFile(file);
    setCropOpen(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadCropped(blob: Blob, _shape: "circle" | "rounded" | "square") {
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sessão expirada");
      const path = `${uid}/${crypto.randomUUID()}.png`;
      const { error: upErr } = await supabase.storage.from("logos").upload(path, blob, {
        cacheControl: "31536000", upsert: false, contentType: "image/png",
      });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("logos").createSignedUrl(path, SIGNED_URL_TTL);
      if (sErr || !signed?.signedUrl) throw sErr || new Error("Falha ao gerar link");
      set("logo_url", signed.signedUrl);
      setLogoRev((r) => r + 1);
      toast.success("Logo atualizado!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar logo");
    } finally {
      setUploading(false);
      setRawFile(null);
    }
  }

  function removeLogo() {
    set("logo_url", "");
    setLogoRev((r) => r + 1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleanSlug = slugify(f.slug);
    if (cleanSlug.length < 3) {
      toast.error("O endereço público precisa ter pelo menos 3 caracteres (letras, números ou hífens).");
      return;
    }
    if (f.name.trim().length < 2) { toast.error("Informe o nome da empresa."); return; }
    if (f.reward_title.trim().length < 2) { toast.error("Descreva a recompensa da campanha."); return; }
    setLoading(true);
    try {
      await create({ data: { ...f, slug: cleanSlug } });
      await qc.invalidateQueries();
      await getEsts();
      toast.success("Empresa criada!");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl p-4"><Logo /></div>
      </header>
      <div className="mx-auto max-w-5xl p-4 md:p-8 grid gap-8 md:grid-cols-[1fr_360px]">
        <form onSubmit={submit} className="space-y-6 rounded-3xl border bg-card p-6 md:p-8">
          <div>
            <h1 className="font-display text-2xl font-bold">Vamos configurar seu cartão fidelidade</h1>
            <p className="text-sm text-muted-foreground mt-1">Leva 2 minutos. Você pode ajustar tudo depois.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Nome da empresa</Label>
              <Input value={f.name} onChange={(e) => set("name", e.target.value)} required minLength={2} maxLength={80} placeholder="Ex: Café do Centro" />
            </div>
            <div>
              <Label>Endereço público</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">fidelize.app/l/</span>
                <Input value={f.slug} onChange={(e) => set("slug", slugify(e.target.value))} required minLength={3} placeholder="cafe-do-centro" />
              </div>
            </div>
          </div>

          <div>
            <Label>Descrição (opcional)</Label>
            <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={500} rows={2} placeholder="Uma frase sobre o seu negócio" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Cor principal</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={f.primary_color} onChange={(e) => set("primary_color", e.target.value)} className="h-10 w-14 rounded border" />
                <Input value={f.primary_color} onChange={(e) => set("primary_color", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Cor de destaque</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={f.accent_color} onChange={(e) => set("accent_color", e.target.value)} className="h-10 w-14 rounded border" />
                <Input value={f.accent_color} onChange={(e) => set("accent_color", e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <Label>Logo do seu negócio (opcional)</Label>
            <div className="mt-2 flex items-center gap-4">
              <div className="h-20 w-20 shrink-0 grid place-items-center overflow-hidden">
                {f.logo_url ? (
                  <img key={logoRev} src={f.logo_url} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <div className="h-full w-full rounded-2xl border bg-muted/40 grid place-items-center">
                    <span className="text-xs font-display font-bold text-muted-foreground">{(f.name || "?").trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase().slice(0,2) || "?"}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={onPickLogo} />
                <div className="flex gap-2 flex-wrap">
                  <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {f.logo_url ? "Trocar logo" : "Enviar logo"}
                  </Button>
                  {f.logo_url && (
                    <Button type="button" variant="ghost" size="sm" onClick={removeLogo}>
                      <X className="h-4 w-4 mr-1" /> Remover
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">PNG, JPG, WEBP ou SVG. Até 5 MB. Você recorta antes de enviar.</p>
              </div>
            </div>
          </div>


          <div className="border-t pt-6 space-y-4">
            <h2 className="font-display text-lg font-semibold">Primeira campanha</h2>
            <div>
              <Label>Nome da campanha</Label>
              <Input value={f.campaign_name} onChange={(e) => set("campaign_name", e.target.value)} maxLength={80} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Carimbos necessários</Label>
                <Input type="number" min={2} max={50} value={f.stamps_required} onChange={(e) => set("stamps_required", Number(e.target.value))} />
              </div>
              <div>
                <Label>Ícone do carimbo</Label>
                <Select value={f.stamp_icon} onValueChange={(v) => set("stamp_icon", v)}>
                  <SelectTrigger>
                    <SelectValue asChild>
                      <IconRow value={f.stamp_icon} />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {STAMP_ICON_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <IconRow value={opt.value} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-1">
              <div>
                <Label>Recompensa (título)</Label>
                <Input value={f.reward_title} onChange={(e) => set("reward_title", e.target.value)} required maxLength={120} placeholder="Um café grátis" />
              </div>
            </div>
            <div>
              <Label>Recompensa (detalhes)</Label>
              <Textarea value={f.reward_description} onChange={(e) => set("reward_description", e.target.value)} maxLength={500} rows={2} placeholder="Ex: válido de segunda a sexta, exceto especiais" />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full gradient-brand text-primary-foreground" size="lg">
            {loading ? "Criando…" : "Criar minha empresa"}
          </Button>
        </form>

        <div className="hidden md:block">
          <div className="sticky top-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Prévia</div>
            <StampCard
              key={logoRev}
              brandName={f.name || "Sua empresa"}
              logoUrl={f.logo_url || undefined}
              customerName="Cliente exemplo"
              stamps={Math.min(3, f.stamps_required)}
              required={f.stamps_required}
              reward={f.reward_title || "Sua recompensa aqui"}
              primary={f.primary_color}
              accent={f.accent_color}
            />
          </div>
        </div>
      </div>
      <LogoCropper
        file={rawFile}
        open={cropOpen}
        onOpenChange={(o) => { setCropOpen(o); if (!o) setRawFile(null); }}
        onCropped={uploadCropped}
      />
    </div>
  );
}
