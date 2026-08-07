import { RouteLoading } from "@/components/RouteLoading";
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

  const { data: stats } = useQuery({ queryKey: ["crm-stats"], queryFn: () => getCRMStats() });
  const { data: conversations } = useQuery({ queryKey: ["crm-conversations"], queryFn: () => getCRMConversations({ data: { status: "all" } }) });
  const { data: flows } = useQuery({ queryKey: ["crm-flows"], queryFn: () => getCRMFlows() });
  const { data: agentSettings } = useQuery({ queryKey: ["crm-agent-settings"], queryFn: () => getAgentSettings() });

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
          <TabsContent value="agente" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
                <Card className="dash-card">
                    <CardHeader>
                        <CardTitle>Identidade do Agente</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>Ativar Agente Automático</Label>
                            <Switch checked={agentSettings?.enabled} />
                        </div>
                        <div className="space-y-2">
                            <Label>Nome do Assistente</Label>
                            <Input defaultValue={agentSettings?.name} />
                        </div>
                        <div className="space-y-2">
                            <Label>Mensagem de Apresentação</Label>
                            <Textarea defaultValue={agentSettings?.presentation} rows={3} />
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="dash-card">
                    <CardHeader>
                        <CardTitle>Comportamento</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center"><Label>Responder automaticamente</Label><Switch defaultChecked /></div>
                        <div className="flex justify-between items-center"><Label>Atender novos contatos</Label><Switch defaultChecked /></div>
                        <div className="flex justify-between items-center"><Label>Responder conhecidos</Label><Switch defaultChecked /></div>
                        <div className="space-y-2">
                            <Label>Ação após timeout (ex: 5 min)</Label>
                            <Select defaultValue="transfer_to_queue">
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="transfer_to_queue">Transferir para fila</SelectItem>
                                    <SelectItem value="end">Encerrar</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>
            </div>
          </TabsContent>

          <TabsContent value="fluxos" className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Automação de Fluxos</h3>
                <Button className="gradient-brand"><Plus className="h-4 w-4 mr-2" /> Novo Fluxo</Button>
            </div>
            {flows?.length === 0 ? (
                <div className="py-20 border-2 border-dashed rounded-2xl text-center text-muted-foreground">
                    <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum fluxo criado.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {flows?.map((f: any) => (
                        <div key={f.id} className="flex items-center justify-between bg-card p-4 rounded-xl border border-border">
                            <div>
                                <div className="font-semibold">{f.name}</div>
                                <div className="text-xs text-muted-foreground">Última edição: {new Date(f.updated_at).toLocaleDateString()}</div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm"><Edit3 className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
