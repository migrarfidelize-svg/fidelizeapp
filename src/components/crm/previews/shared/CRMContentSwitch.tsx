import { ReactNode } from "react";
import { OTPEditor } from "@/components/crm/OTPEditor";
import { AgentConfig } from "@/components/crm/AgentConfig";
import { ContactManager } from "@/components/crm/ContactManager";
import { TemplateManager } from "@/components/crm/TemplateManager";
import { QuickRepliesManager } from "@/components/crm/QuickReplies";
import { GitBranch } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getCRMFlows } from "@/lib/atendimento.functions";
import { useCRMTheme } from "./ThemeContext";
import { cn } from "@/lib/utils";

export function CRMContentSwitch({ tab }: { tab: string }) {
  const { data: flows } = useQuery({ queryKey: ["crm-flows"], queryFn: () => getCRMFlows() });
  const { theme } = useCRMTheme();
  
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
        <div className={cn(
            "grid gap-6",
            theme === "command" ? "grid-cols-2 lg:grid-cols-4 gap-3" : 
            theme === "premium" ? "grid-cols-2 lg:grid-cols-3 gap-10" : 
            "grid-cols-2 lg:grid-cols-3 gap-6"
        )}>
            {flows?.map((f: any) => (
                <div key={f.id} className={cn(
                    "bg-card border transition-all flex flex-col",
                    theme === "command" ? "p-4 rounded-md shadow-sm items-start text-left" : 
                    theme === "premium" ? "p-10 rounded-[40px] shadow-2xl items-center text-center border-primary/5" : 
                    "p-8 rounded-2xl border-white/10 items-center text-center bg-zinc-900/50"
                )}>
                    <div className={cn(
                        "flex items-center justify-center mb-4",
                        theme === "command" ? "h-8 w-8 bg-muted rounded text-muted-foreground" : 
                        theme === "premium" ? "h-16 w-16 bg-primary/5 rounded-[24px] text-primary" : 
                        "h-14 w-14 bg-primary/20 rounded-full text-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]"
                    )}>
                        <GitBranch className={cn(theme === "command" ? "h-4 w-4" : "h-6 w-6")} />
                    </div>
                    <h4 className={cn(
                        "font-black mb-1",
                        theme === "command" ? "text-xs" : 
                        theme === "premium" ? "text-lg tracking-tight" : 
                        "text-sm uppercase tracking-[0.2em] text-white"
                    )}>{f.name}</h4>
                    <p className={cn(
                        "uppercase mb-4",
                        theme === "command" ? "text-[8px] font-bold text-muted-foreground" : 
                        theme === "premium" ? "text-[10px] font-light text-muted-foreground tracking-widest" : 
                        "text-[9px] font-black text-primary animate-pulse"
                    )}>{f.is_active ? "Sistema Online" : "Pausado"}</p>
                    <button className={cn(
                        "w-full transition-all uppercase font-black",
                        theme === "command" ? "py-2 bg-primary text-primary-foreground rounded text-[9px]" : 
                        theme === "premium" ? "py-4 bg-muted hover:bg-primary hover:text-white rounded-full text-[10px] tracking-widest shadow-lg" : 
                        "py-3 bg-white/5 hover:bg-primary hover:text-white rounded-xl text-[10px] border border-white/5 tracking-[0.3em]"
                    )}>Configurar Protocolo</button>
                </div>
            ))}
        </div>
      );
    default:
      return (
        <div className={cn(
            "p-20 border-2 border-dashed flex items-center justify-center text-muted-foreground",
            theme === "command" ? "rounded-md" : 
            theme === "premium" ? "rounded-[60px]" : 
            "rounded-3xl border-white/10"
        )}>
          Seção {tab} aguardando inicialização de dados.
        </div>
      );
  }
}
