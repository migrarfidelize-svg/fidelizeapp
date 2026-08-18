import React, { useState, useEffect } from "react";
import { UserCheck, Save, Settings2, AlertTriangle, ShieldCheck, Zap, Bot, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAgentSettings, saveAgentSettings, getCRMFlows } from "@/lib/atendimento.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function AgentConfig() {
  const queryClient = useQueryClient();
  const { data: currentSettings, isLoading } = useQuery({ queryKey: ["crm-agent-settings"], queryFn: () => getAgentSettings() });
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

  if (isLoading || !settings) return (
    <div className="flex flex-col items-center justify-center h-full opacity-40 py-20">
      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
      <span className="text-sm font-bold uppercase tracking-widest">Carregando Agente Inteligente...</span>
    </div>
  );

  return (
    <div className="bg-background min-h-full p-6 lg:p-8">
      {/* Header Central do Agente */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 bg-card p-6 border rounded-xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
            <Bot className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">Central do Agente Autônomo</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={cn(
                "h-2 w-2 rounded-full",
                (settings.enabled && settings.providerUsable) ? "bg-green-500 animate-pulse" : "bg-muted"
              )} />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {settings.enabled ? (settings.providerUsable ? "Processamento Ativo" : "Provider de IA pendente") : "OFFLINE / Agente em Standby"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 bg-muted/30 px-6 py-3 rounded-xl border border-border/50">
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">IA Engine</span>
            <span className="text-xs font-bold">
              {!settings.enabled ? "OFFLINE" : (settings.providerUsable ? "ONLINE" : "PENDENTE")}
            </span>
          </div>
          <Switch 
            checked={settings.enabled} 
            onCheckedChange={(val) => setSettings({...settings, enabled: val})} 
            className="data-[state=checked]:bg-green-500"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* COLUNA ESQUERDA: Configurações Principais */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* IDENTIDADE E COMPORTAMENTO */}
          <div className="crm-card">
            <div className="p-6 border-b">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <Settings2 className="h-4 w-4" /> Identidade e Comportamento
              </h4>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Nome do Assistente</Label>
                  <Input 
                    value={settings.name} 
                    onChange={e => setSettings({...settings, name: e.target.value})}
                    className="h-11 font-bold bg-muted/20 border-border/50"
                    placeholder="Ex: Maya Assistente"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Fluxo Principal (Base de Conhecimento)</Label>
                  <Select 
                    value={settings.behavior?.mainFlowId || ""} 
                    onValueChange={val => setSettings({...settings, behavior: {...(settings.behavior || {}), mainFlowId: val}})}
                  >
                    <SelectTrigger className="h-11 bg-muted/20 border-border/50 font-bold">
                      <SelectValue placeholder="Selecione um fluxo automatizado..." />
                    </SelectTrigger>
                    <SelectContent>
                      {flows?.map((f: any) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">IA Provider</label>
                  <Select 
                    value={settings.provider_id || ""} 
                    onValueChange={val => setSettings({...settings, provider_id: val})}
                  >
                    <SelectTrigger className="h-11 bg-muted/20 border-border/50 font-bold">
                      <SelectValue placeholder="Selecione um provedor..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
                      <SelectItem value="groq">Groq (Llama 3 / Mixtral)</SelectItem>
                      <SelectItem value="deepseek">DeepSeek</SelectItem>
                      <SelectItem value="openrouter">OpenRouter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Modelo (Opcional)</label>
                  <Input 
                    value={settings.model || ""} 
                    onChange={e => setSettings({...settings, model: e.target.value})}
                    className="h-11 font-bold bg-muted/20 border-border/50"
                    placeholder="Ex: gpt-4o-mini"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">System Prompt (Diretrizes do Agente)</label>
                <Textarea 
                  value={settings.systemPrompt} 
                  onChange={e => setSettings({...settings, systemPrompt: e.target.value})} 
                  rows={6} 
                  className="bg-muted/20 border-border/50 resize-none leading-relaxed text-sm"
                  placeholder="Você é o Assistente Virtual da Fidelize..."
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Mensagem de Apresentação</Label>
                <Textarea 
                  value={settings.presentation} 
                  onChange={e => setSettings({...settings, presentation: e.target.value})} 
                  rows={3} 
                  className="bg-muted/20 border-border/50 resize-none leading-relaxed"
                  placeholder="Olá! Sou o assistente virtual da Afidelize. Como posso ajudar?"
                />
              </div>
            </div>
          </div>

          {/* HANDOFF E FALLBACK */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="crm-card">
              <div className="p-6 border-b">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <Zap className="h-4 w-4" /> Handoff Humano
                </h4>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Palavras-chave de Transferência</Label>
                  <Input 
                    value={settings.handoff?.keywords?.join(", ")} 
                    onChange={e => setSettings({...settings, handoff: {...settings.handoff, keywords: e.target.value.split(",").map((s: string) => s.trim())}})} 
                    placeholder="atendente, humano, suporte, falar com alguém"
                    className="h-11 bg-muted/20 border-border/50 font-medium"
                  />
                  <p className="text-[9px] text-muted-foreground leading-tight">Separe termos por vírgula. A IA detectará essas intenções e enviará para a fila humana.</p>
                </div>
              </div>
            </div>

            <div className="crm-card">
              <div className="p-6 border-b">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Segurança (Fallback)
                </h4>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Mensagem de Erro / Não Compreendido</Label>
                  <Textarea 
                    value={settings.fallback?.message} 
                    onChange={e => setSettings({...settings, fallback: {...settings.fallback, message: e.target.value}})} 
                    rows={2} 
                    className="bg-muted/20 border-border/50 text-xs resize-none"
                    placeholder="Desculpe, não entendi. Pode repetir de outra forma?"
                  />
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg border border-border/50">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Limite de Falhas</Label>
                    <p className="text-[9px] text-muted-foreground">Tentativas antes da transferência automática.</p>
                  </div>
                  <Input 
                    className="w-16 h-9 text-center font-black bg-background border-border" 
                    type="number" 
                    value={settings.fallback?.maxFailures} 
                    onChange={e => setSettings({...settings, fallback: {...settings.fallback, maxFailures: Number(e.target.value)}})} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: Ações e Info */}
        <div className="lg:col-span-4 space-y-8">
          <div className="sticky top-8 space-y-8">
            <div className="crm-card p-6 bg-primary/5 border-primary/20">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-6 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Governança da IA
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                O Agente atua como a primeira camada de interação. Quando o <strong>Handoff</strong> é acionado, a conversa é movida instantaneamente para a aba <strong>Fila</strong> e a IA é silenciada para essa interação específica.
              </p>
              <button 
                className="crm-button-primary w-full h-12 shadow-lg shadow-primary/20" 
                onClick={() => saveMutation.mutate(settings)} 
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Publicar Configurações
              </button>
            </div>

            {/* Dica de Configuração */}
            <div className="p-6 bg-card border rounded-xl space-y-4 shadow-sm">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h5 className="text-xs font-bold uppercase tracking-wider">Estratégia de Resposta</h5>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Para um atendimento mais sério, utilize mensagens de apresentação curtas e diretas. Configure o fluxo de bot para qualificar o lead antes de transferir para um humano.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}