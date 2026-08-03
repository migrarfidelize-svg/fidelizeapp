import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/states/EmptyState";
import { RouteLoading } from "@/components/RouteLoading";
import {
  MessageSquare, Send, QrCode, Plug, RefreshCw, Loader2, UserPlus, CheckCheck,
  Inbox, Clock, Zap, Trash2, Plus, PhoneOff,
} from "lucide-react";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { OrdersDock } from "@/components/atendimento/OrdersDock";

import {
  getWhatsAppConnection, startWhatsAppPairing, refreshWhatsAppStatus, disconnectWhatsApp,
  listConversations, getConversation, sendConversationMessage, updateConversation,
  startConversation, listTemplates, saveTemplate, deleteTemplate, getInboxStats,
} from "@/lib/atendimento.functions";

export const Route = createFileRoute("/_authenticated/app/atendimento")({
  head: () => ({
    meta: [
      { title: "Central de Atendimento — Fidelize" },
      { name: "description", content: "Atenda seus clientes pelo WhatsApp direto do painel Fidelize." },
    ],
  }),
  component: AtendimentoPage,
});

const STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  in_progress: "Em atendimento",
  waiting: "Aguardando cliente",
  resolved: "Resolvido",
};

function fmtTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function AtendimentoPage() {
  const qc = useQueryClient();
  const estFn = useServerFn(getMyEstablishments);
  const ests = useQuery({ queryKey: ["my-establishments"], queryFn: () => estFn() });
  const establishmentId: string | undefined = (ests.data as any)?.[0]?.id;

  if (ests.isLoading) return <RouteLoading />;
  if (!establishmentId) {
    return (
      <div className="p-4 md:p-8">
        <EmptyState icon={MessageSquare} title="Nenhum estabelecimento" description="Conclua o cadastro do seu negócio para usar a Central de Atendimento." />
      </div>
    );
  }

  return <Inner establishmentId={establishmentId} qc={qc} />;
}

function Inner({ establishmentId, qc }: { establishmentId: string; qc: ReturnType<typeof useQueryClient> }) {
  const connFn = useServerFn(getWhatsAppConnection);
  const listFn = useServerFn(listConversations);
  const statsFn = useServerFn(getInboxStats);

  const [statusFilter, setStatusFilter] = useState<"all" | "queued" | "in_progress" | "waiting" | "resolved">("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const conn = useQuery({
    queryKey: ["wa-connection", establishmentId],
    queryFn: () => connFn({ data: { establishment_id: establishmentId } }),
  });

  const convs = useQuery({
    queryKey: ["conversations", establishmentId, statusFilter, search],
    queryFn: () => listFn({ data: { establishment_id: establishmentId, status: statusFilter, search } }),
  });

  const stats = useQuery({
    queryKey: ["inbox-stats", establishmentId],
    queryFn: () => statsFn({ data: { establishment_id: establishmentId } }),
  });

  // Tempo real: novas mensagens e mudanças de conversa.
  useEffect(() => {
    const channel = supabase
      .channel(`inbox-${establishmentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `establishment_id=eq.${establishmentId}` }, () => {
        qc.invalidateQueries({ queryKey: ["conversations", establishmentId] });
        qc.invalidateQueries({ queryKey: ["inbox-stats", establishmentId] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_messages", filter: `establishment_id=eq.${establishmentId}` }, () => {
        qc.invalidateQueries({ queryKey: ["conversation"] });
        qc.invalidateQueries({ queryKey: ["conversations", establishmentId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [establishmentId, qc]);

  const connected = conn.data?.connection?.connection_status === "connected";

  return (
    <div className="p-4 md:p-8 space-y-6">
      <OrdersDock establishmentId={establishmentId} />

      <PageHero
        icon={MessageSquare}
        eyebrow="Atendimento"
        title="Central de Atendimento"
        subtitle="Converse com seus clientes pelo WhatsApp sem sair do painel — com fila, responsáveis e histórico."
        ticker={[
          { label: "Na fila", value: stats.data?.queued ?? 0, icon: Inbox },
          { label: "Em atendimento", value: stats.data?.in_progress ?? 0, icon: Clock },
          { label: "Resolvidos", value: stats.data?.resolved ?? 0, icon: CheckCheck },
        ]}
      />


      <Tabs defaultValue="inbox">
        <TabsList className="flex-wrap">
          <TabsTrigger value="inbox"><Inbox className="h-4 w-4 mr-1" />Caixa de entrada</TabsTrigger>
          <TabsTrigger value="pedidos"><ShoppingBag className="h-4 w-4 mr-1" />Pedidos &amp; Entregas</TabsTrigger>
          <TabsTrigger value="conexao"><Plug className="h-4 w-4 mr-1" />Conexão (QR)</TabsTrigger>
          <TabsTrigger value="respostas"><Zap className="h-4 w-4 mr-1" />Respostas rápidas</TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos" className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            Aprove ou recuse pedidos, acompanhe o preparo e envie para um entregador da plataforma sem sair do atendimento.
          </p>
          <OrdersDock establishmentId={establishmentId} variant="board" />
        </TabsContent>


        <TabsContent value="inbox" className="mt-6">
          {!connected && (
            <Card className="mb-4 border-amber-500/40 bg-amber-500/5">
              <CardContent className="flex flex-wrap items-center gap-3 py-4 text-sm">
                <QrCode className="h-4 w-4 text-amber-600" />
                <span>WhatsApp ainda não conectado — conecte na aba <strong>Conexão</strong> para enviar e receber mensagens.</span>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <Card className="overflow-hidden">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Conversas</CardTitle>
                  <NewConversationDialog establishmentId={establishmentId} onCreated={(id) => setActiveId(id)} />
                </div>
                <Input placeholder="Buscar nome ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="queued">Na fila</SelectItem>
                    <SelectItem value="in_progress">Em atendimento</SelectItem>
                    <SelectItem value="waiting">Aguardando cliente</SelectItem>
                    <SelectItem value="resolved">Resolvidos</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
                {convs.isLoading ? (
                  <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
                ) : (convs.data ?? []).length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa por aqui ainda.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {(convs.data as any[]).map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setActiveId(c.id)}
                          className={`w-full px-4 py-3 text-left transition hover:bg-muted/50 ${activeId === c.id ? "bg-muted" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">{c.contact_name || c.contact_phone}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{fmtTime(c.last_message_at)}</span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.last_message_preview || "—"}</p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[c.status] ?? c.status}</Badge>
                            {c.unread_count > 0 && <Badge className="text-[10px]">{c.unread_count} nova(s)</Badge>}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {activeId ? (
              <ConversationPanel establishmentId={establishmentId} conversationId={activeId} />
            ) : (
              <Card><CardContent className="py-16">
                <EmptyState icon={MessageSquare} title="Selecione uma conversa" description="Escolha um atendimento na lista ao lado para ver o histórico completo." />
              </CardContent></Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="conexao" className="mt-6">
          <ConnectionPanel establishmentId={establishmentId} />
        </TabsContent>

        <TabsContent value="respostas" className="mt-6">
          <TemplatesPanel establishmentId={establishmentId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Conversa ---------------- */

function ConversationPanel({ establishmentId, conversationId }: { establishmentId: string; conversationId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getConversation);
  const sendFn = useServerFn(sendConversationMessage);
  const updFn = useServerFn(updateConversation);
  const tplFn = useServerFn(listTemplates);
  const [draft, setDraft] = useState("");

  const q = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => getFn({ data: { establishment_id: establishmentId, conversation_id: conversationId } }),
  });
  const templates = useQuery({
    queryKey: ["conv-templates", establishmentId],
    queryFn: () => tplFn({ data: { establishment_id: establishmentId } }),
  });

  const send = useMutation({
    mutationFn: () => sendFn({ data: { establishment_id: establishmentId, conversation_id: conversationId, body: draft } }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations", establishmentId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao enviar."),
  });

  const update = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      updFn({ data: { establishment_id: establishmentId, conversation_id: conversationId, ...patch } as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations", establishmentId] });
      qc.invalidateQueries({ queryKey: ["inbox-stats", establishmentId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar."),
  });

  const conv = (q.data as any)?.conversation;
  const messages = ((q.data as any)?.messages ?? []) as any[];
  const customer = (q.data as any)?.customer;

  if (q.isLoading) return <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Carregando conversa…</CardContent></Card>;
  if (!conv) return <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Conversa indisponível.</CardContent></Card>;

  return (
    <Card className="flex min-h-[60vh] flex-col">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <CardTitle className="truncate text-base">{conv.contact_name || conv.contact_phone}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {conv.contact_phone}
            {customer ? ` · cliente ${customer.tier} · ${customer.visits_count ?? 0} visitas` : " · não cadastrado"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={conv.status} onValueChange={(v) => update.mutate({ status: v })}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => update.mutate({ assign_to_me: true })}>
            <UserPlus className="mr-1 h-3.5 w-3.5" />Assumir
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 overflow-y-auto py-4 max-h-[46vh]">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
        ) : messages.map((m) => (
          <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`mt-1 text-[10px] ${m.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {fmtTime(m.created_at)}
                {m.status === "failed" ? " · falhou" : ""}
              </p>
            </div>
          </div>
        ))}
      </CardContent>

      <div className="space-y-2 border-t border-border p-4">
        {(templates.data as any[])?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {(templates.data as any[]).slice(0, 6).map((t) => (
              <Button key={t.id} size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setDraft(t.body)}>
                {t.title}
              </Button>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escreva sua mensagem…"
            rows={2}
            className="resize-none"
          />
          <Button onClick={() => send.mutate()} disabled={!draft.trim() || send.isPending}>
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- Nova conversa ---------------- */

function NewConversationDialog({ establishmentId, onCreated }: { establishmentId: string; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(startConversation);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");

  const m = useMutation({
    mutationFn: () => fn({ data: { establishment_id: establishmentId, phone, name: name || undefined } }),
    onSuccess: (r: any) => {
      setOpen(false); setPhone(""); setName("");
      qc.invalidateQueries({ queryKey: ["conversations", establishmentId] });
      onCreated(r.conversation_id);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao iniciar."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="mr-1 h-3.5 w-3.5" />Nova</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar atendimento</DialogTitle>
          <DialogDescription>Abra uma conversa manualmente com um número de WhatsApp.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nc-phone">Telefone (com DDD)</Label>
            <Input id="nc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-0000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-name">Nome (opcional)</Label>
            <Input id="nc-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={phone.replace(/\D/g, "").length < 10 || m.isPending}>
            {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Iniciar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Conexão ---------------- */

function ConnectionPanel({ establishmentId }: { establishmentId: string }) {
  const qc = useQueryClient();
  const connFn = useServerFn(getWhatsAppConnection);
  const pairFn = useServerFn(startWhatsAppPairing);
  const refreshFn = useServerFn(refreshWhatsAppStatus);
  const discFn = useServerFn(disconnectWhatsApp);
  const [qr, setQr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["wa-connection", establishmentId],
    queryFn: () => connFn({ data: { establishment_id: establishmentId } }),
  });

  const pair = useMutation({
    mutationFn: () => pairFn({ data: { establishment_id: establishmentId } }),
    onSuccess: (r: any) => {
      setQr(r.qrCode ?? null);
      if (r.status === "connected") toast.success("WhatsApp conectado!");
      else if (!r.qrCode) toast.info("Aguardando QR do provedor. Clique em atualizar em alguns segundos.");
      qc.invalidateQueries({ queryKey: ["wa-connection", establishmentId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao conectar."),
  });

  const refresh = useMutation({
    mutationFn: () => refreshFn({ data: { establishment_id: establishmentId } }),
    onSuccess: (r: any) => {
      if (r.status === "connected") { setQr(null); toast.success("Conectado."); }
      qc.invalidateQueries({ queryKey: ["wa-connection", establishmentId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao consultar."),
  });

  const disconnect = useMutation({
    mutationFn: () => discFn({ data: { establishment_id: establishmentId } }),
    onSuccess: () => { setQr(null); qc.invalidateQueries({ queryKey: ["wa-connection", establishmentId] }); },
  });

  const c = (q.data as any)?.connection;
  const providerAvailable = (q.data as any)?.providerAvailable;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Status da conexão</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!providerAvailable && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              A integração de WhatsApp ainda não foi habilitada pela plataforma. Fale com o suporte Fidelize.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={c?.connection_status === "connected" ? "default" : "outline"}>
              {c?.connection_status ? (STATUS_CONN[c.connection_status] ?? c.connection_status) : "Não conectado"}
            </Badge>
            {c?.connected_phone ? <span className="text-muted-foreground">{c.connected_phone}</span> : null}
            {c?.suspended ? <Badge variant="destructive">Suspenso</Badge> : null}
          </div>
          {c?.last_error ? <p className="text-xs text-destructive">{c.last_error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => pair.mutate()} disabled={pair.isPending || !providerAvailable}>
              {pair.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
              Conectar / gerar QR
            </Button>
            <Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refresh.isPending ? "animate-spin" : ""}`} />Atualizar status
            </Button>
            {c ? (
              <Button variant="ghost" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                <PhoneOff className="mr-2 h-4 w-4" />Desconectar
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Parear aparelho</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {qr ? (
            <img src={qr} alt="QR Code para conectar o WhatsApp" className="mx-auto h-56 w-56 rounded-lg bg-white p-2" />
          ) : (
            <EmptyState icon={QrCode} title="Sem QR ativo" description="Clique em “Conectar / gerar QR” para exibir o código." />
          )}
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Abra o WhatsApp no celular do estabelecimento.</li>
            <li>Toque em <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong>.</li>
            <li>Aponte a câmera para o QR acima.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

const STATUS_CONN: Record<string, string> = {
  connected: "Conectado",
  connecting: "Conectando",
  qr_pending: "Aguardando leitura do QR",
  disconnected: "Desconectado",
  error: "Erro",
};

/* ---------------- Respostas rápidas ---------------- */

function TemplatesPanel({ establishmentId }: { establishmentId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTemplates);
  const saveFn = useServerFn(saveTemplate);
  const delFn = useServerFn(deleteTemplate);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const q = useQuery({
    queryKey: ["conv-templates", establishmentId],
    queryFn: () => listFn({ data: { establishment_id: establishmentId } }),
  });

  const save = useMutation({
    mutationFn: () => saveFn({ data: { establishment_id: establishmentId, title, body } }),
    onSuccess: () => { setTitle(""); setBody(""); qc.invalidateQueries({ queryKey: ["conv-templates", establishmentId] }); toast.success("Resposta salva."); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { establishment_id: establishmentId, id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conv-templates", establishmentId] }),
  });

  const rows = (q.data ?? []) as any[];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Nova resposta rápida</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-title">Título</Label>
            <Input id="tpl-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Horário de funcionamento" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-body">Mensagem</Label>
            <Textarea id="tpl-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <Button onClick={() => save.mutate()} disabled={title.trim().length < 2 || body.trim().length < 2 || save.isPending}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Suas respostas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 ? (
            <EmptyState icon={Zap} title="Nenhuma resposta rápida" description="Crie atalhos para as perguntas mais comuns do seu negócio." />
          ) : rows.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t.title}</p>
                <p className="truncate text-xs text-muted-foreground">{t.body}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => del.mutate(t.id)} aria-label={`Excluir ${t.title}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
