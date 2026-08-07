import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCRMConversations } from "@/lib/atendimento.functions";
import { ConversationArea } from "./shared/ConversationArea";

export function NexusServiceHub() {
  const [selected, setSelected] = useState(null);
  const { data: conversations } = useQuery({ 
    queryKey: ["crm-conversations"], 
    queryFn: () => getCRMConversations({ data: { status: "all" } })
  });

  return (
    <div className="h-[calc(100vh-100px)] flex bg-black text-white">
        <div className="w-[80px] bg-zinc-900 border-r flex flex-col items-center py-8 gap-6">
            <div className="h-10 w-10 bg-primary rounded-xl" />
        </div>
        <div className="w-[300px] border-r border-zinc-800 flex flex-col">
             <div className="p-6 font-black tracking-widest text-primary">NEXUS</div>
             <ConversationArea conversations={conversations} selected={selected} onSelect={setSelected} />
        </div>
        <div className="flex-1 p-8">
            <div className="text-2xl font-bold tracking-tight">Preview Nexus Hub</div>
            <div className="mt-8 p-12 border border-zinc-800 rounded-3xl bg-zinc-900/50">
                Live Data Feed / Visual Handoff
            </div>
        </div>
    </div>
  );
}
