import React, { useState } from "react";
import { GitBranch, MessageSquare, List, HelpCircle, ArrowRight, UserCheck, CheckCircle2, Trash2, Plus, Save, ChevronLeft, Layout, Settings2, PlayCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveCRMFlow } from "@/lib/atendimento.functions";
import { cn } from "@/lib/utils";

export function FlowEditor({ flow, onBack }: { flow: any; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [steps, setSteps] = useState<any[]>(flow?.steps || []);
  const [flowName, setFlowName] = useState(flow?.name || "Novo Fluxo de Atendimento");

  const saveMutation = useMutation({
    mutationFn: (vars: any) => saveCRMFlow({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-flows"] });
      toast.success("Arquitetura de fluxo salva com sucesso");
      onBack();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const addStep = (type: string) => {
    const newStep = {
      id: crypto.randomUUID(),
      step_key: type,
      payload: { type, text: "", options: [] }
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const updateStepPayload = (id: string, payload: any) => {
    setSteps(steps.map(s => s.id === id ? { ...s, payload } : s));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setSteps(newSteps);
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Header do Editor */}
      <div className="p-6 border-b bg-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="h-10 w-10 rounded-lg border border-border/50 flex items-center justify-center hover:bg-muted transition-all"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[9px] uppercase font-black border-primary/20 bg-primary/5 text-primary">Beta - Editor de Fluxos</Badge>
              <h1 className="text-xl font-black tracking-tight uppercase text-foreground">Canvas de Automação</h1>
            </div>
            <Input 
              value={flowName} 
              onChange={(e) => setFlowName(e.target.value)} 
              className="h-7 p-0 border-none bg-transparent font-medium text-sm text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder="Nome do fluxo..."
            />
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button className="crm-button-secondary h-11 px-4 text-xs font-bold uppercase tracking-widest">
            <PlayCircle className="h-4 w-4 mr-2" /> Simular
          </button>
          <button 
            onClick={() => saveMutation.mutate({ id: flow?.id, name: flowName, steps, is_active: flow?.is_active })} 
            disabled={saveMutation.isPending}
            className="crm-button-primary h-11 px-8 text-xs font-bold uppercase tracking-widest"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Estrutura
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* Toolbar Lateral de Componentes */}
        <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r bg-muted/20 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto crm-scrollbar">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">Blocos de Ação</h4>
            <div className="grid grid-cols-1 gap-2">
              {[
                { id: 'message', icon: MessageSquare, label: 'Mensagem', desc: 'Envio de texto simples' },
                { id: 'options', icon: List, label: 'Menu de Opções', desc: 'Botões interativos' },
                { id: 'agent', icon: Bot, label: 'Atendimento IA', desc: 'IA responde naturalmente' },
                { id: 'transfer_to_queue', icon: UserCheck, label: 'Falar com Humano', desc: 'Encaminha para fila' },
                { id: 'close', icon: CheckCircle2, label: 'Finalizar', desc: 'Encerra a interação' },
              ].map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => addStep(tool.id)}
                  className="w-full text-left p-3 rounded-lg border border-border/50 bg-card hover:border-primary/40 hover:bg-primary/5 group transition-all"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <tool.icon className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-tight group-hover:text-primary">{tool.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{tool.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border/30">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">Estrutura do Fluxo</h4>
            <div className="text-[10px] text-muted-foreground italic leading-relaxed">
              Arraste e solte os blocos no canvas central para definir a lógica de resposta do assistente autônomo.
            </div>
          </div>
        </aside>

        {/* Canvas de Construção Central */}
        <main className="flex-1 bg-muted/10 overflow-y-auto p-8 crm-scrollbar">
          <div className="max-w-3xl mx-auto space-y-6">
            {steps.map((step, idx) => (
              <div key={step.id} className="relative">
                {/* Linha de Conexão */}
                {idx > 0 && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 h-6 w-px bg-primary/20" />
                )}
                
                <Card className={cn(
                  "border-l-4 p-0 overflow-hidden shadow-sm transition-all hover:shadow-md",
                  step.step_key === 'transfer_to_queue' ? "border-l-amber-500" :
                  step.step_key === 'agent' ? "border-l-indigo-500" :
                  step.step_key === 'close' ? "border-l-emerald-500" : "border-l-primary"
                )}>
                  {/* Cabeçalho do Bloco */}
                  <div className="px-4 py-3 bg-card border-b flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-6 rounded bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground">
                        {idx + 1}
                      </div>
                      <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider py-0 px-2 h-5 border-border/50">
                        {step.step_key === 'transfer_to_queue' ? 'Encaminhamento' : 
                         step.step_key === 'options' ? 'Interação' : 
                         step.step_key === 'agent' ? 'Inteligência Artificial' : 
                         step.step_key === 'close' ? 'Finalização' : 'Mensagem'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => removeStep(step.id)} className="h-7 w-7 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Conteúdo do Bloco */}
                  <div className="p-6 space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground opacity-60">Resposta do Bot</label>
                      <Textarea 
                        placeholder="Digite o texto que o bot irá enviar..." 
                        value={step.payload.text || ""} 
                        className="min-h-[100px] text-sm font-medium bg-muted/20 border-border/50 resize-none focus-visible:ring-1 focus-visible:ring-primary/20"
                        onChange={(e) => updateStepPayload(step.id, { ...step.payload, text: e.target.value })}
                      />
                    </div>
                    
                    {step.step_key === 'agent' && (
                      <div className="space-y-4 pt-2 border-t border-border/30">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground opacity-60">Contexto Adicional da IA</label>
                          <Textarea 
                            placeholder="Instruções específicas para este ponto da conversa..." 
                            value={step.payload.context || ""} 
                            className="text-xs bg-muted/20 border-border/50 resize-none"
                            onChange={(e) => updateStepPayload(step.id, { ...step.payload, context: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    {step.step_key === 'options' && (
                      <div className="space-y-3 pt-2 border-t border-border/30">
                         <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground opacity-60">Botões / Alternativas</label>
                            <button 
                              onClick={() => {
                                const options = step.payload.options || [];
                                updateStepPayload(step.id, { ...step.payload, options: [...options, { label: "", value: "", nextStepId: "" }] });
                              }}
                              className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline"
                            >
                              <Plus className="h-3 w-3" /> Adicionar Opção
                            </button>
                         </div>
                         
                         <div className="space-y-2">
                           {(step.payload.options || []).map((opt: any, optIdx: number) => (
                             <div key={optIdx} className="flex gap-2 items-start group/opt">
                               <Input 
                                 placeholder="Rótulo do Botão (Ex: Suporte)" 
                                 value={opt.label} 
                                 className="h-10 text-xs font-bold bg-muted/20 border-border/50"
                                 onChange={(e) => {
                                   const newOpts = [...step.payload.options];
                                   newOpts[optIdx].label = e.target.value;
                                   newOpts[optIdx].value = e.target.value;
                                   updateStepPayload(step.id, { ...step.payload, options: newOpts });
                                 }}
                               />
                               <Select 
                                 value={opt.nextStepId} 
                                 onValueChange={(val) => {
                                   const newOpts = [...step.payload.options];
                                   newOpts[optIdx].nextStepId = val;
                                   updateStepPayload(step.id, { ...step.payload, options: newOpts });
                                 }}
                               >
                                 <SelectTrigger className="h-10 text-xs flex-1 bg-muted/20 border-border/50 font-medium">
                                   <SelectValue placeholder="Conectar a..." />
                                 </SelectTrigger>
                                 <SelectContent className="crm-enterprise-layout">
                                   {steps.filter(s => s.id !== step.id).map((s, i) => (
                                     <SelectItem key={s.id} value={s.id} className="text-xs font-bold py-2">Bloco {i + 1} ({s.step_key})</SelectItem>
                                   ))}
                                   <SelectItem value="transfer" className="text-xs font-bold py-2 text-amber-500">Encaminhar Direto</SelectItem>
                                 </SelectContent>
                               </Select>
                               <button 
                                 onClick={() => {
                                   const newOpts = step.payload.options.filter((_: any, i: number) => i !== optIdx);
                                   updateStepPayload(step.id, { ...step.payload, options: newOpts });
                                 }}
                                 className="h-10 w-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive opacity-0 group-hover/opt:opacity-100 transition-all"
                               >
                                 <Trash2 className="h-4 w-4" />
                               </button>
                             </div>
                           ))}
                         </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            ))}
            
            {steps.length === 0 && (
              <div className="h-[400px] border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-card/50">
                <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
                  <GitBranch className="h-10 w-10 text-muted-foreground opacity-30" />
                </div>
                <h4 className="text-xl font-black tracking-tight text-foreground uppercase">Canvas Vazio</h4>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                  Selecione um bloco de ação na barra lateral para começar a desenhar seu fluxo de atendimento automatizado.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                   <button onClick={() => addStep('message')} className="crm-button-secondary px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-primary/20">
                     Iniciar com Mensagem
                   </button>
                   <button onClick={() => addStep('options')} className="crm-button-secondary px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-primary/20">
                     Iniciar com Menu
                   </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Footer com Metadados */}
      <div className="p-4 border-t bg-muted/20 flex justify-between items-center shrink-0">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60 flex items-center gap-4">
          <span>Blocos Ativos: {steps.length}</span>
          <span className="w-px h-3 bg-border" />
          <span>Status: Edição em Tempo Real</span>
        </div>
      </div>
    </div>
  );
}
