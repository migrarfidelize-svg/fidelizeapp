import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getCRMFlows } from "@/lib/atendimento.functions";
import { GitBranch, Plus, Play, Trash2, Edit2, CheckCircle2, Circle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useCRMEstablishmentId } from "./CRMEstablishmentContext";

export function FlowsView({ onEdit }: { onEdit: (flow: any) => void }) {
  const establishmentId = useCRMEstablishmentId();
  const { data: flows, isLoading } = useQuery({
    queryKey: ["crm-flows", establishmentId],
    queryFn: () => getCRMFlows({ data: { establishment_id: establishmentId } }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Fluxos de Atendimento</h2>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
            Gerencie as automações e menus do WhatsApp.
          </p>
        </div>
        <button 
          onClick={() => onEdit(null)}
          className="crm-button-primary px-6 h-11 text-xs font-bold uppercase tracking-widest"
        >
          <Plus className="h-4 w-4 mr-2" /> Novo Fluxo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {flows?.map((flow: any) => (
          <Card key={flow.id} className="p-6 border-border/50 hover:border-primary/30 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              {flow.is_active ? (
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] uppercase font-black">Ativo</Badge>
              ) : (
                <Badge variant="outline" className="text-[9px] uppercase font-black opacity-50">Inativo</Badge>
              )}
            </div>

            <GitBranch className="h-8 w-8 text-primary/40 mb-4 group-hover:text-primary transition-colors" />
            
            <h3 className="font-black uppercase text-sm tracking-tight mb-2">{flow.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-6 h-8">
              {flow.description || "Sem descrição disponível."}
            </p>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => onEdit(flow)}
                className="flex-1 crm-button-secondary h-9 text-[10px] font-bold uppercase tracking-widest"
              >
                <Edit2 className="h-3 w-3 mr-2" /> Editar Canvas
              </button>
            </div>
          </Card>
        ))}

        {(!flows || flows.length === 0) && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-border/50 rounded-xl">
            <GitBranch className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground font-medium">Nenhum fluxo encontrado.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Crie seu primeiro fluxo de automação ou aguarde o bootstrap.</p>
          </div>
        )}
      </div>
    </div>
  );
}
