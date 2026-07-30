import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Megaphone,
  Sparkles,
  Upload,
  Clock,
  MousePointerClick,
  Eye,
  Play,
  Pause,
  QrCode,
  ShieldCheck,
  Loader2,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RouteLoading } from "@/components/RouteLoading";
import {
  getAdsWorkspace,
  saveAdCampaign,
  submitAdCampaign,
  cancelAdCampaign,
  toggleAdPause,
  createAdPixOrder,
  getAdOrderStatus,
  getAdCreativeUploadPath,
} from "@/lib/sponsored-ads.functions";
import {
  AD_DESCRIPTION_MAX,
  AD_IMAGE_MAX_BYTES,
  AD_IMAGE_MIME,
  AD_STATUS_META,
  AD_TITLE_MAX,
  CTA_LABELS,
  DESTINATION_META,
  DESTINATION_TYPES,
  ctr,
  daysRemaining,
  formatCents,
  isEditable,
  type AdStatus,
  type CtaLabel,
  type DestinationType,
} from "@/lib/sponsored-ads-core";
import { DISCOVER_CATEGORIES, categorizeEstablishment } from "@/lib/discover-categories";

export const Route = createFileRoute("/_authenticated/app/anuncios")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Anúncios em destaque — Fidelize" },
      { name: "description", content: "Destaque seu estabelecimento na vitrine Descobrir da carteira Fidelize." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdsPage,
  pendingComponent: () => <RouteLoading label="Carregando anúncios…" fullscreen={false} />,
});

const TONE_CLASS: Record<string, string> = {
  neutral: "border-border/60 bg-muted/40 text-muted-foreground",
  info: "border-primary/40 bg-primary/10 text-primary",
  warn: "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  success: "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  danger: "border-destructive/50 bg-destructive/10 text-destructive",
};

function StatusPill({ status }: { status: AdStatus }) {
  const meta = AD_STATUS_META[status] ?? AD_STATUS_META.draft;
  return (
    <span
      title={meta.hint}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${TONE_CLASS[meta.tone]}`}
    >
      {meta.label}
    </span>
  );
}

function AdsPage() {
  const qc = useQueryClient();
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);

  // O layout /app já garante o vínculo; buscamos o estabelecimento ativo.
  const membership = useQuery({
    queryKey: ["ads-active-establishment"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("establishment_members")
        .select("establishment_id")
        .eq("user_id", auth.user.id)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      const id = data?.establishment_id ?? null;
      setEstablishmentId(id);
      return id;
    },
    staleTime: 5 * 60_000,
  });

  const workspaceFn = useServerFn(getAdsWorkspace);
  const workspace = useQuery({
    queryKey: ["ads-workspace", establishmentId],
    queryFn: () => workspaceFn({ data: { establishment_id: establishmentId! } }),
    enabled: !!establishmentId,
  });

  if (membership.isLoading || workspace.isLoading) {
    return <RouteLoading label="Carregando anúncios…" fullscreen={false} />;
  }
  if (workspace.error) {
    return (
      <div className="rounded-3xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        {(workspace.error as Error).message}
      </div>
    );
  }

  const ws = workspace.data;
  if (!ws || !establishmentId) return null;

  return (
    <AdsWorkspace
      establishmentId={establishmentId}
      data={ws}
      onRefresh={() => qc.invalidateQueries({ queryKey: ["ads-workspace", establishmentId] })}
    />
  );
}

type Workspace = Awaited<ReturnType<typeof getAdsWorkspace>>;

function AdsWorkspace({
  establishmentId,
  data,
  onRefresh,
}: {
  establishmentId: string;
  data: Workspace;
  onRefresh: () => void;
}) {
  const est = data.establishment as any;
  const suggestedCategory = useMemo(
    () => (est ? categorizeEstablishment(est) : "outros"),
    [est],
  );

  const drafts = data.campaigns.filter((c: any) => isEditable(c.status));
  const running = data.campaigns.filter((c: any) => !isEditable(c.status));

  const [editing, setEditing] = useState<any | null>(null);

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-transparent to-transparent p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start gap-3">
          <div className="card-icon">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold tracking-tight">Anúncios em destaque</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Apareça no topo da vitrine <strong>Descobrir</strong> da carteira, marcado como “Patrocinado”, para
              clientes que ainda não conhecem seu estabelecimento. Você escolhe o período, envia o criativo, nossa
              equipe aprova e o pagamento é por PIX.
            </p>
          </div>
          <button
            onClick={() => setEditing({ __new: true })}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-transform active:scale-95"
          >
            <Sparkles className="h-4 w-4" /> Criar destaque
          </button>
        </div>
      </header>

      {data.packages.length === 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          Nenhum pacote de destaque está disponível no momento. Tente novamente em breve.
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        {data.packages.map((p: any) => (
          <div key={p.id} className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="font-display text-sm font-bold">{p.name}</div>
            <div className="metric-number mt-1 text-2xl">{formatCents(p.price_cents, p.currency)}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> {p.duration_days} dias na vitrine
            </div>
            {p.description && <p className="mt-2 text-xs text-muted-foreground">{p.description}</p>}
          </div>
        ))}
      </section>

      {drafts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Em preparação</h2>
          {drafts.map((c: any) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              establishmentId={establishmentId}
              metrics={data.metrics[c.id]}
              settings={data.settings}
              onEdit={() => setEditing(c)}
              onRefresh={onRefresh}
            />
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Suas campanhas</h2>
        {running.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/60 bg-card/30 p-8 text-center">
            <Megaphone className="mx-auto mb-2 h-6 w-6 text-primary" />
            <div className="font-display text-sm font-bold">Nenhuma campanha ainda</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Crie seu primeiro destaque e alcance clientes novos na sua região.
            </p>
          </div>
        ) : (
          running.map((c: any) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              establishmentId={establishmentId}
              metrics={data.metrics[c.id]}
              settings={data.settings}
              onEdit={() => setEditing(c)}
              onRefresh={onRefresh}
            />
          ))
        )}
      </section>

      {editing && (
        <CampaignEditor
          establishmentId={establishmentId}
          establishment={est}
          packages={data.packages}
          settings={data.settings}
          suggestedCategory={suggestedCategory}
          campaign={editing.__new ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function CampaignCard({
  campaign,
  establishmentId,
  metrics,
  settings,
  onEdit,
  onRefresh,
}: {
  campaign: any;
  establishmentId: string;
  metrics?: { impressions: number; clicks: number };
  settings: any;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  const status = campaign.status as AdStatus;
  const impressions = metrics?.impressions ?? 0;
  const clicks = metrics?.clicks ?? 0;

  const submitFn = useServerFn(submitAdCampaign);
  const cancelFn = useServerFn(cancelAdCampaign);
  const pauseFn = useServerFn(toggleAdPause);
  const pixFn = useServerFn(createAdPixOrder);
  const orderStatusFn = useServerFn(getAdOrderStatus);

  const [pix, setPix] = useState<any | null>(null);
  const [terms, setTerms] = useState(false);

  const submit = useMutation({
    mutationFn: () => submitFn({ data: { establishment_id: establishmentId, campaign_id: campaign.id, accept_terms: true } }),
    onSuccess: () => {
      toast.success("Anúncio enviado para análise.");
      onRefresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => cancelFn({ data: { establishment_id: establishmentId, campaign_id: campaign.id } }),
    onSuccess: () => {
      toast.success("Campanha cancelada.");
      onRefresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pause = useMutation({
    mutationFn: (p: boolean) => pauseFn({ data: { establishment_id: establishmentId, campaign_id: campaign.id, pause: p } }),
    onSuccess: () => onRefresh(),
    onError: (e: Error) => toast.error(e.message),
  });

  const pay = useMutation({
    mutationFn: () => pixFn({ data: { establishment_id: establishmentId, campaign_id: campaign.id } }),
    onSuccess: (r) => setPix(r),
    onError: (e: Error) => toast.error(e.message),
  });

  const check = useMutation({
    mutationFn: () => orderStatusFn({ data: { establishment_id: establishmentId, order_id: pix.order_id } }),
    onSuccess: (r: any) => {
      if (r.status === "paid") {
        toast.success("Pagamento confirmado! Seu destaque está no ar.");
        setPix(null);
        onRefresh();
      } else {
        toast.info("Ainda não identificamos o pagamento. Aguarde alguns instantes.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <article className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
      <div className="flex items-start gap-3 p-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-background">
          {campaign.image_url ? (
            <img src={campaign.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Megaphone className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-sm font-bold">{campaign.title || "Sem título"}</h3>
            <StatusPill status={status} />
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{campaign.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> {impressions} exibições
            </span>
            <span className="inline-flex items-center gap-1">
              <MousePointerClick className="h-3.5 w-3.5" /> {clicks} cliques
            </span>
            <span>CTR {ctr(impressions, clicks)}%</span>
            {campaign.ends_at && status === "active" && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {daysRemaining(campaign.ends_at)} dias restantes
              </span>
            )}
            {campaign.price_cents_snapshot != null && (
              <span>{formatCents(campaign.price_cents_snapshot, campaign.currency_snapshot ?? "BRL")}</span>
            )}
          </div>
        </div>
      </div>

      {campaign.changes_requested_reason && (
        <p className="mx-4 mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <strong>Ajuste solicitado:</strong> {campaign.changes_requested_reason}
        </p>
      )}
      {campaign.rejection_reason && (
        <p className="mx-4 mb-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <strong>Rejeitado:</strong> {campaign.rejection_reason}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border/40 px-4 py-3">
        {isEditable(status) && (
          <>
            <button
              onClick={onEdit}
              className="rounded-xl border border-border/60 px-3 py-1.5 text-xs font-bold transition-colors hover:border-primary/40"
            >
              Editar criativo
            </button>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
              Li e aceito os termos do anunciante
            </label>
            <button
              disabled={!terms || submit.isPending}
              onClick={() => submit.mutate()}
              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              {submit.isPending ? "Enviando…" : "Enviar para análise"}
            </button>
            <button
              onClick={() => cancel.mutate()}
              className="rounded-xl border border-border/60 px-3 py-1.5 text-xs font-bold text-muted-foreground"
            >
              Descartar
            </button>
          </>
        )}

        {(status === "approved_awaiting_payment" || status === "payment_pending") && !campaign.is_courtesy && (
          <button
            disabled={pay.isPending}
            onClick={() => pay.mutate()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {pay.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
            Pagar com PIX
          </button>
        )}

        {status === "active" && settings?.allow_self_pause && (
          <button
            onClick={() => pause.mutate(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-1.5 text-xs font-bold"
          >
            <Pause className="h-3.5 w-3.5" /> Pausar
          </button>
        )}
        {status === "paused" && (
          <button
            onClick={() => pause.mutate(false)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
          >
            <Play className="h-3.5 w-3.5" /> Retomar
          </button>
        )}
      </div>

      {pix && (
        <div className="border-t border-border/40 bg-background/60 p-4">
          <div className="text-xs font-bold">Pague com PIX para publicar</div>
          {pix.pix_qr_code && (
            <img
              src={`data:image/png;base64,${pix.pix_qr_code}`}
              alt="QR Code PIX"
              className="mt-2 h-40 w-40 rounded-xl border border-border/60 bg-white p-2"
            />
          )}
          {pix.pix_code && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(pix.pix_code);
                toast.success("Código PIX copiado.");
              }}
              className="mt-2 w-full truncate rounded-xl border border-border/60 px-3 py-2 text-left text-[11px] font-mono"
            >
              {pix.pix_code}
            </button>
          )}
          <button
            onClick={() => check.mutate()}
            disabled={check.isPending}
            className="mt-2 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {check.isPending ? "Verificando…" : "Já paguei"}
          </button>
        </div>
      )}
    </article>
  );
}

function CampaignEditor({
  establishmentId,
  establishment,
  packages,
  settings,
  suggestedCategory,
  campaign,
  onClose,
  onSaved,
}: {
  establishmentId: string;
  establishment: any;
  packages: any[];
  settings: any;
  suggestedCategory: string;
  campaign: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const allowed: string[] = settings?.allowed_categories ?? [];
  const categories = DISCOVER_CATEGORIES.filter((c) => !allowed.length || allowed.includes(c.id));

  const [packageId, setPackageId] = useState<string>(campaign?.package_id ?? packages[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState<string>(campaign?.category_id ?? suggestedCategory);
  const [title, setTitle] = useState<string>(campaign?.title ?? establishment?.name ?? "");
  const [description, setDescription] = useState<string>(campaign?.description ?? establishment?.description ?? "");
  const [cta, setCta] = useState<CtaLabel>((campaign?.cta_label as CtaLabel) ?? CTA_LABELS[0]);
  const [destination, setDestination] = useState<DestinationType>(
    (campaign?.destination_type as DestinationType) ?? "establishment",
  );
  const [imagePath, setImagePath] = useState<string | null>(campaign?.image_path ?? null);
  const [imagePreview, setImagePreview] = useState<string | null>(campaign?.image_url ?? null);
  const [uploading, setUploading] = useState(false);

  const uploadPathFn = useServerFn(getAdCreativeUploadPath);
  const saveFn = useServerFn(saveAdCampaign);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          establishment_id: establishmentId,
          id: campaign?.id,
          package_id: packageId,
          category_id: categoryId,
          title,
          description,
          cta_label: cta,
          destination_type: destination,
          destination_slug: establishment?.slug ?? "",
          image_path: imagePath,
          image_source: imagePath ? "upload" : "logo",
        },
      }),
    onSuccess: () => {
      toast.success("Criativo salvo.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleUpload(file: File) {
    if (!AD_IMAGE_MIME.includes(file.type as any)) {
      toast.error("Use uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > AD_IMAGE_MAX_BYTES) {
      toast.error("A imagem precisa ter no máximo 3 MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const { path } = await uploadPathFn({ data: { establishment_id: establishmentId, extension: ext } });
      const { error } = await supabase.storage.from("sponsored-ads").upload(path, file, { upsert: true });
      if (error) throw new Error(error.message);
      setImagePath(path);
      setImagePreview(URL.createObjectURL(file));
      toast.success("Imagem enviada.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const pkg = packages.find((p) => p.id === packageId);
  const category = DISCOVER_CATEGORIES.find((c) => c.id === categoryId);

  const [step, setStep] = useState(0);
  const steps = [
    { key: "pacote", label: "Pacote", hint: "Por quantos dias seu destaque fica no ar" },
    { key: "criativo", label: "Criativo", hint: "O que o cliente lê no card" },
    { key: "publico", label: "Público & destino", hint: "Onde aparece e para onde leva" },
    { key: "revisao", label: "Revisão", hint: "Confira e salve" },
  ];

  const stepValid = [
    !!packageId,
    title.trim().length >= 3,
    !!categoryId,
    !!packageId && title.trim().length >= 3,
  ];

  const previewImage = imagePreview ?? establishment?.logo_url ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-0 backdrop-blur-md sm:items-center sm:p-6">
      <div className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-primary/25 bg-card shadow-2xl sm:rounded-3xl">
        {/* Cabeçalho premium */}
        <div className="relative overflow-hidden border-b border-border/50 bg-gradient-to-br from-primary/12 via-transparent to-transparent px-5 py-4">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <div className="card-icon">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-bold tracking-tight">
                {campaign ? "Editar destaque" : "Novo destaque"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Em 4 passos rápidos seu estabelecimento aparece no topo da vitrine <strong>Descobrir</strong>.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border border-border/60 px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              Fechar
            </button>
          </div>

          {/* Stepper */}
          <div className="relative mt-4 grid gap-2 sm:grid-cols-4">
            {steps.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <button
                  key={s.key}
                  onClick={() => setStep(i)}
                  className={`rounded-2xl border px-3 py-2 text-left transition-all ${
                    active
                      ? "border-primary bg-primary/10 shadow-sm"
                      : done
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/60 bg-background/40 hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black ${
                        active || done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span className="truncate text-xs font-bold">{s.label}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{s.hint}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid flex-1 gap-0 overflow-y-auto lg:grid-cols-[1fr_320px]">
          {/* Conteúdo da etapa */}
          <div className="space-y-4 p-5">
            {step === 0 && (
              <div className="space-y-3">
                <StepIntro
                  title="Escolha por quanto tempo quer aparecer"
                  text="Períodos maiores costumam render mais visitas porque o cliente vê o seu card em dias diferentes. Você só paga depois da aprovação, via PIX."
                />
                <div className="grid gap-2 sm:grid-cols-3">
                  {packages.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPackageId(p.id)}
                      className={`rounded-2xl border p-4 text-left transition-all ${
                        packageId === p.id
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border/60 hover:border-primary/40"
                      }`}
                    >
                      <div className="text-xs font-bold">{p.name}</div>
                      <div className="metric-number mt-1 text-xl">{formatCents(p.price_cents, p.currency)}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" /> {p.duration_days} dias no ar
                      </div>
                      {p.description && <p className="mt-2 text-[11px] text-muted-foreground">{p.description}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <StepIntro
                  title="Escreva o que convence em 3 segundos"
                  text="O cliente decide olhando título, foto e uma frase. Fale de um benefício claro (brinde, desconto, novidade) em vez de descrever o negócio."
                />
                <div>
                  <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                    Título ({title.length}/{AD_TITLE_MAX})
                  </label>
                  <input
                    value={title}
                    maxLength={AD_TITLE_MAX}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                    placeholder="Ex.: Café artesanal com 1º carimbo em dobro"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Dica: comece pelo benefício, não pelo nome.</p>
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                    Descrição ({description.length}/{AD_DESCRIPTION_MAX})
                  </label>
                  <textarea
                    value={description}
                    maxLength={AD_DESCRIPTION_MAX}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                    placeholder="Uma frase curta contando por que vale a visita."
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Imagem</label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border border-border/60 bg-background">
                      {previewImage ? (
                        <img src={previewImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Megaphone className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-xs font-bold transition-colors hover:border-primary/40">
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {uploading ? "Enviando…" : "Enviar imagem"}
                      <input
                        type="file"
                        accept={AD_IMAGE_MIME.join(",")}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleUpload(f);
                        }}
                      />
                    </label>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Sem imagem própria usamos a logo do seu estabelecimento. JPG, PNG ou WebP até 3 MB — prefira foto
                    horizontal, bem iluminada e sem textos pequenos.
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <StepIntro
                  title="Defina onde você aparece e o que acontece no clique"
                  text="A categoria posiciona seu card na vitrine certa. O destino é sempre uma página do seu próprio estabelecimento."
                />
                <div>
                  <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                    Categoria na vitrine
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.label}
                      </option>
                    ))}
                  </select>
                  {categoryId === suggestedCategory && (
                    <p className="mt-1 text-[11px] text-muted-foreground">Sugerimos esta com base no seu perfil.</p>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                      Texto do botão
                    </label>
                    <select
                      value={cta}
                      onChange={(e) => setCta(e.target.value as CtaLabel)}
                      className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                    >
                      {CTA_LABELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                      Destino do clique
                    </label>
                    <select
                      value={destination}
                      onChange={(e) => setDestination(e.target.value as DestinationType)}
                      className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                    >
                      {DESTINATION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {DESTINATION_META[t].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <StepIntro
                  title="Confira antes de enviar"
                  text="Salve o criativo e depois use “Enviar para análise” no card da campanha. Após a aprovação você paga por PIX e o destaque entra no ar."
                />
                <dl className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60">
                  <ReviewRow label="Pacote" value={pkg ? `${pkg.name} · ${pkg.duration_days} dias` : "—"} />
                  <ReviewRow
                    label="Investimento"
                    value={pkg ? formatCents(pkg.price_cents, pkg.currency) : "—"}
                  />
                  <ReviewRow label="Categoria" value={category ? `${category.emoji} ${category.label}` : categoryId} />
                  <ReviewRow label="Título" value={title || "—"} />
                  <ReviewRow label="Botão" value={cta} />
                  <ReviewRow label="Destino" value={DESTINATION_META[destination]?.label ?? destination} />
                  <ReviewRow label="Imagem" value={imagePath ? "Imagem enviada" : "Logo do estabelecimento"} />
                </dl>
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-3 text-[11px] text-muted-foreground">
                  <div className="mb-1 flex items-center gap-1.5 font-bold text-foreground">
                    <Info className="h-3.5 w-3.5" /> Como funciona
                  </div>
                  Análise da equipe Fidelize → pagamento por PIX → destaque na vitrine por {pkg?.duration_days ?? 7}{" "}
                  dias, sempre identificado como “Patrocinado”.
                </div>
              </div>
            )}
          </div>

          {/* Prévia ao vivo */}
          <aside className="border-t border-border/50 bg-background/40 p-5 lg:border-l lg:border-t-0">
            <div className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              Prévia na vitrine
            </div>
            <div className="mt-3 overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-sm">
              <div className="relative aspect-[16/9] bg-muted">
                {previewImage ? (
                  <img src={previewImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <Megaphone className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <span className="absolute left-2 top-2 rounded-full bg-background/85 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground backdrop-blur">
                  Patrocinado
                </span>
              </div>
              <div className="p-3">
                <div className="text-sm font-bold leading-tight">{title || "Título do seu destaque"}</div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {description || "Uma frase curta contando por que vale a visita."}
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground">
                  <MousePointerClick className="h-3 w-3" /> {cta}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              É assim que os clientes verão seu card em <strong>Descobrir</strong>, no topo da categoria escolhida.
            </p>
          </aside>
        </div>

        {/* Rodapé de navegação */}
        <div className="flex items-center justify-between gap-2 border-t border-border/50 bg-card px-5 py-3">
          <div className="text-[11px] text-muted-foreground">
            Passo {step + 1} de {steps.length}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="rounded-xl border border-border/60 px-4 py-2.5 text-sm font-bold"
              >
                Voltar
              </button>
            )}
            {step < steps.length - 1 ? (
              <button
                disabled={!stepValid[step]}
                onClick={() => setStep((s) => s + 1)}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                Continuar
              </button>
            ) : (
              <button
                disabled={save.isPending || !packageId || !title.trim()}
                onClick={() => save.mutate()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                {save.isPending ? "Salvando…" : "Salvar criativo"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIntro({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3">
      <div className="font-display text-sm font-bold">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 bg-card/40 px-3 py-2.5">
      <dt className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] text-right text-xs font-semibold">{value}</dd>
    </div>
  );
}
