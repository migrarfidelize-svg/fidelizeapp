import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { User, Edit3 } from "lucide-react";

export function ConversationArea({ conversations, selected, onSelect }: { conversations: any[], selected: any, onSelect: (c: any) => void }) {
    return (
        <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
                {conversations?.map((conv: any) => (
                    <button
                        key={conv.id}
                        onClick={() => onSelect(conv)}
                        className={cn(
                            "w-full text-left p-3 rounded-xl transition-all border flex gap-3",
                            selected?.id === conv.id ? "bg-primary/10 border-primary/20" : "hover:bg-muted/50 border-transparent"
                        )}
                    >
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{conv.customer_phone}</div>
                            <p className="text-[10px] text-muted-foreground truncate">{conv.messages?.[0]?.body || "..."}</p>
                        </div>
                    </button>
                ))}
            </div>
        </ScrollArea>
    );
}
