import React, { useState, useEffect } from "react";
import { UserCheck, Save, Settings2, Clock, MessageSquare, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAgentSettings, saveAgentSettings, getCRMFlows } from "@/lib/atendimento.functions";
import { toast } from "sonner";

export function AgentConfig() {
  const queryClient = useQueryClient();
  const { data: currentSettings } = useQuery({ queryKey: ["crm-agent-settings"], queryFn: () => getAgentSettings() });
  const { data: flows } = useQuery({ queryKey: ["crm-flows"], queryFn: () => getCRMFlows() });
  
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    if (currentSettings) setSettings(currentSettings);
  }, [currentSettings]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => saveAgentSettings({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-agent-settings"] });
      toast.success("Configurações do Agente salvas!");
    }
  });

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-primary/20 shadow-sm">
         <div className="flex items-center gap-3">
            <div className={settings.enabled ? "text-green-500" : "text-muted-foreground"}>
               <UserCheck className="h-6 w-6" />
            </div>
            <div>
               <h4 className="text-sm font-bold">Status da Inteligência Artificial</h4>
               <p className="text-[10px] text-muted-foreground uppercase">{settings.enabled ? "Ativo e Respondendo" : "Agente Inativo"}</p>
            </div>
         </div>
         <Switch checked={settings.enabled} onCheckedChange={(val) => setSettings({...settings, enabled: val})} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
         <Card className="dash-card">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Settings2 className="h-4 w-4" /> Configurações Gerais</CardTitle></CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-2">
                  <Label>Nome do Assistente</Label>
                  <Input value={settings.name} onChange={e => setSettings({...settings, name: e.target.value})} />
               </div>
               <div className="space-y-2">
                  <Label>Mensagem Inicial / Apresentação</Label>
                  <Textarea value={settings.presentation} onChange={e => setSettings({...settings, presentation: e.target.value})} rows={3} />
               </div>
               <div className="space-y-2">
                  <Label>Fluxo Principal (Bot)</Label>
                  <Select value={settings.behavior?.mainFlowId} onValueChange={val => setSettings({...settings, behavior: {...settings.behavior, mainFlowId: val}})}>
                     <SelectTrigger><SelectValue placeholder="Selecione um fluxo..." /></SelectTrigger>
                     <SelectContent>
                        {flows?.map((f: any) => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>
            </CardContent>
         </Card>

         <Card className="dash-card">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Handoff (Bot -> Humano)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-2">
                  <Label>Palavras de Transferência (CSV)</Label>
                  <Input 
                    value={settings.handoff?.keywords?.join(", ")} 
                    onChange={e => setSettings({...settings, handoff: {...settings.handoff, keywords: e.target.value.split(",").map((s: string) => s.trim())}})} 
                    placeholder="humano, atendente, suporte..."
                  />
               </div>
               <div className="space-y-2">
                  <Label>Mensagem de Fallback (Erro)</Label>
                  <Textarea value={settings.fallback?.message} onChange={e => setSettings({...settings, fallback: {...settings.fallback, message: e.target.value}})} rows={2} />
               </div>
               <div className="flex justify-between items-center p-2 rounded-lg bg-muted/30">
                  <Label className="text-xs">Máximo de falhas antes de transferir</Label>
                  <Input className="w-16 h-8 text-center" type="number" value={settings.fallback?.maxFailures} onChange={e => setSettings({...settings, fallback: {...settings.fallback, maxFailures: Number(e.target.value)}})} />
               </div>
            </CardContent>
         </Card>
      </div>

      <Button className="w-full gradient-brand py-6" onClick={() => saveMutation.mutate(settings)} disabled={saveMutation.isPending}>
         <Save className="h-5 w-5 mr-2" /> Salvar Todas as Configurações
      </Button>
    </div>
  );
}
