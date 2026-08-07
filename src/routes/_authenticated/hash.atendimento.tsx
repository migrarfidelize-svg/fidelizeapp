import { RouteLoading } from "@/components/RouteLoading";
import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { MessageSquare, Users, History, UserCheck, GitBranch, Contact, FileText, Smartphone, Settings2, Send, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getOTPTemplate, saveOTPTemplate, sendOTPTestMessage, getCRMConversations, getCRMConversationMessages, sendCRMMessage, updateCRMConversationStatus } from "@/lib/atendimento.functions";
import { ScrollArea } from "@/components/ui/scroll-area";


export const Route = createFileRoute("/_authenticated/hash/atendimento")({
  component: AtendimentoCRM,
});

function AtendimentoCRM() {
  const queryClient = useQueryClient();
  const getTemplate = useServerFn(getOTPTemplate);
  const saveTemplate = useServerFn(saveOTPTemplate);
  const sendTest = useServerFn(sendOTPTestMessage);

  const getConversations = useServerFn(getCRMConversations);
  const getMessages = useServerFn(getCRMConversationMessages);
  const sendMessage = useServerFn(sendCRMMessage);
  const updateStatus = useServerFn(updateCRMConversationStatus);

  const { data: templateData, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ["otp-template"],
    queryFn: () => getTemplate(),
  });

  const { data: conversations, isLoading: isLoadingConversations } = useQuery({
    queryKey: ["crm-conversations"],
    queryFn: () => getConversations(),
    refetchInterval: 10000,
  });

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data: messages, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["crm-messages", selectedConversationId],
    queryFn: () => selectedConversationId ? getMessages({ data: { conversationId: selectedConversationId } }) : Promise.resolve([]),
    enabled: !!selectedConversationId,
    refetchInterval: 5000,
  });

  const [otpTemplate, setOtpTemplate] = useState("");
  const [testPhone, setTestPhone] = useState("");

  useEffect(() => {
    if (templateData?.template) {
      setOtpTemplate(templateData.template);
    }
  }, [templateData]);

  const saveMutation = useMutation({
    mutationFn: (template: string) => saveTemplate({ data: { template } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["otp-template"] });
      toast.success("Template de OTP salvo com sucesso.");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar template"),
  });

  const testMutation = useMutation({
    mutationFn: () => {
      const msg = otpTemplate
        .replace("{{code}}", "123456")
        .replace("{{minutes}}", "10");
      return sendTest({ data: { phone: testPhone, message: msg } });
    },
    onSuccess: () => toast.success("Mensagem de teste enviada!"),
    onError: (err: any) => toast.error(err.message || "Erro ao enviar teste"),
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) => sendMessage({ data: { conversationId: selectedConversationId!, body } }),
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["crm-messages", selectedConversationId] });
      toast.success("Mensagem enviada.");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao enviar mensagem"),
  });

  const statusMutation = useMutation({
    mutationFn: (status: any) => updateStatus({ data: { conversationId: selectedConversationId!, status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
      toast.success("Status atualizado.");
    },
  });

  if (isLoadingTemplate || isLoadingConversations) return <RouteLoading label="Carregando CRM..." />;


  return (
    <div className="space-y-8">
      <PageHero
        icon={MessageSquare}
        eyebrow="Suporte Oficial · CRM"
        title="Atendimento Afidelize"
        subtitle="Gerencie conversas, fluxos de automação e suporte humano via WhatsApp."
      />

      <Tabs defaultValue="conversas" className="w-full">
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
            <div className="grid lg:grid-cols-[350px_1fr] gap-4 h-[650px]">
              {/* Lista de Conversas */}
              <Card className="dash-card flex flex-col overflow-hidden">
                <CardHeader className="p-4 border-b border-border/40">
                  <CardTitle className="text-sm">Recentes</CardTitle>
                </CardHeader>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {conversations?.map((conv: any) => (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversationId(conv.id)}
                        className={`w-full text-left p-3 rounded-xl transition-all ${
                          selectedConversationId === conv.id 
                            ? "bg-primary/10 border-primary/20" 
                            : "hover:bg-muted/50"
                        } border border-transparent`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-sm">{conv.customer_phone}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {conv.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.messages?.[0]?.body || "Sem mensagens"}
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </Card>

              {/* Chat Area */}
              <Card className="dash-card flex flex-col overflow-hidden relative">
                {!selectedConversationId ? (
                  <CardContent className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center space-y-2">
                      <MessageSquare className="h-12 w-12 mx-auto opacity-20" />
                      <p>Selecione uma conversa para visualizar o histórico.</p>
                    </div>
                  </CardContent>
                ) : (
                  <>
                    <CardHeader className="p-4 border-b border-border/40 flex flex-row items-center justify-between shrink-0">
                      <div>
                        <CardTitle className="text-sm">{conversations?.find((c: any) => c.id === selectedConversationId)?.customer_phone}</CardTitle>
                        <CardDescription className="text-[10px]">Atendimento em curso</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px]"
                          onClick={() => statusMutation.mutate("closed")}
                        >
                          Fechar Ticket
                        </Button>
                      </div>
                    </CardHeader>
                    
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        {messages?.map((msg: any) => (
                          <div 
                            key={msg.id} 
                            className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                          >
                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                              msg.direction === "outbound" 
                                ? "bg-primary text-primary-foreground rounded-tr-none" 
                                : "bg-muted border border-border/40 rounded-tl-none"
                            }`}>
                              {msg.body}
                              <div className="text-[9px] mt-1 opacity-70 text-right">
                                {new Date(msg.created_at).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <div className="p-4 border-t border-border/40 shrink-0 bg-card/50">
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Digite sua resposta..." 
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && sendMutation.mutate(replyText)}
                        />
                        <Button 
                          size="icon" 
                          onClick={() => sendMutation.mutate(replyText)}
                          disabled={sendMutation.isPending || !replyText}
                        >
                          {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="otp" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="dash-card">
                <CardHeader>
                  <CardTitle>Configuração de Mensagem OTP</CardTitle>
                  <CardDescription>Personalize o texto enviado no login dos clientes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="template">Template da Mensagem</Label>
                    <Textarea
                      id="template"
                      value={otpTemplate}
                      onChange={(e) => setOtpTemplate(e.target.value)}
                      rows={6}
                      className="font-mono text-sm resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Variáveis disponíveis: <code className="text-primary">{"{{code}}"}</code>, <code className="text-primary">{"{{minutes}}"}</code>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button 
                      className="gradient-brand text-primary-foreground" 
                      onClick={() => saveMutation.mutate(otpTemplate)}
                      disabled={saveMutation.isPending}
                    >
                      {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Salvar Template
                    </Button>
                  </div>

                </CardContent>
              </Card>

              <Card className="dash-card dash-card-accent">
                <CardHeader>
                  <CardTitle>Preview & Teste</CardTitle>
                  <CardDescription>Veja como o cliente receberá a mensagem.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-2xl bg-muted/30 p-4 border border-border/40 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><MessageSquare className="h-20 w-20" /></div>
                    <div className="relative z-10 whitespace-pre-wrap text-sm leading-relaxed">
                      {otpTemplate.replace("{{code}}", "123456").replace("{{minutes}}", "10")}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border/40">
                    <div className="space-y-2">
                      <Label>Enviar Mensagem de Teste</Label>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="5511999999999" 
                          className="flex-1" 
                          value={testPhone}
                          onChange={(e) => setTestPhone(e.target.value)}
                        />
                        <Button 
                          variant="outline" 
                          onClick={() => testMutation.mutate()}
                          disabled={testMutation.isPending || !testPhone}
                        >
                          {testMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <><Send className="h-4 w-4 mr-2" /> Testar</>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Fallback for other tabs */}
          {["fila", "agente", "fluxos", "contatos", "templates", "config"].map((t) => (
            <TabsContent key={t} value={t}>
              <Card className="dash-card border-dashed">
                <CardContent className="py-20 text-center text-muted-foreground uppercase tracking-widest text-xs font-semibold opacity-50">
                  Área {t} em desenvolvimento no CRM
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
