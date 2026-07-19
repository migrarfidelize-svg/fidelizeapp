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
} from "@/lib/public-reviews.functions";
import { formatDate } from "@/lib/format";
import { Trash2, Plus, ExternalLink as ExtLink } from "lucide-react";

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
          <TabsTrigger value="public-form">Formulário público</TabsTrigger>
          <TabsTrigger value="public-ratings">Notas 1–5</TabsTrigger>
          <TabsTrigger value="public-questions">Perguntas extras</TabsTrigger>
          <TabsTrigger value="config">Config. voucher</TabsTrigger>
        </TabsList>
        <TabsContent value="feed"><Feed estId={est.id} /></TabsContent>
        <TabsContent value="public-inbox"><PublicInbox estId={est.id} /></TabsContent>
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
