import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Star, Reply, EyeOff, Eye, MessageSquare, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { listReviews, getReviewStats, replyReview, toggleReviewPublic, getReviewSettings, saveReviewSettings } from "@/lib/reviews.functions";
import {
  getMerchantReviewForm, saveMerchantReviewForm, saveRatingOptions,
  upsertReviewQuestion, deleteReviewQuestion,
  listPublicReviewsInbox, updatePublicReview, getPublicReviewStats,
  getReviewInsights,
} from "@/lib/public-reviews.functions";
import { formatDate } from "@/lib/format";
import { Trash2, Plus, ExternalLink as ExtLink, AlertTriangle, TrendingDown, Search, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/avaliacoes")({
  head: () => ({ meta: [{ title: "Avaliações — Fidelize" }] }),
  component: Page,
});

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-4 w-4 ${i <= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

function Page() {
  const getEsts = useServerFn(getMyEstablishments);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as { id: string; name: string; slug: string } | undefined;

  if (!est) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Avaliações de atendimento</h1>
          <p className="text-sm text-muted-foreground">Acompanhe o feedback dos seus clientes e responda com agilidade.</p>
        </div>
        <a href={`/avaliacoes/${est.slug}`} target="_blank" rel="noopener" className="text-sm text-primary hover:underline">
          Ver página pública →
        </a>
      </header>

      <Tabs defaultValue="feed" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="feed">Voucher (pós-carimbo)</TabsTrigger>
          <TabsTrigger value="public-inbox">Caixa (público)</TabsTrigger>
          <TabsTrigger value="alerts"><AlertTriangle className="mr-1 h-3 w-3" />Alertas ≤2</TabsTrigger>
          <TabsTrigger value="insights"><TrendingDown className="mr-1 h-3 w-3" />Insights</TabsTrigger>
          <TabsTrigger value="public-form">Formulário público</TabsTrigger>
          <TabsTrigger value="public-ratings">Notas 1–5</TabsTrigger>
          <TabsTrigger value="public-questions">Perguntas extras</TabsTrigger>
          <TabsTrigger value="config">Config. voucher</TabsTrigger>
        </TabsList>
        <TabsContent value="feed"><Feed estId={est.id} /></TabsContent>
        <TabsContent value="public-inbox"><PublicInbox estId={est.id} /></TabsContent>
        <TabsContent value="alerts"><LowRatingAlerts estId={est.id} /></TabsContent>
        <TabsContent value="insights"><InsightsTab estId={est.id} /></TabsContent>
        <TabsContent value="public-form"><PublicFormTab estId={est.id} slug={est.slug} /></TabsContent>
        <TabsContent value="public-ratings"><PublicRatingsTab estId={est.id} /></TabsContent>
        <TabsContent value="public-questions"><PublicQuestionsTab estId={est.id} /></TabsContent>
        <TabsContent value="config"><Settings estId={est.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Feed({ estId }: { estId: string }) {
  const statsFn = useServerFn(getReviewStats);
  const listFn = useServerFn(listReviews);
  const [filter, setFilter] = useState<string>("all");

  const { data: stats } = useQuery({
    queryKey: ["review-stats", estId],
    queryFn: () => statsFn({ data: { establishmentId: estId, days: 30 } }),
  });
  const { data: rows, isLoading } = useQuery({
    queryKey: ["reviews", estId, filter],
    queryFn: () => listFn({ data: { establishmentId: estId, ratingFilter: filter === "all" ? undefined : Number(filter) } }),
  });

  const distMax = useMemo(() => Math.max(1, ...Object.values(stats?.dist ?? {})), [stats]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Nota média (30d)</div>
          <div className="mt-1 flex items-end gap-2">
            <div className="text-3xl font-bold">{stats ? stats.avg.toFixed(1) : "—"}</div>
            {stats && <Stars n={Math.round(stats.avg)} />}
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Avaliações (30d)</div>
          <div className="mt-1 text-3xl font-bold">{stats?.count ?? "—"}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">NPS (30d)</div>
          <div className="mt-1 text-3xl font-bold">{stats?.nps ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{stats?.npsResponses ?? 0} respostas</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Distribuição</div>
          <div className="mt-2 space-y-1">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="w-3">{n}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-yellow-400"
                    style={{ width: `${((stats?.dist?.[n] ?? 0) / distMax) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-muted-foreground">{stats?.dist?.[n] ?? 0}</span>
              </div>
            ))}
          </div>
        </CardContent></Card>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-sm">Filtrar por nota</Label>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {[5, 4, 3, 2, 1].map((n) => <SelectItem key={n} value={String(n)}>{n} estrelas</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {(rows ?? []).length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Sem avaliações ainda.</CardContent></Card>
          )}
          {(rows ?? []).map((r) => <ReviewRow key={r.id} r={r} estId={estId} />)}
        </div>
      )}
    </div>
  );
}

function ReviewRow({ r, estId }: { r: any; estId: string }) {
  const replyFn = useServerFn(replyReview);
  const toggleFn = useServerFn(toggleReviewPublic);
  const qc = useQueryClient();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(r.reply ?? "");

  const mut = useMutation({
    mutationFn: async () => replyFn({ data: { reviewId: r.id, reply } }),
    onSuccess: () => { toast.success("Resposta enviada"); setReplying(false); qc.invalidateQueries({ queryKey: ["reviews", estId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const togg = useMutation({
    mutationFn: async () => toggleFn({ data: { reviewId: r.id, isPublic: !r.is_public } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reviews", estId] }); toast.success(r.is_public ? "Ocultada" : "Publicada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const displayName = r.customer_name || r.customers?.name || "Cliente";
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Stars n={r.rating} />
              <span className="text-sm font-semibold">{displayName}</span>
              {r.nps != null && <Badge variant="outline">NPS {r.nps}</Badge>}
              {!r.is_public && <Badge variant="secondary">Oculta</Badge>}
            </div>
            <div className="text-xs text-muted-foreground">{formatDate(r.created_at)}</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => togg.mutate()} disabled={togg.isPending}>
              {r.is_public ? <><EyeOff className="mr-1 h-3 w-3" />Ocultar</> : <><Eye className="mr-1 h-3 w-3" />Publicar</>}
            </Button>
            {!r.reply && <Button size="sm" onClick={() => setReplying((v) => !v)}><Reply className="mr-1 h-3 w-3" />Responder</Button>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {r.comment && <p className="text-sm">{r.comment}</p>}
        {r.reply && (
          <div className="rounded-lg border-l-4 border-primary bg-muted/40 p-3 text-sm">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-primary">
              <MessageSquare className="h-3 w-3" /> Resposta do estabelecimento
            </div>
            {r.reply}
            <div className="mt-1 text-[10px] text-muted-foreground">{r.replied_at && formatDate(r.replied_at)}</div>
          </div>
        )}
        {replying && !r.reply && (
          <div className="space-y-2">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escreva uma resposta educada e útil…" maxLength={1000} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending || !reply.trim()}>Enviar</Button>
              <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Settings({ estId }: { estId: string }) {
  const getFn = useServerFn(getReviewSettings);
  const saveFn = useServerFn(saveReviewSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["review-settings", estId], queryFn: () => getFn({ data: { establishmentId: estId } }) });
  const [form, setForm] = useState<any>(null);

  const state = form ?? data ?? {
    auto_prompt: true, prompt_title: "Como foi seu atendimento?",
    prompt_message: "Sua opinião nos ajuda a melhorar. Leva menos de 30 segundos!",
    ask_nps: false, ask_categories: true,
    google_place_url: "", google_redirect_min_rating: 5,
    public_page_enabled: true, thank_you_message: "Obrigado pelo seu feedback!",
  };
  const upd = (patch: any) => setForm({ ...state, ...patch });

  const mut = useMutation({
    mutationFn: async () => saveFn({ data: {
      establishmentId: estId,
      auto_prompt: state.auto_prompt,
      prompt_title: state.prompt_title,
      prompt_message: state.prompt_message,
      ask_nps: state.ask_nps,
      ask_categories: state.ask_categories,
      google_place_url: state.google_place_url || null,
      google_redirect_min_rating: state.google_redirect_min_rating,
      public_page_enabled: state.public_page_enabled,
      thank_you_message: state.thank_you_message,
    } }),
    onSuccess: () => { toast.success("Configurações salvas"); qc.invalidateQueries({ queryKey: ["review-settings", estId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card><CardHeader><CardTitle>Configurações de avaliação</CardTitle></CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Título do convite</Label>
          <Input value={state.prompt_title} maxLength={120} onChange={(e) => upd({ prompt_title: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Mensagem</Label>
          <Input value={state.prompt_message} maxLength={300} onChange={(e) => upd({ prompt_message: e.target.value })} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div><div className="text-sm font-medium">Convidar automaticamente após carimbo</div>
            <div className="text-xs text-muted-foreground">Aparece no voucher do cliente ao entrar após novo carimbo.</div></div>
          <Switch checked={state.auto_prompt} onCheckedChange={(v) => upd({ auto_prompt: v })} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div><div className="text-sm font-medium">Pedir NPS (0-10)</div>
            <div className="text-xs text-muted-foreground">Disponível apenas no plano Enterprise.</div></div>
          <Switch checked={state.ask_nps} onCheckedChange={(v) => upd({ ask_nps: v })} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
          <div><div className="text-sm font-medium">Página pública de avaliações</div>
            <div className="text-xs text-muted-foreground">Fica em <code>/avaliacoes/seu-slug</code>. Bom para SEO.</div></div>
          <Switch checked={state.public_page_enabled} onCheckedChange={(v) => upd({ public_page_enabled: v })} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>URL do Google Reviews (opcional)</Label>
          <Input placeholder="https://g.page/r/…/review" value={state.google_place_url ?? ""}
            onChange={(e) => upd({ google_place_url: e.target.value })} />
          <p className="text-xs text-muted-foreground">Após uma avaliação com nota igual ou maior que <b>{state.google_redirect_min_rating}</b>, redirecionamos o cliente para deixar uma review no Google.</p>
        </div>
        <div className="space-y-2">
          <Label>Nota mínima para redirecionar ao Google</Label>
          <Select value={String(state.google_redirect_min_rating)} onValueChange={(v) => upd({ google_redirect_min_rating: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[5, 4, 3].map((n) => <SelectItem key={n} value={String(n)}>{n}+ estrelas</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Mensagem de agradecimento</Label>
          <Input value={state.thank_you_message} maxLength={300} onChange={(e) => upd({ thank_you_message: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Salvando…" : "Salvar configurações"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ================== PUBLIC RATING SYSTEM TABS ==================

function PublicFormTab({ estId, slug }: { estId: string; slug: string }) {
  const getFn = useServerFn(getMerchantReviewForm);
  const saveFn = useServerFn(saveMerchantReviewForm);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["mr-form", estId], queryFn: () => getFn({ data: { establishmentId: estId } }) });
  const [f, setF] = useState<any>(null);
  const s = f ?? data?.form;
  const upd = (patch: any) => setF({ ...s, ...patch });

  const mut = useMutation({
    mutationFn: async () => saveFn({ data: {
      establishmentId: estId,
      active: !!s.active,
      title: s.title, question: s.question,
      description: s.description ?? null,
      submit_label: s.submit_label,
      success_message: s.success_message,
      star_color: s.star_color, button_color: s.button_color,
      google_review_url: s.google_review_url ?? null,
      redirect_to_google_enabled: !!s.redirect_to_google_enabled,
      show_average: !!s.show_average,
      show_review_count: !!s.show_review_count,
      anonymous_allowed: !!s.anonymous_allowed,
      name_required: !!s.name_required,
      phone_required: !!s.phone_required,
      email_required: !!s.email_required,
      comment_required: !!s.comment_required,
      allow_multiple: !!s.allow_multiple,
      cooldown_hours: Number(s.cooldown_hours ?? 24),
      consent_text: s.consent_text ?? null,
    } }),
    onSuccess: () => { toast.success("Formulário salvo"); qc.invalidateQueries({ queryKey: ["mr-form", estId] }); qc.invalidateQueries({ queryKey: ["public-review-form", slug] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!s) return <div className="p-6 text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
        <div>
          <div className="text-sm font-medium">Avaliações públicas ativas</div>
          <div className="text-xs text-muted-foreground">Aparece na Árvore de Links e em <code>/avaliar/{slug}</code></div>
        </div>
        <div className="flex items-center gap-3">
          <a href={`/avaliar/${slug}`} target="_blank" rel="noopener" className="text-sm text-primary hover:underline inline-flex items-center gap-1"><ExtLink className="h-3 w-3" />Abrir</a>
          <Switch checked={s.active} onCheckedChange={(v) => upd({ active: v })} />
        </div>
      </div>

      <Card><CardHeader><CardTitle>Textos & botão</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div><Label>Título</Label><Input value={s.title} maxLength={160} onChange={(e) => upd({ title: e.target.value })} /></div>
          <div><Label>Texto do botão</Label><Input value={s.submit_label} maxLength={60} onChange={(e) => upd({ submit_label: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Pergunta principal</Label><Input value={s.question} maxLength={300} onChange={(e) => upd({ question: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Texto de apoio (opcional)</Label><Input value={s.description ?? ""} maxLength={500} onChange={(e) => upd({ description: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Mensagem de agradecimento</Label><Input value={s.success_message} maxLength={300} onChange={(e) => upd({ success_message: e.target.value })} /></div>
          <div><Label>Cor das estrelas</Label><Input type="color" value={s.star_color} onChange={(e) => upd({ star_color: e.target.value })} /></div>
          <div><Label>Cor do botão</Label><Input type="color" value={s.button_color} onChange={(e) => upd({ button_color: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>Campos exigidos</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {[
            ["anonymous_allowed", "Permitir avaliação anônima"],
            ["name_required", "Exigir nome"],
            ["phone_required", "Exigir telefone"],
            ["email_required", "Exigir e-mail"],
            ["comment_required", "Exigir comentário"],
            ["show_average", "Mostrar nota média publicamente"],
            ["show_review_count", "Mostrar quantidade de avaliações"],
            ["allow_multiple", "Permitir mais de uma avaliação por pessoa"],
          ].map(([k, label]) => (
            <div key={k} className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">{label}</span>
              <Switch checked={!!s[k]} onCheckedChange={(v) => upd({ [k]: v })} />
            </div>
          ))}
          <div className="md:col-span-2">
            <Label>Intervalo mínimo entre avaliações do mesmo dispositivo (horas)</Label>
            <Input type="number" min={0} max={720} value={s.cooldown_hours} onChange={(e) => upd({ cooldown_hours: Number(e.target.value) })} />
          </div>
          <div className="md:col-span-2">
            <Label>Texto de consentimento (LGPD)</Label>
            <Textarea value={s.consent_text ?? ""} maxLength={500} onChange={(e) => upd({ consent_text: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>Google Reviews</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div><div className="text-sm font-medium">Oferecer redirecionamento para o Google</div>
              <div className="text-xs text-muted-foreground">Apenas quando a nota tiver ação "invite_google" (padrão: 4★ e 5★).</div></div>
            <Switch checked={s.redirect_to_google_enabled} onCheckedChange={(v) => upd({ redirect_to_google_enabled: v })} />
          </div>
          <div>
            <Label>Link do Google (perfil da empresa)</Label>
            <Input placeholder="https://g.page/r/…/review" value={s.google_review_url ?? ""} onChange={(e) => upd({ google_review_url: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Salvando…" : "Salvar formulário"}</Button>
    </div>
  );
}

function PublicRatingsTab({ estId }: { estId: string }) {
  const getFn = useServerFn(getMerchantReviewForm);
  const saveFn = useServerFn(saveRatingOptions);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["mr-form", estId], queryFn: () => getFn({ data: { establishmentId: estId } }) });
  const [rows, setRows] = useState<any[] | null>(null);
  const list = rows ?? data?.options ?? [];
  const set = (id: string, patch: any) => setRows(list.map((o) => o.id === id ? { ...o, ...patch } : o));

  const mut = useMutation({
    mutationFn: async () => saveFn({ data: {
      establishmentId: estId,
      options: list.map((o) => ({
        id: o.id, enabled: !!o.enabled, label: o.label,
        selection_message: o.selection_message ?? null,
        comment_required: !!o.comment_required,
        post_submit_action: o.post_submit_action,
      })),
    } }),
    onSuccess: () => { toast.success("Notas salvas"); qc.invalidateQueries({ queryKey: ["mr-form", estId] }); setRows(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return <div className="p-6 text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Ative/desative cada nota e personalize o comportamento. Não force nota positiva — o cliente escolhe livremente.</p>
      {list.sort((a, b) => a.rating - b.rating).map((o) => (
        <Card key={o.id}>
          <CardContent className="grid gap-3 p-4 md:grid-cols-[auto_1fr_1fr_1fr_auto] md:items-end">
            <div className="flex items-center gap-2 font-bold">
              {Array.from({ length: o.rating }).map((_, i) => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}
            </div>
            <div><Label className="text-xs">Texto</Label><Input value={o.label} onChange={(e) => set(o.id, { label: e.target.value })} maxLength={60} /></div>
            <div><Label className="text-xs">Mensagem ao selecionar</Label><Input value={o.selection_message ?? ""} onChange={(e) => set(o.id, { selection_message: e.target.value })} maxLength={300} /></div>
            <div>
              <Label className="text-xs">Ação após envio</Label>
              <Select value={o.post_submit_action} onValueChange={(v) => set(o.id, { post_submit_action: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="apologize">Pedir desculpas</SelectItem>
                  <SelectItem value="ask_details">Pedir detalhes</SelectItem>
                  <SelectItem value="thank">Agradecer</SelectItem>
                  <SelectItem value="invite_google">Convidar p/ Google</SelectItem>
                  <SelectItem value="invite_share">Convidar p/ compartilhar</SelectItem>
                  <SelectItem value="none">Nenhuma</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col items-end gap-2">
              <label className="flex items-center gap-2 text-xs"><Switch checked={o.enabled} onCheckedChange={(v) => set(o.id, { enabled: v })} />Ativa</label>
              <label className="flex items-center gap-2 text-xs"><Switch checked={o.comment_required} onCheckedChange={(v) => set(o.id, { comment_required: v })} />Comentário obrig.</label>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Salvando…" : "Salvar notas"}</Button>
    </div>
  );
}

function PublicQuestionsTab({ estId }: { estId: string }) {
  const getFn = useServerFn(getMerchantReviewForm);
  const upsertFn = useServerFn(upsertReviewQuestion);
  const delFn = useServerFn(deleteReviewQuestion);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["mr-form", estId], queryFn: () => getFn({ data: { establishmentId: estId } }) });

  const nextOrder = () => (data?.questions?.length ?? 0);
  const add = useMutation({
    mutationFn: async (q?: { question: string; question_type: any; choices?: string[]; required?: boolean }) => upsertFn({ data: { establishmentId: estId, question: {
      question: q?.question ?? "Nova pergunta",
      question_type: q?.question_type ?? "short",
      choices: q?.choices,
      required: q?.required ?? false,
      display_order: nextOrder(),
      active: true,
    } } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mr-form", estId] }); toast.success("Pergunta adicionada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const EXAMPLES: Array<{ label: string; q: { question: string; question_type: any; choices?: string[]; required?: boolean } }> = [
    { label: "Você recomendaria a um amigo?", q: { question: "Você recomendaria nosso estabelecimento a um amigo?", question_type: "yes_no" } },
    { label: "Tempo de espera", q: { question: "Como avalia o tempo de espera do atendimento?", question_type: "stars" } },
    { label: "Qualidade do produto", q: { question: "Como avalia a qualidade do produto/serviço?", question_type: "stars" } },
    { label: "Simpatia da equipe", q: { question: "A equipe foi simpática e atenciosa?", question_type: "yes_no" } },
    { label: "Limpeza do local", q: { question: "Como avalia a limpeza e organização do local?", question_type: "stars" } },
    { label: "O que podemos melhorar?", q: { question: "O que podemos melhorar no seu próximo atendimento?", question_type: "long" } },
    { label: "Como nos conheceu?", q: { question: "Como nos conheceu?", question_type: "choice", choices: ["Indicação", "Redes sociais", "Google", "Passei em frente", "Outro"] } },
    { label: "Voltará em breve?", q: { question: "Você pretende voltar em breve?", question_type: "yes_no" } },
    { label: "NPS clássico (0–10)", q: { question: "De 0 a 10, o quanto você nos recomendaria?", question_type: "nps" } },
    { label: "Motivo da visita", q: { question: "Qual foi o principal motivo da sua visita hoje?", question_type: "choice", choices: ["Rotina", "Ocasião especial", "Primeira vez", "Promoção", "Indicação"] } },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">Perguntas extras que aparecem depois do cliente escolher a nota.</p>
        <Button size="sm" onClick={() => add.mutate(undefined)}><Plus className="mr-1 h-3 w-3" />Nova pergunta em branco</Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">💡 Exemplos prontos — clique para adicionar</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <Button key={ex.label} size="sm" variant="outline" onClick={() => add.mutate(ex.q)} disabled={add.isPending}>
              <Plus className="mr-1 h-3 w-3" />{ex.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {(data?.questions ?? []).length === 0 && (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhuma pergunta extra. Adicione uma acima ou escolha um exemplo.</CardContent></Card>
      )}
      {(data?.questions ?? []).map((q) => (
        <QuestionRow key={q.id} q={q} estId={estId} onChanged={() => qc.invalidateQueries({ queryKey: ["mr-form", estId] })} upsertFn={upsertFn} delFn={delFn} />
      ))}
    </div>
  );
}

function QuestionRow({ q, estId, onChanged, upsertFn, delFn }: { q: any; estId: string; onChanged: () => void; upsertFn: any; delFn: any }) {
  const [x, setX] = useState<any>(q);
  const save = useMutation({
    mutationFn: async () => upsertFn({ data: { establishmentId: estId, question: {
      id: x.id, question: x.question, question_type: x.question_type,
      choices: x.question_type === "choice" ? (Array.isArray(x.choices) ? x.choices : (x.choices ?? "").split("\n").map((s: string) => s.trim()).filter(Boolean)) : undefined,
      required: !!x.required, display_order: x.display_order ?? 0, active: !!x.active,
    } } }),
    onSuccess: () => { toast.success("Salvo"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async () => delFn({ data: { id: q.id } }),
    onSuccess: () => { toast.success("Removida"); onChanged(); },
  });
  return (
    <Card>
      <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_180px_auto]">
        <div>
          <Input value={x.question} maxLength={200} onChange={(e) => setX({ ...x, question: e.target.value })} />
          {x.question_type === "choice" && (
            <Textarea className="mt-2" placeholder="Uma opção por linha" value={Array.isArray(x.choices) ? x.choices.join("\n") : (x.choices ?? "")} onChange={(e) => setX({ ...x, choices: e.target.value })} />
          )}
        </div>
        <Select value={x.question_type} onValueChange={(v) => setX({ ...x, question_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="short">Texto curto</SelectItem>
            <SelectItem value="long">Texto longo</SelectItem>
            <SelectItem value="stars">Estrelas</SelectItem>
            <SelectItem value="nps">NPS 0–10</SelectItem>
            <SelectItem value="yes_no">Sim/Não</SelectItem>
            <SelectItem value="choice">Múltipla escolha</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex flex-col items-end gap-2">
          <label className="flex items-center gap-2 text-xs"><Switch checked={!!x.required} onCheckedChange={(v) => setX({ ...x, required: v })} />Obrig.</label>
          <label className="flex items-center gap-2 text-xs"><Switch checked={!!x.active} onCheckedChange={(v) => setX({ ...x, active: v })} />Ativa</label>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => del.mutate()}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PublicInbox({ estId }: { estId: string }) {
  const listFn = useServerFn(listPublicReviewsInbox);
  const statsFn = useServerFn(getPublicReviewStats);
  const updFn = useServerFn(updatePublicReview);
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const [ratingF, setRatingF] = useState<string>("all");

  const { data: stats } = useQuery({ queryKey: ["pr-stats", estId], queryFn: () => statsFn({ data: { establishmentId: estId, days: 30 } }) });
  const { data: rows, isLoading } = useQuery({
    queryKey: ["pr-inbox", estId, status, ratingF],
    queryFn: () => listFn({ data: { establishmentId: estId, status: status === "all" ? undefined : status as any, ratingFilter: ratingF === "all" ? undefined : Number(ratingF) } }),
  });

  const setSt = useMutation({
    mutationFn: async ({ id, s }: { id: string; s: string }) => updFn({ data: { id, status: s as any } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pr-inbox", estId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const distMax = Math.max(1, ...Object.values(stats?.dist ?? {}));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Nota média (30d)</div><div className="mt-1 flex items-end gap-2"><div className="text-3xl font-bold">{stats ? stats.avg.toFixed(1) : "—"}</div>{stats && <Stars n={Math.round(stats.avg)} />}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total (30d)</div><div className="mt-1 text-3xl font-bold">{stats?.count ?? "—"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pendentes</div><div className="mt-1 text-3xl font-bold">{stats?.pending ?? "—"}</div></CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Distribuição</div>
          <div className="mt-2 space-y-1">{[5, 4, 3, 2, 1].map((n) => (
            <div key={n} className="flex items-center gap-2 text-xs">
              <span className="w-3">{n}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-yellow-400" style={{ width: `${((stats?.dist?.[n] ?? 0) / distMax) * 100}%` }} /></div>
              <span className="w-6 text-right text-muted-foreground">{stats?.dist?.[n] ?? 0}</span>
            </div>
          ))}</div>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-sm">Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="new">Nova</SelectItem>
            <SelectItem value="analyzing">Em análise</SelectItem>
            <SelectItem value="contacting">Em contato</SelectItem>
            <SelectItem value="resolved">Resolvida</SelectItem>
            <SelectItem value="archived">Arquivada</SelectItem>
          </SelectContent>
        </Select>
        <Label className="text-sm">Nota</Label>
        <Select value={ratingF} onValueChange={setRatingF}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {[5, 4, 3, 2, 1].map((n) => <SelectItem key={n} value={String(n)}>{n}★</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {(rows ?? []).length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma avaliação nesta seleção.</CardContent></Card>}
          {(rows ?? []).map((r: any) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Stars n={r.rating} />
                      <span className="text-sm font-semibold">{r.anonymous ? "Anônimo" : (r.customer_name || "Cliente")}</span>
                      <Badge variant="outline" className="text-[10px]">{r.source}</Badge>
                      <Badge className="text-[10px]" variant={r.status === "new" ? "default" : r.status === "resolved" ? "secondary" : "outline"}>{r.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDate(r.created_at)}{r.order_reference ? ` · Pedido ${r.order_reference}` : ""}</div>
                  </div>
                  <Select value={r.status} onValueChange={(s) => setSt.mutate({ id: r.id, s })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Nova</SelectItem>
                      <SelectItem value="analyzing">Em análise</SelectItem>
                      <SelectItem value="contacting">Em contato</SelectItem>
                      <SelectItem value="resolved">Resolvida</SelectItem>
                      <SelectItem value="archived">Arquivada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {r.comment && <p className="text-sm">{r.comment}</p>}
                {!r.anonymous && (r.customer_phone || r.customer_email) && (
                  <div className="text-xs text-muted-foreground">{r.customer_phone && <span>📞 {r.customer_phone}</span>}{r.customer_email && <span className="ml-3">✉️ {r.customer_email}</span>}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

