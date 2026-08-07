import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCRMConversations } from "@/lib/atendimento.functions";
import { ConversationArea } from "./shared/ConversationArea";

export function PremiumWorkspace() {
  const [selected, setSelected] = useState(null);
  const { data: conversations } = useQuery({ 
    queryKey: ["crm-conversations"], 
    queryFn: () => getCRMConversations({ data: { status: "all" } })
  });

  return (
    <div className="h-[calc(100vh-100px)] flex">
        <div className="w-[350px] border-r flex flex-col bg-muted/20">
             <div className="p-6 font-bold text-xl">Atendimento</div>
             <ConversationArea conversations={conversations} selected={selected} onSelect={setSelected} />
        </div>
        <div className="flex-1 p-12 flex flex-col gap-6">
            <div className="text-4xl font-light">Workspace Preview</div>
            <div className="flex-1 bg-white border rounded-3xl p-12 shadow-sm">
                Conteúdo da Conversa (Premium)
            </div>
        </div>
    </div>
  );
}
