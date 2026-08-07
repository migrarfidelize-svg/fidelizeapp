import { RouteLoading } from "@/components/RouteLoading";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, Paperclip, Reply, Smile, MoreHorizontal, User } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { MessageSquare, Users, History, UserCheck, GitBranch, Contact, FileText, Smartphone, Settings2, Send, Loader2, Play, Plus, Trash2, Edit3, MoreVertical, CheckCircle2, Copy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getCRMStats, getCRMConversations, getCRMConversationMessages, sendCRMMessage, 
  updateCRMConversationStatus, getCRMFlows, getAgentSettings, saveAgentSettings,
  deleteCRMFlow, duplicateCRMFlow, getCRMContacts, getCRMQuickReplies, saveCRMQuickReply,
  getOTPTemplate, saveOTPTemplate, sendOTPTestMessage
} from "@/lib/atendimento.functions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FlowEditor } from "@/components/crm/FlowEditor";
import { FlowSimulator } from "@/components/crm/FlowSimulator";
import { QuickRepliesManager } from "@/components/crm/QuickReplies";
import { OTPEditor } from "@/components/crm/OTPEditor";
import { AgentConfig } from "@/components/crm/AgentConfig";
import { ContactManager } from "@/components/crm/ContactManager";
import { TemplateManager } from "@/components/crm/TemplateManager";
import { useCRMRealtime } from "@/hooks/use-crm-realtime";


export const Route = createFileRoute("/_authenticated/hash/atendimento")({
  component: AtendimentoCRM,
});

function AtendimentoCRM() {
  const queryClient = useQueryClient();
  useCRMRealtime();
  const [activeTab, setActiveTab] = useState("conversas");
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [editingFlow, setEditingFlow] = useState<any>(null);
  const [simulatingFlow, setSimulatingFlow] = useState<any>(null);

  const { data: stats } = useQuery({ queryKey: ["crm-stats"], queryFn: () => getCRMStats() });
  const { data: conversations } = useQuery({ 
    queryKey: ["crm-conversations"], 
    queryFn: () => getCRMConversations({ data: { status: "all" } })
  });
  const { data: flows } = useQuery({ queryKey: ["crm-flows"], queryFn: () => getCRMFlows() });
  const { data: agentData } = useQuery({ queryKey: ["crm-agent-settings"], queryFn: () => getAgentSettings() });
  const { data: replies } = useQuery({ queryKey: ["crm-quick-replies"], queryFn: () => getCRMQuickReplies() });
  const { data: messages } = useQuery({ 
    queryKey: ["crm-messages", selectedConversation?.id], 
    queryFn: () => getCRMConversationMessages({ data: { conversationId: selectedConversation.id } }),
    enabled: !!selectedConversation?.id
  });

  const sendMessageMutation = useMutation({
    mutationFn: (vars: { body: string; isNote?: boolean }) => 
      sendCRMMessage({ data: { conversationId: selectedConversation.id, body: vars.body, isNote: vars.isNote } }),
    onSuccess: () => {
      setMessageInput("");
      queryClient.invalidateQueries({ queryKey: ["crm-messages", selectedConversation?.id] });
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
      toast.success(isNote ? "Nota adicionada" : "Mensagem enviada");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao enviar")
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: any) => 
      updateCRMConversationStatus({ data: { conversationId: selectedConversation.id, status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["crm-stats"] });
      toast.success("Status atualizado");
    }
  });

  const agentSettings = agentData as any;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <PageHero
          icon={MessageSquare}
          eyebrow="Suporte Oficial · CRM"
          title="Atendimento Afidelize"
          subtitle="Gerencie conversas, fluxos de automação e suporte humano via WhatsApp."
        />
        <div className="grid grid-cols-5 gap-4">
            {[ { label: "Abertas", val: stats?.open || 0 }, { label: "Na fila", val: stats?.waiting || 0 }, { label: "Em atendimento", val: stats?.assigned || 0 }, { label: "Resolvidas", val: stats?.resolvedToday || 0 }, { label: "T. Espera", val: stats?.avgWaitTime || 0 } ].map(s => (
                <div key={s.label} className="bg-card border border-border p-3 rounded-xl min-w-[120px]">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">{s.label}</div>
                    <div className="text-2xl font-bold">{s.val}</div>
                </div>
            ))}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 lg:grid-cols-8 h-auto gap-2 bg-transparent p-0">
          {[
            { id: "conversas", label: "Conversas", icon: MessageSquare },
            { id: "fila", label: "Fila", icon: History },
            { id: "agente", label: "Agente", icon: UserCheck },
            { id: "fluxos", label: "Fluxos", icon: GitBranch },
            { id: "contatos", label: "Contatos", icon: Contact },
            { id: "templates", label: "Templates", icon: FileText },
            { id: "otp", label: "OTP", icon: Smartphone },
            { id: "config", label: "Config", icon: Settings2 },
          ].map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex flex-col items-center gap-1.5 py-3 px-2 data-[state=active]:bg-card data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border rounded-xl transition-all"
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium uppercase tracking-wider">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-8">
          <TabsContent value="conversas" className="space-y-4">
            <div className="grid lg:grid-cols-[350px_1fr_300px] gap-4 h-[750px] overflow-hidden">
                {/* ESQUERDA: Lista de Conversas */}
                <Card className="dash-card flex flex-col overflow-hidden">
                    <CardHeader className="p-4 border-b">
                        <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-xl">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Nome ou telefone..." className="border-0 bg-transparent h-7 focus-visible:ring-0 text-sm" />
                            <Filter className="h-4 w-4 text-muted-foreground cursor-pointer" />
                        </div>
                    </CardHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-1">
                            {conversations?.map((conv: any) => (
                                <button
                                    key={conv.id}
                                    onClick={() => setSelectedConversation(conv)}
                                    className={cn(
                                        "w-full text-left p-3 rounded-xl transition-all border border-transparent flex gap-3",
                                        selectedConversation?.id === conv.id ? "bg-primary/10 border-primary/20 shadow-sm" : "hover:bg-muted/50"
                                    )}
                                >
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                        <User className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-0.5">
                                            <span className="font-semibold text-sm truncate">{conv.customer_phone}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">{conv.messages?.[0]?.body || "Sem mensagens"}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <Badge variant="outline" className={cn("text-[8px] px-1 h-4 uppercase", 
                                            conv.status === 'waiting' ? 'border-orange-500 text-orange-600 bg-orange-50' : 
                                            conv.status === 'assigned' ? 'border-blue-500 text-blue-600 bg-blue-50' : ''
                                        )}>
                                            {conv.status}
                                        </Badge>
                                        {conv.unread_count > 0 && (
                                            <Badge className="h-4 min-w-[16px] rounded-full px-1 justify-center bg-primary text-[8px]">{conv.unread_count}</Badge>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </Card>

                {/* CENTRO: Chat */}
                <Card className="dash-card flex flex-col overflow-hidden relative">
                    {!selectedConversation ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 p-8 text-center">
                            <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mb-6">
                                <MessageSquare className="h-10 w-10" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground opacity-100">Central de Atendimento</h3>
                            <p className="max-w-[250px] mt-2">Selecione uma conversa na lista lateral para visualizar o histórico e responder.</p>
                        </div>
                    ) : (
                        <>
                            <CardHeader className="p-4 border-b flex flex-row items-center justify-between shrink-0 bg-card/80 backdrop-blur-md sticky top-0 z-10">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                        <User className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-sm">{selectedConversation.customer_phone}</CardTitle>
                                        <CardDescription className="text-[10px] flex items-center gap-1.5">
                                            <span className={cn("h-2 w-2 rounded-full", 
                                                selectedConversation.status === 'assigned' ? "bg-green-500 animate-pulse" : "bg-orange-500"
                                            )} /> 
                                            {selectedConversation.status === 'assigned' ? 'Em atendimento' : 'Aguardando'}
                                        </CardDescription>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                     {selectedConversation.status === 'waiting' && (
                                         <Button 
                                            size="sm" 
                                            className="h-8 text-xs gradient-brand"
                                            onClick={() => updateStatusMutation.mutate('assigned')}
                                            disabled={updateStatusMutation.isPending}
                                         >
                                            Assumir
                                         </Button>
                                     )}
                                     <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-8 text-xs text-destructive border-destructive/20 hover:bg-destructive/5"
                                        onClick={() => {
                                            if(confirm("Deseja encerrar este atendimento?")) {
                                                updateStatusMutation.mutate('closed');
                                                setSelectedConversation(null);
                                            }
                                        }}
                                        disabled={updateStatusMutation.isPending}
                                     >
                                        Encerrar
                                     </Button>
                                </div>
                            </CardHeader>

                            <ScrollArea className="flex-1 p-4 bg-muted/5">
                                <div className="space-y-4">
                                    {messages?.map((msg: any, i: number) => (
                                        <div key={i} className={cn(
                                            "flex w-full",
                                            msg.type === 'note' ? "justify-center" : 
                                            msg.direction === 'inbound' ? "justify-start" : "justify-end"
                                        )}>
                                            {msg.type === 'note' ? (
                                                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] px-4 py-1.5 rounded-full font-medium shadow-sm flex items-center gap-2">
                                                    <Edit3 className="h-3 w-3" /> NOTA INTERNA: {msg.content}
                                                </div>
                                            ) : (
                                                <div className={cn(
                                                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                                                    msg.direction === 'inbound' 
                                                        ? "bg-card border border-border text-foreground rounded-tl-none" 
                                                        : "bg-primary text-primary-foreground rounded-tr-none"
                                                )}>
                                                    <div className="whitespace-pre-wrap">{msg.body}</div>
                                                    <div className={cn(
                                                        "text-[8px] mt-1 text-right opacity-60",
                                                        msg.direction === 'inbound' ? "text-muted-foreground" : "text-primary-foreground"
                                                    )}>
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {sendMessageMutation.isPending && !isNote && (
                                        <div className="flex justify-end opacity-50">
                                            <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-4 py-2 text-sm">
                                                Enviando...
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>

                            <div className="p-4 border-t bg-card/80 backdrop-blur-md">
                                {isNote && (
                                    <div className="mb-2 flex items-center gap-2 text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
                                        <Edit3 className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-bold uppercase">Modo Nota Interna Ativo</span>
                                        <Button variant="ghost" size="sm" className="h-5 text-[9px] ml-auto" onClick={() => setIsNote(false)}>Cancelar</Button>
                                    </div>
                                )}
                                <div className="flex gap-2 items-end">
                                    <Button 
                                        variant={isNote ? "default" : "ghost"} 
                                        size="icon" 
                                        className={cn("h-10 w-10 rounded-xl shrink-0 transition-colors", isNote && "bg-amber-500 hover:bg-amber-600 text-white")}
                                        onClick={() => setIsNote(!isNote)}
                                        title="Alternar entre Mensagem e Nota Interna"
                                    >
                                        <Edit3 className="h-5 w-5" />
                                    </Button>
                                    <div className="flex-1 bg-muted/50 rounded-xl border border-border p-2 focus-within:border-primary/30 transition-all">
                                    {messageInput.startsWith("/") && (
                                        <div className="absolute bottom-full left-0 w-full bg-card border border-primary/20 shadow-2xl rounded-t-xl overflow-hidden z-20">
                                            <ScrollArea className="max-h-[200px]">
                                                <div className="p-2 space-y-1">
                                                    {replies?.filter(r => r.shortcut.startsWith(messageInput)).map(r => (
                                                        <button 
                                                            key={r.id} 
                                                            className="w-full text-left p-2 hover:bg-primary/10 rounded-lg text-xs flex justify-between"
                                                            onClick={() => setMessageInput(r.message)}
                                                        >
                                                            <span className="font-bold text-primary">{r.shortcut}</span>
                                                            <span className="text-muted-foreground truncate ml-4">{r.message}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    )}
                                        <Textarea 
                                            placeholder={isNote ? "Escreva uma nota para a equipe..." : "Digite sua mensagem..."}
                                            className="border-0 bg-transparent resize-none focus-visible:ring-0 min-h-[24px] p-1 text-sm scrollbar-none"
                                            rows={2}
                                            value={messageInput}
                                            onChange={(e) => setMessageInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    if(messageInput.trim()) sendMessageMutation.mutate({ body: messageInput, isNote });
                                                }
                                            }}
                                        />
                                    </div>
                                    <Button 
                                        className={cn("h-10 w-10 rounded-xl shrink-0 shadow-lg", isNote ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20" : "gradient-brand shadow-primary/20")}
                                        disabled={!messageInput.trim() || sendMessageMutation.isPending}
                                        onClick={() => sendMessageMutation.mutate({ body: messageInput, isNote })}
                                    >
                                        {sendMessageMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </Card>

                {/* DIREITA: Dados */}
                <div className="space-y-4 h-full overflow-auto pr-1">
                    <Card className="dash-card p-4 space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sobre o Contato</h4>
                        <div className="space-y-3">
                            <div><Label className="text-[10px] text-muted-foreground uppercase">Telefone</Label><div className="text-sm font-medium">{selectedConversation?.customer_phone || '-'}</div></div>
                            <div><Label className="text-[10px] text-muted-foreground uppercase">Status</Label>
                                <div className="mt-1">
                                    <Badge variant="outline" className="capitalize">{selectedConversation?.status || 'Nenhum'}</Badge>
                                </div>
                            </div>
                            <div><Label className="text-[10px] text-muted-foreground uppercase">Prioridade</Label>
                                <Select defaultValue="medium">
                                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Baixa</SelectItem>
                                        <SelectItem value="medium">Média</SelectItem>
                                        <SelectItem value="high">Alta</SelectItem>
                                        <SelectItem value="urgent">Urgente</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </Card>

                    <Card className="dash-card p-4 flex flex-col min-h-[250px]">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Notas Internas Recentes</h4>
                        <ScrollArea className="flex-1 mb-4">
                            <div className="space-y-3 pr-3">
                                {messages?.filter((m: any) => m.type === 'note').length === 0 ? (
                                    <p className="text-[10px] text-muted-foreground text-center italic mt-10">Nenhuma nota interna.</p>
                                ) : (
                                    messages?.filter((m: any) => m.type === 'note').slice(-5).reverse().map((note: any, idx: number) => (
                                        <div key={idx} className="bg-amber-50/50 p-2 rounded border border-amber-100/50">
                                            <p className="text-[10px] text-amber-900 leading-relaxed">{note.content}</p>
                                            <div className="text-[8px] text-amber-700 mt-1 flex justify-between">
                                                <span>Admin</span>
                                                <span>{new Date(note.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                            onClick={() => {
                                setIsNote(true);
                                setActiveTab("conversas");
                            }}
                        >
                            <Plus className="h-3 w-3 mr-2" /> Nova Nota
                        </Button>
                    </Card>

                    <Card className="dash-card p-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Tags</h4>
                        <div className="flex flex-wrap gap-1.5">
                            <Badge variant="secondary" className="text-[9px] cursor-pointer hover:bg-muted">Dúvida</Badge>
                            <Badge variant="secondary" className="text-[9px] cursor-pointer hover:bg-muted">Reclamação</Badge>
                            <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full"><Plus className="h-3 w-3" /></Button>
                        </div>
                    </Card>
                </div>
            </div>
          </TabsContent>

          <TabsContent value="fila" className="space-y-6">
            <div className="grid gap-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" /> Aguardando Atendimento
                </h3>
                {stats?.waiting === 0 ? (
                    <Card className="dash-card p-12 text-center text-muted-foreground border-dashed">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>Nenhuma conversa na fila neste momento.</p>
                    </Card>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {conversations?.filter((c: any) => c.status === "waiting").map((c: any) => (
                             <Card key={c.id} className="dash-card p-4 hover:border-primary/40 transition-all cursor-pointer group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <User className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold">{c.customer_phone}</div>
                                            <div className="text-[10px] text-muted-foreground">Iniciado há 12 min</div>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] uppercase">Média</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2 mb-4 italic">"{c.messages?.[0]?.body || '...'}"</p>
                                <Button className="w-full h-8 text-xs gradient-brand">Assumir Atendimento</Button>
                             </Card>
                        ))}
                    </div>
                )}
            </div>
          </TabsContent>

          <TabsContent value="agente" className="space-y-6">
            <AgentConfig />
          </TabsContent>

          <TabsContent value="fluxos" className="space-y-6">
            {editingFlow ? (
              <FlowEditor flow={editingFlow} onBack={() => setEditingFlow(null)} />
            ) : simulatingFlow ? (
              <div className="space-y-4">
                <Button variant="ghost" onClick={() => setSimulatingFlow(null)}>Voltar para lista</Button>
                <FlowSimulator flow={simulatingFlow} />
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center bg-card p-6 rounded-2xl border border-border shadow-sm">
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold">Gerenciador de Fluxos</h3>
                        <p className="text-xs text-muted-foreground">Desenhe caminhos de atendimento personalizados.</p>
                    </div>
                    <Button onClick={() => setEditingFlow({ name: "Novo Fluxo", steps: [] })} className="gradient-brand shadow-lg shadow-primary/20"><Plus className="h-4 w-4 mr-2" /> Novo Fluxo</Button>
                </div>
                {flows?.length === 0 ? (
                    <Card className="dash-card py-20 text-center text-muted-foreground border-dashed border-2">
                        <div className="bg-primary/5 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <GitBranch className="h-10 w-10 text-primary opacity-40" />
                        </div>
                        <h4 className="text-base font-bold text-foreground mb-1">Nenhum fluxo encontrado</h4>
                        <p className="text-sm max-w-[300px] mx-auto">Comece criando um fluxo de boas-vindas para seus clientes.</p>
                    </Card>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {flows?.map((f: any) => (
                            <Card key={f.id} className="dash-card overflow-hidden hover:border-primary/40 transition-all group">
                                <div className="p-5 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                                            <GitBranch className="h-6 w-6 text-primary" />
                                        </div>
                                        <Badge variant={f.is_active ? "default" : "secondary"} className="text-[10px] uppercase font-bold px-2">
                                            {f.is_active ? "Ativo" : "Rascunho"}
                                        </Badge>
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-sm line-clamp-1">{f.name}</h4>
                                        <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">{f.description || 'Sem descrição'}</p>
                                    </div>
                                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-medium pt-2 border-t">
                                        <div className="flex items-center gap-1"><History className="h-3 w-3" /> {new Date(f.updated_at).toLocaleDateString()}</div>
                                        <div className="flex items-center gap-1"><Users className="h-3 w-3" /> 0 execs</div>
                                    </div>
                                </div>
                                <div className="bg-muted/30 p-2 flex gap-2 border-t border-border/40">
                                    <Button variant="secondary" size="sm" className="flex-1 text-xs h-8" onClick={() => setEditingFlow(f)}><Edit3 className="h-3 w-3 mr-2" /> Editar</Button>
                                    <Button variant="outline" size="sm" className="h-8 w-8 px-0" onClick={() => setSimulatingFlow(f)}><Play className="h-3.5 w-3.5" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="config" className="space-y-6">
            <QuickRepliesManager />
          </TabsContent>

          <TabsContent value="contatos" className="space-y-6">
            <ContactManager onSelectConversation={(contact) => {
              const existing = conversations?.find((c: any) => c.customer_phone === contact.phone);
              if (existing) {
                setSelectedConversation(existing);
                setActiveTab("conversas");
              } else {
                toast.info("Este contato ainda não possui histórico de conversa.");
              }
            }} />
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <TemplateManager />
          </TabsContent>

        </div>
      </Tabs>
    </div>
  );
}
