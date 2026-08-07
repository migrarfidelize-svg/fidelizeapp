import { ReactNode } from "react";
import { OTPEditor } from "@/components/crm/OTPEditor";
import { AgentConfig } from "@/components/crm/AgentConfig";
import { ContactManager } from "@/components/crm/ContactManager";
import { TemplateManager } from "@/components/crm/TemplateManager";
import { QuickRepliesManager } from "@/components/crm/QuickReplies";
import { FlowEditor } from "@/components/crm/FlowEditor";
import { GitBranch } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getCRMFlows } from "@/lib/atendimento.functions";

export function CRMContentSwitch({ tab }: { tab: string }) {
  const { data: flows } = useQuery({ queryKey: ["crm-flows"], queryFn: () => getCRMFlows() });
  
  switch (tab) {
    case "otp":
      return <OTPEditor />;
    case "agente":
      return <AgentConfig />;
    case "contatos":
      return <ContactManager />;
    case "templates":
      return <TemplateManager />;
    case "config":
      return <QuickRepliesManager />;
    case "fluxos":
      return (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {flows?.map((f: any) => (
                <div key={f.id} className="p-6 bg-card border rounded-3xl shadow-sm hover:shadow-lg transition-all border-primary/10 flex flex-col items-center text-center">
                    <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-4">
                        <GitBranch className="h-6 w-6" />
                    </div>
                    <h4 className="font-bold text-sm mb-1">{f.name}</h4>
                    <p className="text-[10px] text-muted-foreground uppercase mb-4">{f.is_active ? "Ativo" : "Pausado"}</p>
                    <button className="w-full py-2 bg-muted hover:bg-primary hover:text-white rounded-xl text-[10px] font-bold uppercase transition-all">Editar Fluxo</button>
                </div>
            ))}
        </div>
      );
    default:
      return (
        <div className="p-12 border-2 border-dashed rounded-3xl flex items-center justify-center text-muted-foreground">
          Conteúdo da seção {tab}
        </div>
      );
  }
}
