import { useState } from "react";
import { CommandLayout } from "./layouts/CommandLayout";
import { CRMStats } from "./shared/CRMStats";
import { ConversationArea } from "./shared/ConversationArea";
import { useQuery } from "@tanstack/react-query";
import { getCRMConversations } from "@/lib/atendimento.functions";

export function CommandCenter() {
  const [activeTab, setActiveTab] = useState("conversas");
  const [selected, setSelected] = useState(null);
  const { data: conversations } = useQuery({ 
    queryKey: ["crm-conversations"], 
    queryFn: () => getCRMConversations({ data: { status: "all" } })
  });

  return (
    <CommandLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="flex-1 p-8 space-y-8 overflow-y-auto">
        <CRMStats />
        {activeTab === "conversas" ? (
          <div className="grid grid-cols-[300px_1fr_300px] gap-6 h-[600px]">
            <div className="bg-card border rounded-2xl flex flex-col overflow-hidden">
                <div className="p-4 border-b font-bold text-xs uppercase tracking-wider">Conversas</div>
                <ConversationArea conversations={conversations || []} selected={selected} onSelect={setSelected} />
            </div>
            <div className="bg-card border rounded-2xl flex items-center justify-center text-muted-foreground italic">
                Chat central
            </div>
            <div className="bg-card border rounded-2xl p-4 text-xs">Informações do cliente</div>
          </div>
        ) : (
          <div className="p-12 border-2 border-dashed rounded-3xl flex items-center justify-center text-muted-foreground">
            Conteúdo da seção {activeTab} (Command UX)
          </div>
        )}
      </div>
    </CommandLayout>
  );
}
