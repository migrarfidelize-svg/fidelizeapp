import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCRMConversations } from "@/lib/atendimento.functions";
import { CRMStats } from "./shared/CRMStats";
import { ConversationArea } from "./shared/ConversationArea";

export function CommandCenter() {
  const [selected, setSelected] = useState(null);
  const { data: conversations } = useQuery({ 
    queryKey: ["crm-conversations"], 
    queryFn: () => getCRMConversations({ data: { status: "all" } })
  });

  return (
    <div className="h-[calc(100vh-100px)] p-6 space-y-6 flex flex-col">
      <CRMStats />
      <div className="flex-1 grid grid-cols-[300px_1fr_300px] gap-6 overflow-hidden">
        <div className="bg-card border rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b font-bold text-xs uppercase tracking-wider">Conversas</div>
          <ConversationArea conversations={conversations || []} selected={selected} onSelect={setSelected} />
        </div>
        <div className="bg-card border rounded-2xl flex items-center justify-center text-muted-foreground text-sm italic">
            Área de Chat (Preview Command)
        </div>
        <div className="bg-card border rounded-2xl p-4 text-xs">
            Inspect Panel
        </div>
      </div>
    </div>
  );
}
