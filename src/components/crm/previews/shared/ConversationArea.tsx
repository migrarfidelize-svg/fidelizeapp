import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import { useCRMTheme } from "./ThemeContext";

export function ConversationArea({ conversations, selected, onSelect }: { conversations: any[], selected: any, onSelect: (c: any) => void }) {
    const { theme } = useCRMTheme();
    
    return (
        <ScrollArea className="flex-1">
            <div className={cn(
                "p-2",
                theme === "command" ? "space-y-0.5" : 
                theme === "premium" ? "p-6 space-y-4" : 
                "p-4 space-y-2"
            )}>
                {conversations?.map((conv: any) => (
                    <button
                        key={conv.id}
                        onClick={() => onSelect(conv)}
                        className={cn(
                            "w-full text-left transition-all border flex items-center gap-3",
                            theme === "command" ? (
                                cn("p-2 rounded border-transparent text-[11px]", 
                                selected?.id === conv.id ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted/50")
                            ) : theme === "premium" ? (
                                cn("p-5 rounded-[24px] border-primary/5 shadow-sm", 
                                selected?.id === conv.id ? "bg-primary text-primary-foreground shadow-xl ring-4 ring-primary/5" : "hover:bg-muted/30 bg-card")
                            ) : (
                                cn("p-4 rounded-xl border-white/5 bg-zinc-900/30", 
                                selected?.id === conv.id ? "border-primary/50 bg-primary/10 shadow-[0_0_20px_rgba(var(--primary),0.2)]" : "hover:bg-white/5")
                            )
                        )}
                    >
                        <div className={cn(
                            "shrink-0 flex items-center justify-center",
                            theme === "command" ? "h-6 w-6 rounded bg-muted/20" : 
                            theme === "premium" ? "h-12 w-12 rounded-full bg-primary/10 shadow-inner" : 
                            "h-10 w-10 rounded-lg bg-zinc-800 border border-white/10"
                        )}>
                            <User className={cn(
                                theme === "command" ? "h-3 w-3" : 
                                theme === "premium" ? "h-6 w-6" : 
                                "h-5 w-5 text-primary"
                            )} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className={cn(
                                "font-bold truncate",
                                theme === "command" ? "text-[10px]" : 
                                theme === "premium" ? "text-sm tracking-tight" : 
                                "text-xs text-white uppercase tracking-widest"
                            )}>{conv.customer_phone}</div>
                            <p className={cn(
                                "truncate opacity-60",
                                theme === "command" ? "text-[9px]" : 
                                theme === "premium" ? "text-xs font-light" : 
                                "text-[10px] italic"
                            )}>{conv.messages?.[0]?.body || "Visualizar histórico..."}</p>
                        </div>
                    </button>
                ))}
            </div>
        </ScrollArea>
    );
}
