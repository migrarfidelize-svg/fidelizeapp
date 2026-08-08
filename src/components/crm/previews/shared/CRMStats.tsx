import { MessageSquare, History, UserCheck, CheckCircle2, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getCRMStats } from "@/lib/atendimento.functions";
import { useCRMTheme } from "./ThemeContext";
import { cn } from "@/lib/utils";

export function CRMStats() {
    const { data: stats } = useQuery({ queryKey: ["crm-stats"], queryFn: () => getCRMStats() });
    const { theme } = useCRMTheme();
    
    const items = [
        { label: "Abertas", val: stats?.open || 0, icon: MessageSquare },
        { label: "Fila", val: stats?.waiting || 0, icon: History },
        { label: "Agente", val: stats?.assigned || 0, icon: UserCheck },
        { label: "Finalizadas", val: stats?.resolvedToday || 0, icon: CheckCircle2 },
        { label: "T. Espera", val: stats?.avgWaitTime || "0", icon: Clock },
    ];

    return (
        <div className={cn(
            "grid gap-4",
            theme === "command" ? "grid-cols-5 gap-3" : 
            theme === "premium" ? "grid-cols-5 gap-6" : 
            "grid-cols-5 gap-4"
        )}>
            {items.map((s, i) => (
                <div key={i} className={cn(
                    "bg-card border flex items-center transition-all",
                    theme === "command" ? "p-3 rounded-md shadow-sm gap-3 border-border/50" : 
                    theme === "premium" ? "p-6 rounded-[24px] shadow-xl shadow-black/5 gap-4 border-primary/5 hover:scale-[1.02]" : 
                    "p-4 rounded-2xl border-white/5 bg-zinc-900/50 gap-4"
                )}>
                    <div className={cn(
                        "flex items-center justify-center shrink-0",
                        theme === "command" ? "h-8 w-8 rounded bg-muted text-muted-foreground" : 
                        theme === "premium" ? "h-12 w-12 rounded-2xl bg-primary/5 text-primary" : 
                        "h-10 w-10 rounded-full bg-primary/20 text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                    )}>
                        <s.icon className={cn(
                            theme === "command" ? "h-4 w-4" : 
                            theme === "premium" ? "h-6 w-6" : 
                            "h-5 w-5"
                        )} />
                    </div>
                    <div>
                        <div className={cn(
                            "uppercase font-black tracking-widest",
                            theme === "command" ? "text-[8px] text-muted-foreground" : 
                            theme === "premium" ? "text-[10px] text-muted-foreground/60" : 
                            "text-[9px] text-zinc-500"
                        )}>{s.label}</div>
                        <div className={cn(
                            "font-black leading-tight",
                            theme === "command" ? "text-lg text-foreground" : 
                            theme === "premium" ? "text-3xl text-foreground" : 
                            "text-xl text-white italic tracking-tighter"
                        )}>{s.val}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
