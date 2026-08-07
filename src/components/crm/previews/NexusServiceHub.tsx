import { useState } from "react";
import { NexusLayout } from "./layouts/NexusLayout";
import { ConversationArea } from "./shared/ConversationArea";
import { useQuery } from "@tanstack/react-query";
import { getCRMConversations } from "@/lib/atendimento.functions";
import { CRMContentSwitch } from "./shared/CRMContentSwitch";

export function NexusServiceHub() {
  const [activeTab, setActiveTab] = useState("conversas");
  const [selected, setSelected] = useState(null);
  const { data: conversations } = useQuery({ 
    queryKey: ["crm-conversations"], 
    queryFn: () => getCRMConversations({ data: { status: "all" } })
  });

  return (
    <NexusLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="flex-1 flex overflow-hidden">
        {activeTab === "conversas" ? (
          <>
            <div className="w-[300px] border-r border-zinc-900 flex flex-col bg-zinc-950/20">
                <div className="p-8 border-b border-zinc-900 bg-zinc-900/10">
                   <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">Queue Sync</div>
                   <div className="text-white font-bold">Live Stream</div>
                </div>
                <ConversationArea conversations={conversations || []} selected={selected} onSelect={setSelected} />
            </div>
            <div className="flex-1 p-12 flex flex-col items-center justify-center">
               <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full" />
                  <div className="relative border border-zinc-800 bg-zinc-900/50 backdrop-blur-3xl p-16 rounded-[40px] border-t-white/10 shadow-2xl text-center">
                    <h3 className="text-2xl font-black text-white italic tracking-tighter mb-4">NEXUS CORE</h3>
                    <div className="h-1 w-12 bg-primary mx-auto mb-6 shadow-[0_0_10px_rgba(var(--primary),0.8)]" />
                    <p className="text-xs text-zinc-500 max-w-[200px] mx-auto uppercase tracking-widest leading-loose">Aguardando seleção de canal para inicializar interface.</p>
                  </div>
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-12">
            <CRMContentSwitch tab={activeTab} />
          </div>
        )}
      </div>
    </NexusLayout>
  );
}
