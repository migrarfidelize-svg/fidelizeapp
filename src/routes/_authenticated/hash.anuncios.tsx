import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Megaphone, CheckCircle2, XCircle, PencilLine, Pause, Play, Gift, Settings2, TrendingUp } from "lucide-react";
import { RouteLoading } from "@/components/RouteLoading";
import {
  adminAdsOverview,
  adminListAdCampaigns,
  adminReviewAdCampaign,
  adminGrantCourtesyAd,
  adminGetAdsSettings,
  adminSaveAdsSettings,
} from "@/lib/sponsored-ads-admin.functions";
import { AD_STATUS_META, ctr, formatCents, type AdStatus } from "@/lib/sponsored-ads-core";

export const Route = createFileRoute("/_authenticated/hash/anuncios")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Anúncios patrocinados — Administração Fidelize" },
      { name: "description", content: "Moderação, receita e configurações dos destaques patrocinados." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAdsPage,
  pendingComponent: () => <RouteLoading label="Carregando anúncios…" fullscreen={false} />,
});

const FILTERS: { id: string | null; label: string }[] = [
  { id: "pending_review", label: "Em análise" },
  { id: "active", label: "No ar" },
  { id: "payment_pending", label: "Aguardando PIX" },
  { id: "changes_requested", label: "Correção" },
  { id: "expired", label: "Encerrados" },
  { id: null, label: "Todos" },
];

function AdminAdsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string | null>("pending_review");
  const [tab, setTab] = useState<"campanhas" | "config">("campanhas");

  const overviewFn = useServerFn(adminAdsOverview);
  const listFn = useServerFn(adminListAdCampaigns);

  const overview = useQuery({ queryKey: ["admin-ads-overview"], queryFn: () => overviewFn() });
  const list = useQuery({
    queryKey: ["admin-ads-list", status],
    queryFn: () => listFn({ data: { status, limit: 50 } }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-ads-list"] });
    qc.invalidateQueries({ queryKey: ["admin-ads-overview"] });
  };

  const o = (overview.data ?? {}) as any;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="card-icon">
          <Megaphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">Anúncios patrocinados</h1>
          <p className="text-sm text-muted-foreground">Moderação de criativos, receita e regras da vitrine.</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-border/60 p-1">
          {(["campanhas", "config"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t === "config" ? "Configurações" : "Campanhas"}
            </button>
          ))}
        </div>
      </header>

      {tab === "campanhas" && (
        <>
          <section className="grid gap-3 sm:grid-cols-4">
            <Kpi label="Receita total" value={formatCents(Number(o.revenue_cents ?? 0))} icon={TrendingUp} />
            <Kpi label="Em análise" value={String(o.pending_review ?? 0)} icon={PencilLine} />
            <Kpi label="No ar" value={String(o.active ?? 0)} icon={Play} />
            <Kpi
              label="CTR médio"
              value={`${ctr(Number(o.impressions ?? 0), Number(o.clicks ?? 0))}%`}
              icon={CheckCircle2}
            />
          </section>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => setStatus(f.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  status === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border/60"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {list.isLoading ? (
            <RouteLoading label="Carregando campanhas…" fullscreen={false} />
          ) : (list.data ?? []).length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/60 bg-card/30 p-8 text-center text-sm text-muted-foreground">
              Nenhuma campanha neste filtro.
            </div>
          ) : (
            <div className="space-y-3">
              {(list.data ?? []).map((c: any) => (
                <AdminCampaignRow key={c.id} campaign={c} onDone={refresh} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "config" && <AdsSettingsPanel />}
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="metric-number mt-1 text-2xl">{value}</div>
    </div>
  );
}

function AdminCampaignRow({ campaign, onDone }: { campaign: any; onDone: () => void }) {
  const reviewFn = useServerFn(adminReviewAdCampaign);
  const courtesyFn = useServerFn(adminGrantCourtesyAd);
  const [reason, setReason] = useState("");
  const status = campaign.status as AdStatus;
  const meta = AD_STATUS_META[status] ?? AD_STATUS_META.draft;

  const review = useMutation({
    mutationFn: (action: string) => reviewFn({ data: { campaign_id: campaign.id, action: action as any, reason: reason || undefined } }),
    onSuccess: () => {
      toast.success("Campanha atualizada.");
      setReason("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const courtesy = useMutation({
    mutationFn: () => courtesyFn({ data: { campaign_id: campaign.id, days: 7, reason: reason || "Cortesia comercial" } }),
    onSuccess: () => {
      toast.success("Cortesia concedida.");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <article className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-background">
          {campaign.image_url ? (
            <img src={campaign.image_url} alt="" className="h-full w-full object-cover" />
          ) : campaign.establishment?.logo_url ? (
            <img src={campaign.establishment.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Megaphone className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-sm font-bold">{campaign.title}</h3>
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {meta.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {campaign.establishment?.name} · {campaign.category_id} ·{" "}
            {formatCents(campaign.price_cents_snapshot ?? 0, campaign.currency_snapshot ?? "BRL")}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{campaign.description}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Destino: /{campaign.destination_type}/{campaign.destination_slug} · Botão: {campaign.cta_label}
          </p>
        </div>
      </div>

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo / observação (obrigatório para rejeitar ou pedir ajuste)"
        className="mt-3 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs"
      />

      <div className="mt-2 flex flex-wrap gap-2">
        {status === "pending_review" && (
          <>
            <ActionBtn onClick={() => review.mutate("approve")} icon={CheckCircle2} label="Aprovar" primary />
            <ActionBtn onClick={() => review.mutate("request_changes")} icon={PencilLine} label="Pedir ajuste" />
            <ActionBtn onClick={() => review.mutate("reject")} icon={XCircle} label="Rejeitar" danger />
          </>
        )}
        {status === "active" && <ActionBtn onClick={() => review.mutate("pause")} icon={Pause} label="Pausar" />}
        {status === "paused" && <ActionBtn onClick={() => review.mutate("resume")} icon={Play} label="Retomar" primary />}
        {(status === "active" || status === "paused" || status === "scheduled") && (
          <ActionBtn onClick={() => review.mutate("expire")} icon={XCircle} label="Encerrar" />
        )}
        <ActionBtn onClick={() => courtesy.mutate()} icon={Gift} label="Cortesia 7 dias" />
      </div>
    </article>
  );
}

function ActionBtn({
  onClick,
  icon: Icon,
  label,
  primary,
  danger,
}: {
  onClick: () => void;
  icon: any;
  label: string;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
        primary
          ? "bg-primary text-primary-foreground"
          : danger
            ? "border border-destructive/50 text-destructive"
            : "border border-border/60 hover:border-primary/40"
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function AdsSettingsPanel() {
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetAdsSettings);
  const saveFn = useServerFn(adminSaveAdsSettings);
  const q = useQuery({ queryKey: ["admin-ads-settings"], queryFn: () => getFn() });
  const [form, setForm] = useState<any | null>(null);

  const s = form ?? q.data?.settings;
  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          max_ads_per_category: Number(s.max_ads_per_category),
          max_impressions_per_session_24h: Number(s.max_impressions_per_session_24h),
          impression_dedupe_minutes: Number(s.impression_dedupe_minutes),
          click_dedupe_minutes: Number(s.click_dedupe_minutes),
          pix_expiration_minutes: Number(s.pix_expiration_minutes),
          allow_self_pause: !!s.allow_self_pause,
          self_pause_extends_period: !!s.self_pause_extends_period,
          allowed_categories: s.allowed_categories ?? [],
          advertiser_terms: s.advertiser_terms ?? "",
        },
      }),
    onSuccess: () => {
      toast.success("Configurações salvas.");
      qc.invalidateQueries({ queryKey: ["admin-ads-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <RouteLoading label="Carregando configurações…" fullscreen={false} />;
  if (!s) return null;

  const num = (key: string, label: string) => (
    <div>
      <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{label}</label>
      <input
        type="number"
        value={s[key] ?? 0}
        onChange={(e) => setForm({ ...s, [key]: e.target.value })}
        className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
      />
    </div>
  );

  return (
    <section className="space-y-4 rounded-3xl border border-border/60 bg-card/40 p-5">
      <div className="flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-bold">Regras da vitrine</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {num("max_ads_per_category", "Slots por categoria")}
        {num("max_impressions_per_session_24h", "Exibições / sessão 24h")}
        {num("impression_dedupe_minutes", "Dedupe impressão (min)")}
        {num("click_dedupe_minutes", "Dedupe clique (min)")}
        {num("pix_expiration_minutes", "Expiração do PIX (min)")}
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!s.allow_self_pause}
            onChange={(e) => setForm({ ...s, allow_self_pause: e.target.checked })}
          />
          Anunciante pode pausar
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!s.self_pause_extends_period}
            onChange={(e) => setForm({ ...s, self_pause_extends_period: e.target.checked })}
          />
          Pausa estende o período contratado
        </label>
      </div>
      <div>
        <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
          Termos do anunciante
        </label>
        <textarea
          rows={8}
          value={s.advertiser_terms ?? ""}
          onChange={(e) => setForm({ ...s, advertiser_terms: e.target.value })}
          className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Alterar o texto gera uma nova versão e exige novo aceite nos próximos envios.
        </p>
      </div>
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {save.isPending ? "Salvando…" : "Salvar configurações"}
      </button>
    </section>
  );
}
