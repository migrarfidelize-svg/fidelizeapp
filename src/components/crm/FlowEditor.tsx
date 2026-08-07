import React, { useState } from "react";
import { GitBranch, MessageSquare, List, HelpCircle, ArrowRight, UserCheck, CheckCircle2, Trash2, Plus, Save } from "lucide-react";
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

export function FlowEditor({ flow, onBack }: { flow: any; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [steps, setSteps] = useState<any[]>(flow?.steps || []);
  const [flowName, setFlowName] = useState(flow?.name || "Novo Fluxo");

  const saveMutation = useMutation({
    mutationFn: (vars: any) => saveCRMFlow({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-flows"] });
      toast.success("Fluxo salvo com sucesso!");
      onBack();
    }
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card p-4 rounded-xl border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>Voltar</Button>
          <Input value={flowName} onChange={(e) => setFlowName(e.target.value)} className="w-[300px]" />
        </div>
        <Button onClick={() => saveMutation.mutate({ id: flow?.id, name: flowName, steps, is_active: flow?.is_active })} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" /> Salvar Fluxo
        </Button>
      </div>

      <div className="grid lg:grid-cols-[200px_1fr] gap-6">
        <Card className="p-4 space-y-4 h-fit sticky top-4">
          <h4 className="text-xs font-bold uppercase text-muted-foreground">Etapas</h4>
          <div className="grid gap-2">
            <Button variant="outline" size="sm" onClick={() => addStep('message')} className="justify-start"><MessageSquare className="h-3.5 w-3.5 mr-2" /> Mensagem</Button>
            <Button variant="outline" size="sm" onClick={() => addStep('options')} className="justify-start"><List className="h-3.5 w-3.5 mr-2" /> Opções</Button>
            <Button variant="outline" size="sm" onClick={() => addStep('transfer_to_queue')} className="justify-start"><UserCheck className="h-3.5 w-3.5 mr-2" /> Fila</Button>
            <Button variant="outline" size="sm" onClick={() => addStep('close')} className="justify-start"><CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Finalizar</Button>
          </div>
        </Card>

        <div className="space-y-4">
          {steps.map((step, idx) => (
            <Card key={step.id} className="p-4 relative group border-l-4 border-l-primary">
              <div className="flex justify-between items-center mb-4">
                <Badge variant="secondary" className="uppercase text-[9px]">#{idx + 1} - {step.step_key}</Badge>
                <Button variant="ghost" size="icon" onClick={() => removeStep(step.id)} className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
              
              <div className="space-y-3">
                <Textarea 
                  placeholder="Conteúdo da mensagem..." 
                  value={step.payload.text || ""} 
                  onChange={(e) => updateStepPayload(step.id, { ...step.payload, text: e.target.value })}
                />
                
                {step.step_key === 'options' && (
                  <div className="space-y-2 pt-2">
                     <p className="text-[10px] font-bold uppercase text-muted-foreground">Opções</p>
                     {(step.payload.options || []).map((opt: any, optIdx: number) => (
                       <div key={optIdx} className="flex gap-2">
                         <Input 
                           placeholder="Rótulo (Ex: Sim)" 
                           value={opt.label} 
                           className="h-8 text-xs"
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
                           <SelectTrigger className="h-8 text-xs flex-1">
                             <SelectValue placeholder="Ir para etapa..." />
                           </SelectTrigger>
                           <SelectContent>
                             {steps.filter(s => s.id !== step.id).map((s, i) => (
                               <SelectItem key={s.id} value={s.id}>#{i + 1} - {s.step_key}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                     ))}
                     <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => {
                       const options = step.payload.options || [];
                       updateStepPayload(step.id, { ...step.payload, options: [...options, { label: "", value: "", nextStepId: "" }] });
                     }}>+ Adicionar Opção</Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
          
          {steps.length === 0 && (
            <div className="h-40 border-2 border-dashed rounded-xl flex items-center justify-center text-muted-foreground">
              Adicione uma etapa para começar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
