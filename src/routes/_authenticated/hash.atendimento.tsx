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
import { getOTPTemplate, saveOTPTemplate, sendOTPTestMessage } from "@/lib/atendimento.functions";


export const Route = createFileRoute("/_authenticated/hash/atendimento")({
  component: AtendimentoCRM,
});

function AtendimentoCRM() {
  const queryClient = useQueryClient();
  const getTemplate = useServerFn(getOTPTemplate);
  const saveTemplate = useServerFn(saveOTPTemplate);
  const sendTest = useServerFn(sendOTPTestMessage);

  const { data: templateData, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ["otp-template"],
    queryFn: () => getTemplate(),
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

  if (isLoadingTemplate) return <RouteLoading label="Carregando configurações..." />;


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
            <Card className="dash-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Conversas Ativas</CardTitle>
                    <CardDescription>Atendimentos em tempo real via WhatsApp global.</CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                    Provedor Global Ativo
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="h-[400px] flex items-center justify-center text-muted-foreground border-t border-border/40">
                <div className="text-center space-y-2">
                  <MessageSquare className="h-12 w-12 mx-auto opacity-20" />
                  <p>Selecione uma conversa na lista lateral para iniciar o atendimento.</p>
                </div>
              </CardContent>
            </Card>
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
