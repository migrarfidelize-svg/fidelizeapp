import { createFileRoute } from "@tanstack/react-router";
import { ConfigureQrButton } from "@/components/merchant/ConfigureQrButton";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage as friendlyError } from "@/lib/error-messages";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { getMyLinkTree, upsertLinkTree } from "@/lib/linktree.functions";
import { validatePixKey, PIX_TYPE_LABEL } from "@/lib/pix-validation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ExternalLink, Instagram, MessageCircle, Globe, MapPin, Youtube, Facebook,
  Music2, Mail, Phone, Star, Trash2, ArrowUp, ArrowDown, Plus, Eye, Copy, QrCode, Wifi, KeyRound,
  UtensilsCrossed, CreditCard,
} from "lucide-react";



export const Route = createFileRoute("/_authenticated/app/linktree")({
  ssr: false,
  component: LinkTreeEditor,
});

type LinkKind = "whatsapp" | "instagram" | "facebook" | "tiktok" | "youtube" | "site" | "google" | "maps" | "email" | "phone" | "wifi" | "pix" | "cardapio" | "cartao" | "custom";

type LinkRow = {
  id?: string;
  kind: LinkKind;
  label: string;
  url: string;
  icon?: string | null;
  enabled: boolean;
  sort_order: number;
};

const KIND_META: Record<LinkKind, { label: string; icon: any; placeholder: string }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, placeholder: "5511999999999" },
  instagram: { label: "Instagram", icon: Instagram, placeholder: "@seuperfil" },
  facebook: { label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/…" },
  tiktok: { label: "TikTok", icon: Music2, placeholder: "https://tiktok.com/@…" },
  youtube: { label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@…" },
  site: { label: "Site", icon: Globe, placeholder: "https://seusite.com" },
  google: { label: "Google Reviews", icon: Star, placeholder: "https://g.page/…/review" },
  maps: { label: "Endereço / Maps", icon: MapPin, placeholder: "https://maps.google.com/…" },
  email: { label: "E-mail", icon: Mail, placeholder: "contato@seudominio.com" },
  phone: { label: "Telefone", icon: Phone, placeholder: "1130000000" },
  wifi: { label: "Wi-Fi", icon: Wifi, placeholder: "WIFI:S:Rede;T:WPA;P:senha;;" },
  pix: { label: "Chave Pix", icon: KeyRound, placeholder: "PIX:T:email;K:chave;;" },
  cardapio: { label: "Cardápio Digital", icon: UtensilsCrossed, placeholder: "/cardapio/seu-slug" },
  cartao: { label: "Cartão Fidelidade", icon: CreditCard, placeholder: "/cartao/seu-slug" },
  custom: { label: "Link personalizado", icon: ExternalLink, placeholder: "https://…" },
};

// Encode/decode helpers for Wi-Fi credentials stored in the `url` field
function encodeWifi(ssid: string, password: string, security: "WPA" | "nopass" = "WPA") {
  const esc = (s: string) => s.replace(/([\\;,":])/g, "\\$1");
  return `WIFI:S:${esc(ssid)};T:${password ? security : "nopass"};P:${esc(password)};;`;
}
function decodeWifi(url: string): { ssid: string; password: string } {
  const s = /WIFI:.*?S:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const p = /WIFI:.*?P:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const unesc = (v: string) => v.replace(/\\(.)/g, "$1");
  return { ssid: unesc(s), password: unesc(p) };
}

// Encode/decode helpers for Pix keys stored in the `url` field
type PixKeyType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";
function encodePix(type: PixKeyType, key: string, name: string) {
  const esc = (s: string) => s.replace(/([\\;,":])/g, "\\$1");
  return `PIX:T:${type};K:${esc(key)};N:${esc(name)};;`;
}
function decodePix(url: string): { type: PixKeyType; key: string; name: string } {
  const t = (/PIX:.*?T:([^;]+);/i.exec(url)?.[1] ?? "email") as PixKeyType;
  const k = /PIX:.*?K:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const n = /PIX:.*?N:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const unesc = (v: string) => v.replace(/\\(.)/g, "$1");
  const validTypes: PixKeyType[] = ["cpf", "cnpj", "email", "telefone", "aleatoria"];
  return {
    type: validTypes.includes(t) ? t : "email",
    key: unesc(k),
    name: unesc(n),
  };
}



type ThemePreset = {
  id: string;
  label: string;
  primary: string;
  accent: string;
  background: string;
  text: string;
  button_style: "solid" | "outline" | "glass";
  rounded: "sm" | "md" | "lg" | "xl" | "full";
};

const THEME_PRESETS: ThemePreset[] = [
  {
    id: "cyan-circuit",
    label: "Cyan Circuit",
    primary: "#00ffff",
    accent: "#ff2fd0",
    background: "#0b1220",
    text: "#ffffff",
    button_style: "glass",
    rounded: "xl",
  },
  {
    id: "porcelain",
    label: "Porcelain",
    primary: "#0284c7",
    accent: "#e11d8a",
    background: "#f8fafc",
    text: "#0f172a",
    button_style: "solid",
    rounded: "full",
  },
  {
    id: "sunset-neon",
    label: "Sunset Neon",
    primary: "#f59e0b",
    accent: "#ef4444",
    background: "#1a0b2e",
    text: "#fff7ed",
    button_style: "outline",
    rounded: "lg",
  },
];

function LinkTreeEditor() {
  const getEsts = useServerFn(getMyEstablishments);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as
    | { id: string; slug: string; name: string; logo_url: string | null; primary_color: string; accent_color: string }
    | undefined;

  const getFn = useServerFn(getMyLinkTree);
  const saveFn = useServerFn(upsertLinkTree);
  const q = useQuery({
    queryKey: ["my-linktree", est?.id],
    queryFn: () => getFn({ data: { establishment_id: est!.id } }),
    enabled: !!est?.id,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [primary, setPrimary] = useState("#0ea5e9");
  const [accent, setAccent] = useState("#8b5cf6");
  const [background, setBackground] = useState("#0b0f19");
  const [text, setText] = useState("#ffffff");
  const [buttonStyle, setButtonStyle] = useState<"solid" | "outline" | "glass">("solid");
  const [rounded, setRounded] = useState<"sm" | "md" | "lg" | "xl" | "full">("xl");
  const [published, setPublished] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [saving, setSaving] = useState(false);

  // Load once
  useEffect(() => {
    const p = q.data?.page;
    if (!p) {
      if (est) {
        setTitle(est.name);
        setLogoUrl(est.logo_url ?? "");
        setPrimary(est.primary_color);
        setAccent(est.accent_color);
      }
      return;
    }
    setTitle(p.title ?? est?.name ?? "");
    setDescription(p.description ?? "");
    setLogoUrl(p.logo_url ?? "");
    setCoverUrl(p.cover_url ?? "");
    const t = (p.theme as Record<string, string>) ?? {};
    setPrimary(t.primary ?? est?.primary_color ?? "#0ea5e9");
    setAccent(t.accent ?? est?.accent_color ?? "#8b5cf6");
    setBackground(t.background ?? "#0b0f19");
    setText(t.text ?? "#ffffff");
    setButtonStyle((t.button_style as any) ?? "solid");
    setRounded((t.rounded as any) ?? "xl");
    setPublished(!!p.published);
    setLinks(
      (q.data?.links ?? []).map((l: any) => ({
        id: l.id, kind: l.kind, label: l.label, url: l.url,
        icon: l.icon, enabled: l.enabled, sort_order: l.sort_order,
      })),
    );
  }, [q.data, est]);

  const publicUrl = est ? `${typeof window !== "undefined" ? window.location.origin : ""}/links/${est.slug}` : "";

  function addLink(kind: LinkKind) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const slug = est?.slug ?? "";
    const prefill =
      kind === "cardapio" && slug ? `${origin}/cardapio/${slug}` :
      kind === "cartao" && slug ? `${origin}/cartao/${slug}` : "";
    setLinks((prev) => [...prev, {
      kind, label: KIND_META[kind].label, url: prefill, enabled: true, sort_order: prev.length,
    }]);
  }
  function updateLink(i: number, patch: Partial<LinkRow>) {
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, sort_order: idx })));
  }
  function move(i: number, dir: -1 | 1) {
    setLinks((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((l, idx) => ({ ...l, sort_order: idx }));
    });
  }

  async function save(publish?: boolean) {
    if (!est) return;
    // basic validation
    for (const [i, l] of links.entries()) {
      if (l.kind === "wifi") {
        const { ssid } = decodeWifi(l.url);
        if (!ssid.trim()) {
          toast.error(`Link #${i + 1} (Wi-Fi): informe o nome da rede (SSID).`);
          return;
        }
      } else if (l.kind === "pix") {
        const { type, key } = decodePix(l.url);
        const check = validatePixKey(type, key);
        if (!check.ok) {
          toast.error(`Link #${i + 1} (Pix · ${PIX_TYPE_LABEL[type]}): ${check.message}`);
          return;
        }
      } else if (!l.label.trim() || !l.url.trim()) {
        toast.error(`Link #${i + 1}: rótulo e URL são obrigatórios.`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await saveFn({
        data: {
          establishment_id: est.id,
          title: title.trim() || null,
          description: description.trim() || null,
          logo_url: logoUrl.trim() || null,
          cover_url: coverUrl.trim() || null,
          theme: { primary, accent, background, text, button_style: buttonStyle, rounded },
          social: {},
          links: links.map((l, i) => ({ ...l, sort_order: i })),
          published: typeof publish === "boolean" ? publish : undefined,
        },
      });
      if (typeof publish === "boolean") setPublished(!!res.published);
      toast.success(publish === true ? "Página publicada!" : publish === false ? "Página despublicada." : "Alterações salvas.");
      q.refetch();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  const previewLinks = useMemo(() => links.filter((l) => l.enabled && l.url.trim()), [links]);

  if (!est) return <div className="p-6 text-muted-foreground">Carregando…</div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 flex flex-wrap items-start justify-between gap-4 bg-background/85 backdrop-blur-md border-b">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Árvore de Links</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sua página pública com todos os links em um só lugar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConfigureQrButton dest="linktree" />
          {published && (
            <>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado!"); }}>
                <Copy className="h-4 w-4 mr-2" /> Copiar link
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={publicUrl} target="_blank" rel="noreferrer"><Eye className="h-4 w-4 mr-2" /> Ver pública</a>
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={() => save()} disabled={saving}>
            {saving ? "Salvando…" : "Salvar rascunho"}
          </Button>
          {published ? (
            <Button variant="destructive" onClick={() => save(false)} disabled={saving}>Despublicar</Button>
          ) : (
            <Button onClick={() => save(true)} disabled={saving}>Publicar</Button>
          )}
        </div>
      </header>


      {/* URL pública sempre visível */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 text-sm">
        <span className={`inline-flex h-2 w-2 rounded-full ${published ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
        <span className="font-medium shrink-0">{published ? "Publicada em:" : "Endereço público (após publicar):"}</span>
        <code className="rounded bg-muted px-2 py-1 text-xs break-all flex-1 min-w-[220px]">{publicUrl}</code>
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado!"); }}>
            <Copy className="h-4 w-4 mr-1.5" /> Copiar
          </Button>
          {published && (
            <Button variant="outline" size="sm" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer"><Eye className="h-4 w-4 mr-1.5" /> Abrir</a>
            </Button>
          )}
        </div>
      </div>


      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Identidade */}
          <Card>
            <CardHeader><CardTitle className="text-base">Identidade</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Título</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
                </div>
                <div>
                  <Label>Logo (URL)</Label>
                  <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} />
              </div>
            </CardContent>
          </Card>

          {/* Tema */}
          <Card>
            <CardHeader><CardTitle className="text-base">Tema</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="mb-2 block">Modelos prontos</Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {THEME_PRESETS.map((p) => {
                    const active =
                      primary.toLowerCase() === p.primary.toLowerCase() &&
                      background.toLowerCase() === p.background.toLowerCase() &&
                      text.toLowerCase() === p.text.toLowerCase();
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPrimary(p.primary);
                          setAccent(p.accent);
                          setBackground(p.background);
                          setText(p.text);
                          setButtonStyle(p.button_style);
                          setRounded(p.rounded);
                        }}
                        className={`group relative overflow-hidden rounded-2xl border-2 p-3 text-left transition ${
                          active ? "border-primary shadow-lg" : "border-border hover:border-primary/40"
                        }`}
                        style={{ background: p.background, color: p.text }}
                      >
                        <div
                          className="mx-auto grid h-10 w-10 place-items-center rounded-xl text-xs font-bold text-white"
                          style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.accent})` }}
                        >
                          Aa
                        </div>
                        <div className="mt-2 space-y-1.5">
                          <div
                            className="h-5 rounded-md text-[9px] font-semibold flex items-center justify-center text-white"
                            style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.accent})` }}
                          >
                            Link
                          </div>
                          <div
                            className="h-5 rounded-md text-[9px] font-semibold flex items-center justify-center"
                            style={{
                              background: p.button_style === "glass" ? "rgba(255,255,255,.1)" : "transparent",
                              border: `1.5px solid ${p.primary}`,
                              color: p.text,
                            }}
                          >
                            Link
                          </div>
                        </div>
                        <p className="mt-2 text-center text-[10px] font-semibold" style={{ color: p.text }}>
                          {p.label}
                        </p>
                        {active && (
                          <span className="absolute right-1.5 top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-bold text-primary-foreground">
                            EM USO
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Escolha um modelo e ajuste as cores abaixo — as alterações aparecem no preview em tempo real.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <ColorField label="Cor primária" value={primary} onChange={setPrimary} />
                <ColorField label="Cor de destaque" value={accent} onChange={setAccent} />
                <ColorField label="Fundo" value={background} onChange={setBackground} />
                <ColorField label="Texto" value={text} onChange={setText} />
                <div>
                  <Label>Estilo do botão</Label>
                  <Select value={buttonStyle} onValueChange={(v) => setButtonStyle(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid">Sólido (gradiente)</SelectItem>
                      <SelectItem value="outline">Contorno</SelectItem>
                      <SelectItem value="glass">Glass</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Borda</Label>
                  <Select value={rounded} onValueChange={(v) => setRounded(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sm">Pequena</SelectItem>
                      <SelectItem value="md">Média</SelectItem>
                      <SelectItem value="lg">Grande</SelectItem>
                      <SelectItem value="xl">Extra</SelectItem>
                      <SelectItem value="full">Pílula</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Links */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Links ({links.length})</CardTitle>
              <div className="flex flex-wrap gap-1">
                {(["cardapio","cartao","whatsapp","instagram","site","google","maps","wifi","pix","custom"] as LinkKind[]).map((k) => {
                  const M = KIND_META[k];
                  return (
                    <Button key={k} size="sm" variant="outline" onClick={() => addLink(k)}>
                      <M.icon className="h-3.5 w-3.5 mr-1" /> {M.label}
                    </Button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {links.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Adicione seu primeiro link acima. <Plus className="inline h-3.5 w-3.5" />
                </p>
              )}
              {links.map((l, i) => {
                const M = KIND_META[l.kind];
                return (
                  <div key={i} className="rounded-lg border p-3 space-y-2 bg-card">
                    <div className="flex items-center gap-2">
                      <M.icon className="h-4 w-4 text-primary shrink-0" />
                      <Select value={l.kind} onValueChange={(v) => updateLink(i, { kind: v as LinkKind })}>
                        <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(KIND_META) as LinkKind[]).map((k) => (
                            <SelectItem key={k} value={k}>{KIND_META[k].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="ml-auto flex items-center gap-1">
                        <Switch checked={l.enabled} onCheckedChange={(v) => updateLink(i, { enabled: !!v })} />
                        <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === links.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => removeLink(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                    {l.kind === "wifi" ? (
                      <WifiFields
                        url={l.url}
                        onChange={(ssid, password) =>
                          updateLink(i, {
                            label: ssid ? `Wi-Fi · ${ssid}` : "Wi-Fi",
                            url: encodeWifi(ssid, password),
                          })
                        }
                      />
                    ) : l.kind === "pix" ? (
                      <PixFields
                        url={l.url}
                        onChange={(type, key, name) =>
                          updateLink(i, {
                            label: name ? `Pix · ${name}` : "Chave Pix",
                            url: encodePix(type, key, name),
                          })
                        }
                      />
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2">
                        <Input placeholder="Rótulo" value={l.label} onChange={(e) => updateLink(i, { label: e.target.value })} maxLength={80} />
                        <Input placeholder={M.placeholder} value={l.url} onChange={(e) => updateLink(i, { url: e.target.value })} maxLength={500} />
                      </div>
                    )}


                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Preview</CardTitle>
              <QrCode className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className="mx-auto max-w-[320px] rounded-3xl overflow-hidden border shadow-lg"
                style={{ background, color: text }}
              >
                {coverUrl && <div className="h-20"><img src={coverUrl} alt="" className="h-full w-full object-cover opacity-60" /></div>}
                <div className="p-5 text-center">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="mx-auto h-16 w-16 rounded-2xl object-cover" />
                  ) : (
                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl text-xl font-bold text-white"
                         style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
                      {(title || est.name)[0]}
                    </div>
                  )}
                  <h3 className="mt-3 font-bold">{title || est.name}</h3>
                  {description && <p className="mt-1 text-xs opacity-80">{description}</p>}
                  <div className="mt-4 space-y-2">
                    {previewLinks.length === 0 && (
                      <p className="text-xs opacity-60">Adicione links para visualizar</p>
                    )}
                    {previewLinks.slice(0, 8).map((l, i) => {
                      const Icon = KIND_META[l.kind].icon;
                      const style: React.CSSProperties =
                        buttonStyle === "outline"
                          ? { border: `2px solid ${primary}`, color: text, background: "transparent" }
                          : buttonStyle === "glass"
                          ? { background: "rgba(255,255,255,0.1)", color: text }
                          : { background: `linear-gradient(135deg, ${primary}, ${accent})`, color: "#fff" };
                      const rClass =
                        rounded === "sm" ? "rounded-md" :
                        rounded === "md" ? "rounded-lg" :
                        rounded === "lg" ? "rounded-xl" :
                        rounded === "full" ? "rounded-full" : "rounded-2xl";
                      return (
                        <div key={i} className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold ${rClass}`} style={style}>
                          <Icon className="h-3.5 w-3.5" />
                          <span className="truncate">{l.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded border bg-transparent"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={20} />
      </div>
    </div>
  );
}

function WifiFields({ url, onChange }: { url: string; onChange: (ssid: string, password: string) => void }) {
  const parsed = decodeWifi(url);
  const [show, setShow] = useState(false);
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <div>
        <Label className="text-xs">Nome da rede (SSID)</Label>
        <Input
          placeholder="Minha_Rede_WiFi"
          value={parsed.ssid}
          onChange={(e) => onChange(e.target.value, parsed.password)}
          maxLength={64}
        />
      </div>
      <div>
        <Label className="text-xs">Senha</Label>
        <div className="flex gap-1">
          <Input
            type={show ? "text" : "password"}
            placeholder="••••••••"
            value={parsed.password}
            onChange={(e) => onChange(parsed.ssid, e.target.value)}
            maxLength={128}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setShow((s) => !s)}>
            {show ? "Ocultar" : "Ver"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PixFields({ url, onChange }: { url: string; onChange: (type: PixKeyType, key: string, name: string) => void }) {
  const parsed = decodePix(url);
  const [touched, setTouched] = useState(false);
  const check = validatePixKey(parsed.type, parsed.key);
  const showError = touched && !check.ok;
  const placeholders: Record<PixKeyType, string> = {
    cpf: "000.000.000-00",
    cnpj: "00.000.000/0000-00",
    email: "pix@dominio.com",
    telefone: "+5511999999999",
    aleatoria: "123e4567-e89b-12d3-a456-426614174000",
  };
  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-3">
        <div>
          <Label className="text-xs">Tipo de chave</Label>
          <Select value={parsed.type} onValueChange={(v) => { setTouched(true); onChange(v as PixKeyType, parsed.key, parsed.name); }}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cpf">CPF</SelectItem>
              <SelectItem value="cnpj">CNPJ</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="telefone">Telefone</SelectItem>
              <SelectItem value="aleatoria">Aleatória</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Chave Pix</Label>
          <Input
            placeholder={placeholders[parsed.type]}
            value={parsed.key}
            onChange={(e) => onChange(parsed.type, e.target.value, parsed.name)}
            onBlur={() => setTouched(true)}
            maxLength={140}
            aria-invalid={showError}
            className={showError ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>
        <div>
          <Label className="text-xs">Beneficiário (opcional)</Label>
          <Input
            placeholder="Nome exibido"
            value={parsed.name}
            onChange={(e) => onChange(parsed.type, parsed.key, e.target.value)}
            maxLength={80}
          />
        </div>
      </div>
      {showError ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {check.message}
        </p>
      ) : parsed.key.trim() ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">Chave {PIX_TYPE_LABEL[parsed.type]} válida.</p>
      ) : (
        <p className="text-xs text-muted-foreground">Preencha a chave no formato de {PIX_TYPE_LABEL[parsed.type]}.</p>
      )}
    </div>
  );
}

