import { RouteLoading } from "@/components/RouteLoading";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, Paperclip, Reply, Smile, MoreHorizontal, User } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { MessageSquare, Users, History, UserCheck, GitBranch, Contact, FileText, Smartphone, Settings2, Send, Loader2, Play, Plus, Trash2, Edit3, MoreVertical, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCRMStats, getCRMConversations, getCRMConversationMessages, sendCRMMessage, updateCRMConversationStatus, getCRMFlows, getAgentSettings, saveAgentSettings } from "@/lib/atendimento.functions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/hash/atendimento")({
  component: AtendimentoCRM,
});

function AtendimentoCRM() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("conversas");
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isNote, setIsNote] = useState(false);

  const { data: stats } = useQuery({ queryKey: ["crm-stats"], queryFn: () => getCRMStats(), refetchInterval: 10000 });
  const { data: conversations } = useQuery({ 
    queryKey: ["crm-conversations"], 
    queryFn: () => getCRMConversations({ data: { status: "all" } }),
    refetchInterval: 5000 
  });
  const { data: flows } = useQuery({ queryKey: ["crm-flows"], queryFn: () => getCRMFlows() });
  const { data: agentData } = useQuery({ queryKey: ["crm-agent-settings"], queryFn: () => getAgentSettings() });
  const { data: messages } = useQuery({ 
    queryKey: ["crm-messages", selectedConversation?.id], 
    queryFn: () => getCRMConversationMessages({ data: { conversationId: selectedConversation.id } }),
    enabled: !!selectedConversation?.id,
    refetchInterval: 3000
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
                                    className={cn(
                                        "w-full text-left p-3 rounded-xl transition-all border border-transparent flex gap-3",
                                        "hover:bg-muted/50"
                                    )}
                                >
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <User className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-0.5">
                                            <span className="font-semibold text-sm truncate">{conv.customer_phone}</span>
                                            <span className="text-[10px] text-muted-foreground">14:20</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">{conv.messages?.[0]?.body || "Sem mensagens"}</p>
                                    </div>
                                    {conv.unread_count > 0 && (
                                        <Badge className="h-5 min-w-[20px] rounded-full px-1 justify-center bg-primary text-[10px]">{conv.unread_count}</Badge>
                                    )}
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </Card>

                {/* CENTRO: Chat */}
                <Card className="dash-card flex flex-col overflow-hidden relative">
                    <CardHeader className="p-4 border-b flex flex-row items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-sm">99 99999-9999</CardTitle>
                                <CardDescription className="text-[10px] flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-green-500" /> Atendimento em curso
                                </CardDescription>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <Button variant="outline" size="sm" className="h-8 text-xs">Assumir</Button>
                             <Button variant="outline" size="sm" className="h-8 text-xs text-destructive">Encerrar</Button>
                        </div>
                    </CardHeader>

                    <ScrollArea className="flex-1 p-4 bg-muted/10">
                        <div className="space-y-6">
                            {/* Empty State Premium Mock if no selected */}
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 mt-40">
                                <MessageSquare className="h-16 w-16 mb-4" />
                                <p>Selecione uma conversa para iniciar o atendimento</p>
                            </div>
                        </div>
                    </ScrollArea>

                    <div className="p-4 border-t bg-card/50">
                        <div className="flex gap-2 items-end">
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl shrink-0"><Paperclip className="h-5 w-5" /></Button>
                            <div className="flex-1 bg-muted/50 rounded-xl border border-border p-2 min-h-[44px]">
                                <Textarea 
                                    placeholder="Digite sua mensagem ou '/' para respostas rápidas..." 
                                    className="border-0 bg-transparent resize-none focus-visible:ring-0 min-h-[20px] p-1 text-sm"
                                    rows={1}
                                />
                            </div>
                            <Button className="h-10 w-10 rounded-xl gradient-brand shrink-0"><Send className="h-5 w-5" /></Button>
                        </div>
                    </div>
                </Card>

                {/* DIREITA: Dados */}
                <div className="space-y-4">
                    <Card className="dash-card p-4 space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sobre o Contato</h4>
                        <div className="space-y-3">
                            <div><Label className="text-[10px] text-muted-foreground uppercase">Tipo</Label><div className="text-sm font-medium">Cliente</div></div>
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

                    <Card className="dash-card p-4 flex-1">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Notas Internas</h4>
                        <div className="space-y-3 mb-4 max-h-[200px] overflow-auto">
                            <p className="text-[10px] text-muted-foreground text-center italic">Nenhuma nota interna adicionada.</p>
                        </div>
                        <Button variant="outline" size="sm" className="w-full text-xs"><Plus className="h-3 w-3 mr-2" /> Adicionar Nota</Button>
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
            <div className="grid md:grid-cols-2 gap-6">
                <Card className="dash-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserCheck className="h-5 w-5 text-primary" /> Identidade do Agente
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/40">
                            <div>
                                <Label className="text-sm font-bold">Status do Agente</Label>
                                <p className="text-[10px] text-muted-foreground">Define se o bot deve responder novas mensagens.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={cn("h-2 w-2 rounded-full", agentSettings?.enabled ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30")} />
                                <Switch checked={agentSettings?.enabled} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Nome do Assistente</Label>
                            <Input defaultValue={agentSettings?.name} placeholder="Ex: Assistente Afidelize" />
                        </div>
                        <div className="space-y-2">
                            <Label>Mensagem de Apresentação</Label>
                            <Textarea defaultValue={agentSettings?.presentation} rows={3} placeholder="Olá! 👋 Sou o assistente..." />
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="dash-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings2 className="h-5 w-5 text-primary" /> Comportamento
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3">
                            <div className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/30 transition-colors">
                                <div className="space-y-0.5"><Label className="text-sm">Responder automaticamente</Label><p className="text-[10px] text-muted-foreground">Habilitar IA/Bot para respostas.</p></div>
                                <Switch defaultChecked={agentSettings?.behavior?.autoReply} />
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/30 transition-colors">
                                <div className="space-y-0.5"><Label className="text-sm">Atender novos contatos</Label><p className="text-[10px] text-muted-foreground">Iniciar conversa automaticamente.</p></div>
                                <Switch defaultChecked={agentSettings?.behavior?.welcomeNew} />
                            </div>
                        </div>
                        <div className="space-y-2 pt-2 border-t">
                            <Label>Tempo sem resposta (Timeout)</Label>
                            <div className="flex gap-2">
                                <Select defaultValue={String(agentSettings?.behavior?.timeoutMinutes || "10")}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="5">5 minutos</SelectItem>
                                        <SelectItem value="10">10 minutos</SelectItem>
                                        <SelectItem value="30">30 minutos</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select defaultValue={agentSettings?.behavior?.timeoutAction || "transfer_to_queue"}>
                                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="transfer_to_queue">Transferir para fila</SelectItem>
                                        <SelectItem value="end">Encerrar</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
          </TabsContent>

          <TabsContent value="fluxos" className="space-y-6">
            <div className="flex justify-between items-center bg-card p-6 rounded-2xl border border-border shadow-sm">
                <div className="space-y-1">
                    <h3 className="text-lg font-bold">Gerenciador de Fluxos</h3>
                    <p className="text-xs text-muted-foreground">Desenhe caminhos de atendimento personalizados.</p>
                </div>
                <Button className="gradient-brand shadow-lg shadow-primary/20"><Plus className="h-4 w-4 mr-2" /> Novo Fluxo</Button>
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
                                <Button variant="secondary" size="sm" className="flex-1 text-xs h-8"><Edit3 className="h-3 w-3 mr-2" /> Editar</Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
