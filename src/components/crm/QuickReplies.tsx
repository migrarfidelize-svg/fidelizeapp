import React, { useState } from "react";
import { Plus, Edit3, Trash2, Save, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCRMQuickReplies, saveCRMQuickReply } from "@/lib/atendimento.functions";
import { toast } from "sonner";

export function QuickRepliesManager({ establishmentId }: { establishmentId: string }) {
  const queryClient = useQueryClient();
  const { data: replies } = useQuery({ queryKey: ["crm-quick-replies", establishmentId], queryFn: () => getCRMQuickReplies({ data: { establishmentId } }) });
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ shortcut: "/", message: "" });

  const saveMutation = useMutation({
    mutationFn: (data: any) => saveCRMQuickReply({ data: { ...data, establishmentId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-quick-replies"] });
      setEditingId(null);
      setFormData({ shortcut: "/", message: "" });
      toast.success("Resposta rápida salva!");
    }
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="p-4 space-y-4">
        <h4 className="text-sm font-bold flex items-center gap-2"><Terminal className="h-4 w-4" /> Nova Resposta Rápida</h4>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Atalho</label>
            <Input 
              placeholder="/boasvindas" 
              value={formData.shortcut} 
              onChange={e => setFormData({...formData, shortcut: e.target.value})} 
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Mensagem</label>
            <Textarea 
              placeholder="Olá! Seja bem-vindo..." 
              value={formData.message} 
              onChange={e => setFormData({...formData, message: e.target.value})} 
            />
          </div>
          <Button className="w-full" onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending}>
             <Save className="h-4 w-4 mr-2" /> Salvar Resposta
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        {replies?.map((r: any) => (
          <Card key={r.id} className="p-3 flex justify-between items-center group">
            <div>
              <div className="text-xs font-bold text-primary">{r.shortcut}</div>
              <div className="text-[10px] text-muted-foreground line-clamp-1">{r.message}</div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-7 w-7"><Edit3 className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
