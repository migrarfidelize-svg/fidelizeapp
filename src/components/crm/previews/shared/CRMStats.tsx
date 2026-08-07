import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, History, UserCheck, CheckCircle2, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getCRMStats } from "@/lib/atendimento.functions";

export function CRMStats() {
    const { data: stats } = useQuery({ queryKey: ["crm-stats"], queryFn: () => getCRMStats() });
    
    const items = [
        { label: "Abertas", val: stats?.open || 0, icon: MessageSquare },
        { label: "Fila", val: stats?.waiting || 0, icon: History },
        { label: "Agente", val: stats?.assigned || 0, icon: UserCheck },
        { label: "Finalizadas", val: stats?.resolvedToday || 0, icon: CheckCircle2 },
        { label: "T. Espera", val: stats?.avgWaitTime || "0", icon: Clock },
    ];

    return (
        <div className="grid grid-cols-5 gap-3">
            {items.map((s, i) => (
                <div key={i} className="bg-card border border-border p-3 rounded-xl flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <s.icon className="h-4 w-4" />
                    </div>
                    <div>
                        <div className="text-[9px] uppercase font-bold text-muted-foreground">{s.label}</div>
                        <div className="text-lg font-black">{s.val}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
