import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import {
  listMyPromotions,
  upsertPromotion,
  deletePromotion,
  getEstablishmentLinks,
  updateEstablishmentLinks,
} from "@/lib/promotions.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Megaphone,
  Plus,
  Image as ImageIcon,
  Video as VideoIcon,
  Link2,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  X,
  ExternalLink,
  Sparkles,
} from "lucide-react";

// ================================================================
// Segment-based promotion templates (created as inactive drafts)
// ================================================================
type PromoTemplate = { title: string; body: string; links?: Link[] };
const DEFAULT_TEMPLATES: PromoTemplate[] = [
  {
    title: "Combo do dia — peça pelo WhatsApp",
    body: "Combo especial válido hoje. Mostre esta promoção no balcão ou peça pelo WhatsApp para garantir.",
  },
  {
    title: "Traga um amigo e ganhe um carimbo extra",
    body: "Venha acompanhado(a) essa semana. Cada amigo novo cadastrado no seu cartão vale +1 carimbo pra você.",
  },
];
const SEGMENT_TEMPLATES: Record<string, PromoTemplate[]> = {
  espetinhos: [
    { title: "Rodízio de espetinhos — sexta e sábado", body: "Escolha 4 espetos + acompanhamento por um valor fixo. Válido só nos dias do rodízio." },
    { title: "Combo casal: 6 espetos + 2 bebidas", body: "Pedido mínimo para 2 pessoas. Retirada ou delivery pelo WhatsApp." },
  ],
  cafeteria: [
    { title: "Café + doce da casa em combo", body: "Todo dia útil, das 14h às 17h. Consulte o sabor do dia no balcão." },
    { title: "Compre 9 cafés, o 10º é por nossa conta", body: "Some carimbos a cada café expresso, cappuccino ou latte pedido no balcão." },
  ],
  barbearia: [
    { title: "Corte + barba com preço fechado", body: "Agende pelo WhatsApp. Válido de terça a quinta, mediante disponibilidade." },
    { title: "Traga um amigo e os dois ganham desconto", body: "Marque horário duplo e cada um leva um valor promocional no combo corte + barba." },
  ],
  petshop: [
    { title: "Banho + tosa higiênica com desconto", body: "Agende pelo WhatsApp. Válido para cães de pequeno e médio porte." },
    { title: "Leve 3 latinhas, pague 2", body: "Promoção válida enquanto durarem os estoques. Consulte marcas participantes." },
  ],
  lavajato: [
    { title: "Lavagem completa + cera de brinde", body: "Válido para carros de passeio. Agende horário pelo WhatsApp e evite fila." },
    { title: "Combo lavagem simples 2x na semana", body: "Duas lavagens simples pelo preço de uma e meia. Válido para o mesmo veículo em 7 dias." },
  ],
  salao: [
    { title: "Escova + hidratação com valor especial", body: "Terça e quarta, mediante agendamento. Cabelos até a cintura." },
    { title: "Indique uma amiga e ganhe R$20 no próximo serviço", body: "Sua amiga também ganha desconto na primeira visita. Combine com o atendente." },
  ],
  restaurante: [
    { title: "Prato executivo do dia", body: "De segunda a sexta, no almoço. Consulte o cardápio do dia no WhatsApp." },
    { title: "Combo família: 4 pratos + refrigerante 2L", body: "Retirada ou delivery. Peça com 40 minutos de antecedência." },
  ],
  oficina: [
    { title: "Revisão preventiva com check-list de 20 itens", body: "Agende pelo WhatsApp. Diagnóstico gratuito e orçamento antes de qualquer serviço." },
    { title: "Troca de óleo com filtro incluso", body: "Marcas parceiras. Consulte disponibilidade para o modelo do seu carro." },
  ],
  loja: [
    { title: "Frete grátis acima de R$150", body: "Válido para entregas na cidade. Combine a retirada pelo WhatsApp para retirar na hora." },
    { title: "Compre 2, leve 3 em peças selecionadas", body: "Arara promocional na loja. Enquanto durarem os estoques." },
  ],
  outro: DEFAULT_TEMPLATES,
};
function normalizeSegment(seg: string | null | undefined): string {
  const s = (seg ?? "").toString().trim().toLowerCase();
  if (!s) return "outro";
  return SEGMENT_TEMPLATES[s] ? s : "outro";
}
function templatesForSegment(seg: string | null | undefined): PromoTemplate[] {
  return SEGMENT_TEMPLATES[normalizeSegment(seg)] ?? DEFAULT_TEMPLATES;
}

// ================================================================
// Default fixed-link presets (pre-filled when merchant has none saved)
// ================================================================
function normalizeUrl(u: string | null | undefined): string | null {
  const v = (u ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}
function onlyDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D+/g, "");
}
type EstLinkSource = {
  whatsapp?: string | null;
  phone?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  website?: string | null;
  google_maps_url?: string | null;
};
function suggestFixedLinks(e: EstLinkSource | null | undefined): Link[] {
  const out: Link[] = [];
  const wa = onlyDigits(e?.whatsapp ?? e?.phone ?? "");
  if (wa) out.push({ label: "WhatsApp", url: `https://wa.me/${wa.startsWith("55") ? wa : `55${wa}`}` });
  const ig = (e?.instagram ?? "").trim().replace(/^@/, "");
  if (ig) out.push({ label: "Instagram", url: ig.startsWith("http") ? ig : `https://instagram.com/${ig}` });
  const site = normalizeUrl(e?.website);
  if (site) out.push({ label: "Site", url: site });
  const maps = normalizeUrl(e?.google_maps_url);
  if (maps) out.push({ label: "Como chegar", url: maps });
  const fb = normalizeUrl(e?.facebook);
  if (fb) out.push({ label: "Facebook", url: fb });
  const tk = (e?.tiktok ?? "").trim().replace(/^@/, "");
  if (tk) out.push({ label: "TikTok", url: tk.startsWith("http") ? tk : `https://tiktok.com/@${tk}` });
  // Sempre sugerir slots comuns se ainda faltar espaço
  if (out.length === 0) {
    out.push({ label: "WhatsApp", url: "https://wa.me/55" });
    out.push({ label: "Cardápio", url: "https://" });
    out.push({ label: "Instagram", url: "https://instagram.com/" });
  }
  return out.slice(0, 10);
}

export const Route = createFileRoute("/_authenticated/app/promocoes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Promoções — Fidelize" },
      { name: "description", content: "Crie promoções com fotos, vídeos e links para seus clientes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PromocoesPage,
});

type Link = { label: string; url: string };
type Media = { path: string; type: "image" | "video"; url?: string | null };
type Promotion = {
  id: string;
  establishment_id: string;
  title: string;
  body: string | null;
  media: Media[];
  external_links: Link[];
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

const MAX_MEDIA = 5;
const MAX_LINKS = 10;
const MAX_FILE_MB = 25;

function PromocoesPage() {
  const qc = useQueryClient();
  const getEsts = useServerFn(getMyEstablishments);
  const listFn = useServerFn(listMyPromotions);
  const upsertFn = useServerFn(upsertPromotion);
  const deleteFn = useServerFn(deletePromotion);
  const getLinksFn = useServerFn(getEstablishmentLinks);
  const updLinksFn = useServerFn(updateEstablishmentLinks);

  const { data: memberships } = useQuery({
    queryKey: ["memberships"],
    queryFn: () => getEsts(),
  });
  const activeEst = memberships?.[0]?.establishment as
    | ({
        id: string;
        name: string;
        slug: string;
        segment?: string | null;
      } & EstLinkSource)
    | undefined;

  const promosQ = useQuery({
    queryKey: ["promotions", activeEst?.id],
    enabled: !!activeEst?.id,
    queryFn: () => listFn({ data: { establishment_id: activeEst!.id } }),
  });

  const linksQ = useQuery({
    queryKey: ["est_links", activeEst?.id],
    enabled: !!activeEst?.id,
    queryFn: () => getLinksFn({ data: { establishment_id: activeEst!.id } }),
  });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [linksOpen, setLinksOpen] = useState(false);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }
  function openEdit(p: Promotion) {
    setEditing(p);
    setEditorOpen(true);
  }

  const delM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Promoção excluída.");
      qc.invalidateQueries({ queryKey: ["promotions", activeEst?.id] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
  });

  const seedM = useMutation({
    mutationFn: async () => {
      if (!activeEst) throw new Error("Sem estabelecimento");
      const fixedLinks = (linksQ.data ?? []) as Link[];
      const tpls = templatesForSegment(activeEst.segment);
      for (const t of tpls.slice(0, 2)) {
        await upsertFn({
          data: {
            establishment_id: activeEst.id,
            title: t.title,
            body: t.body,
            media: [],
            external_links: (t.links ?? fixedLinks).slice(0, 10),
            active: false,
            starts_at: null,
            ends_at: null,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("2 modelos criados como rascunho. Edite e ative quando quiser.");
      qc.invalidateQueries({ queryKey: ["promotions", activeEst?.id] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao criar modelos"),
  });

  if (!activeEst) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Você ainda não tem um estabelecimento vinculado.
      </div>
    );
  }

  const promos = (promosQ.data ?? []) as unknown as Promotion[];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Megaphone className="h-5 w-5" />
            <h1 className="font-display text-2xl font-bold tracking-tight">Promoções</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Publique promoções com fotos, vídeos e links. Aparecem na página da sua empresa
            para todo cliente que abrir sua ficha em <strong>Descobrir</strong> e na aba{" "}
            <strong>Minhas promoções</strong> da carteira.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => seedM.mutate()}
            disabled={seedM.isPending}
            title="Cria 2 modelos como rascunho baseados no ramo da sua empresa"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {seedM.isPending ? "Criando…" : "Usar modelos"}
          </Button>
          <Button variant="outline" onClick={() => setLinksOpen(true)}>
            <Link2 className="mr-2 h-4 w-4" /> Links fixos
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nova promoção
          </Button>
        </div>
      </header>

      {promosQ.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl border border-border/60 bg-card/30" />
          ))}
        </div>
      ) : promos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/60 bg-card/30 p-10 text-center">
          <Megaphone className="mx-auto mb-3 h-8 w-8 text-primary" />
          <div className="font-display text-lg font-bold">Nenhuma promoção ainda</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie sua primeira promoção com foto, vídeo e link do seu cardápio, WhatsApp ou site.
          </p>
          <Button onClick={openCreate} className="mt-4">
            <Plus className="mr-2 h-4 w-4" /> Criar promoção
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {promos.map((p) => (
            <li
              key={p.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/40 transition hover:border-primary/40"
            >
              <div className="relative h-40 w-full bg-muted">
                {p.media?.[0]?.url ? (
                  p.media[0].type === "video" ? (
                    <video
                      src={p.media[0].url}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <img src={p.media[0].url} alt="" className="h-full w-full object-cover" />
                  )
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
                <span
                  className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                    p.active
                      ? "bg-emerald-500/90 text-white"
                      : "bg-muted-foreground/60 text-white"
                  }`}
                >
                  {p.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {p.active ? "Ativa" : "Rascunho"}
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
                <div className="line-clamp-1 font-display text-sm font-bold">{p.title}</div>
                {p.body && (
                  <div className="line-clamp-2 text-xs text-muted-foreground">{p.body}</div>
                )}
                <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                  {p.media.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                      <ImageIcon className="h-3 w-3" />
                      {p.media.length} mídia{p.media.length > 1 ? "s" : ""}
                    </span>
                  )}
                  {p.external_links.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                      <Link2 className="h-3 w-3" /> {p.external_links.length} link
                      {p.external_links.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="mt-auto flex justify-end gap-1 pt-2">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Excluir "${p.title}"?`)) delM.mutate(p.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PromotionEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        promo={editing}
        establishmentId={activeEst.id}
        upsertFn={upsertFn}
        onSaved={() => {
          setEditorOpen(false);
          qc.invalidateQueries({ queryKey: ["promotions", activeEst.id] });
        }}
      />

      <GlobalLinksDialog
        open={linksOpen}
        onOpenChange={setLinksOpen}
        establishmentId={activeEst.id}
        initial={linksQ.data ?? []}
        save={async (links) => {
          await updLinksFn({
            data: { establishment_id: activeEst.id, external_links: links },
          });
          qc.invalidateQueries({ queryKey: ["est_links", activeEst.id] });
        }}
      />
    </div>
  );
}

// ================================================================
// Promotion editor
// ================================================================

function PromotionEditor({
  open,
  onOpenChange,
  promo,
  establishmentId,
  upsertFn,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  promo: Promotion | null;
  establishmentId: string;
  upsertFn: (args: { data: unknown }) => Promise<{ id: string }>;
  onSaved: () => void;
}) {
  const initial = useMemo(
    () => ({
      title: promo?.title ?? "",
      body: promo?.body ?? "",
      media: (promo?.media ?? []) as Media[],
      links: (promo?.external_links ?? []) as Link[],
      active: promo?.active ?? true,
      starts_at: promo?.starts_at ?? "",
      ends_at: promo?.ends_at ?? "",
    }),
    [promo],
  );

  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [media, setMedia] = useState<Media[]>(initial.media);
  const [links, setLinks] = useState<Link[]>(initial.links);
  const [active, setActive] = useState(initial.active);
  const [startsAt, setStartsAt] = useState(initial.starts_at ? initial.starts_at.slice(0, 16) : "");
  const [endsAt, setEndsAt] = useState(initial.ends_at ? initial.ends_at.slice(0, 16) : "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset when reopening for another promo
  useMemo(() => {
    setTitle(initial.title);
    setBody(initial.body);
    setMedia(initial.media);
    setLinks(initial.links);
    setActive(initial.active);
    setStartsAt(initial.starts_at ? initial.starts_at.slice(0, 16) : "");
    setEndsAt(initial.ends_at ? initial.ends_at.slice(0, 16) : "");
  }, [initial]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (media.length >= MAX_MEDIA) {
      toast.error(`Máximo de ${MAX_MEDIA} mídias por promoção.`);
      return;
    }
    setUploading(true);
    try {
      const next: Media[] = [...media];
      for (const file of Array.from(files)) {
        if (next.length >= MAX_MEDIA) break;
        const mb = file.size / (1024 * 1024);
        if (mb > MAX_FILE_MB) {
          toast.error(`${file.name} excede ${MAX_FILE_MB}MB.`);
          continue;
        }
        const kind: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
        const ext = file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg");
        const path = `${establishmentId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("promotions")
          .upload(path, file, { contentType: file.type, cacheControl: "3600" });
        if (error) {
          toast.error(`Falha ao enviar ${file.name}: ${error.message}`);
          continue;
        }
        const { data: signed } = await supabase.storage
          .from("promotions")
          .createSignedUrl(path, 60 * 60 * 24 * 7);
        next.push({ path, type: kind, url: signed?.signedUrl ?? null });
      }
      setMedia(next);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeMedia(idx: number) {
    const m = media[idx];
    setMedia(media.filter((_, i) => i !== idx));
    if (m?.path) {
      // Best-effort cleanup — if promo not yet saved, file is orphaned.
      try {
        await supabase.storage.from("promotions").remove([m.path]);
      } catch {
        /* ignore */
      }
    }
  }

  function addLink() {
    if (links.length >= MAX_LINKS) return;
    setLinks([...links, { label: "", url: "" }]);
  }

  async function save() {
    if (!title.trim()) {
      toast.error("Dê um título para a promoção.");
      return;
    }
    // Validate links
    for (const l of links) {
      if (!l.label.trim() || !l.url.trim()) {
        toast.error("Todos os links precisam de rótulo e URL.");
        return;
      }
      try {
        new URL(l.url);
      } catch {
        toast.error(`URL inválida: ${l.url}`);
        return;
      }
    }
    setSaving(true);
    try {
      await upsertFn({
        data: {
          id: promo?.id,
          establishment_id: establishmentId,
          title: title.trim(),
          body: body.trim() || null,
          media: media.map((m) => ({ path: m.path, type: m.type })),
          external_links: links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
          active,
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        },
      });
      toast.success(promo ? "Promoção atualizada." : "Promoção criada.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{promo ? "Editar promoção" : "Nova promoção"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Ex.: Combo dobrado no fim de semana"
            />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Explique a promoção, regras, validade…"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>Mídias ({media.length}/{MAX_MEDIA})</Label>
              <span className="text-[10px] text-muted-foreground">
                Fotos e vídeos, até {MAX_FILE_MB}MB cada
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {media.map((m, i) => (
                <div
                  key={m.path}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted"
                >
                  {m.type === "video" ? (
                    <video src={m.url ?? undefined} className="h-full w-full object-cover" muted />
                  ) : (
                    <img
                      src={m.url ?? undefined}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(i)}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                    aria-label="Remover mídia"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">
                    {m.type === "video" ? (
                      <VideoIcon className="h-2.5 w-2.5" />
                    ) : (
                      <ImageIcon className="h-2.5 w-2.5" />
                    )}
                    {m.type}
                  </span>
                </div>
              ))}
              {media.length < MAX_MEDIA && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="grid aspect-square place-items-center rounded-xl border border-dashed border-border/60 bg-muted/30 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-primary disabled:opacity-50"
                >
                  {uploading ? "Enviando…" : <><Plus className="mr-1 h-4 w-4" />Adicionar</>}
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>Links desta promoção ({links.length}/{MAX_LINKS})</Label>
              <Button type="button" size="sm" variant="ghost" onClick={addLink}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Link
              </Button>
            </div>
            <div className="space-y-2">
              {links.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
                  <Input
                    value={l.label}
                    onChange={(e) => {
                      const copy = [...links];
                      copy[i] = { ...copy[i], label: e.target.value };
                      setLinks(copy);
                    }}
                    placeholder="Rótulo (ex: Cardápio)"
                    maxLength={40}
                  />
                  <Input
                    value={l.url}
                    onChange={(e) => {
                      const copy = [...links];
                      copy[i] = { ...copy[i], url: e.target.value };
                      setLinks(copy);
                    }}
                    placeholder="https://…"
                    type="url"
                    maxLength={500}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setLinks(links.filter((_, k) => k !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {links.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Adicione até {MAX_LINKS} botões (ex.: WhatsApp, cardápio, cupom).
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Início (opcional)</Label>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div>
              <Label>Fim (opcional)</Label>
              <Input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 p-3">
            <div>
              <div className="text-sm font-semibold">Publicada</div>
              <div className="text-xs text-muted-foreground">
                Se desligada, fica como rascunho e não aparece para clientes.
              </div>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || uploading}>
            {saving ? "Salvando…" : promo ? "Salvar alterações" : "Publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ================================================================
// Global links dialog
// ================================================================

function GlobalLinksDialog({
  open,
  onOpenChange,
  initial,
  save,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  establishmentId: string;
  initial: Link[];
  save: (links: Link[]) => Promise<void>;
}) {
  const [links, setLinks] = useState<Link[]>(initial);
  const [busy, setBusy] = useState(false);

  useMemo(() => setLinks(initial), [initial]);

  async function commit() {
    for (const l of links) {
      if (!l.label.trim() || !l.url.trim()) {
        toast.error("Todos os links precisam de rótulo e URL.");
        return;
      }
      try {
        new URL(l.url);
      } catch {
        toast.error(`URL inválida: ${l.url}`);
        return;
      }
    }
    setBusy(true);
    try {
      await save(
        links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
      );
      toast.success("Links atualizados.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Links fixos da empresa</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Aparecem em <strong>todas</strong> as promoções e na página pública. Use para
          Instagram, cardápio, WhatsApp, site…
        </p>
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
              <Input
                value={l.label}
                maxLength={40}
                onChange={(e) => {
                  const copy = [...links];
                  copy[i] = { ...copy[i], label: e.target.value };
                  setLinks(copy);
                }}
                placeholder="Rótulo"
              />
              <Input
                value={l.url}
                maxLength={500}
                type="url"
                onChange={(e) => {
                  const copy = [...links];
                  copy[i] = { ...copy[i], url: e.target.value };
                  setLinks(copy);
                }}
                placeholder="https://…"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setLinks(links.filter((_, k) => k !== i))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {links.length < MAX_LINKS && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLinks([...links, { label: "", url: "" }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar link
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={commit} disabled={busy}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
