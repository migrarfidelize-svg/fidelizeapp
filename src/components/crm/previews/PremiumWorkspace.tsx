import { useState } from "react";
import { PremiumLayout } from "./layouts/PremiumLayout";
import { ConversationArea } from "./shared/ConversationArea";
import { useQuery } from "@tanstack/react-query";
import { getCRMConversations } from "@/lib/atendimento.functions";
import { CRMContentSwitch } from "./shared/CRMContentSwitch";

export function PremiumWorkspace() {
  const [activeTab, setActiveTab] = useState("conversas");
  const [selected, setSelected] = useState(null);
  const { data: conversations } = useQuery({ 
    queryKey: ["crm-conversations"], 
    queryFn: () => getCRMConversations({ data: { status: "all" } })
  });

  return (
    <PremiumLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="flex-1 flex overflow-hidden">
        {activeTab === "conversas" ? (
          <>
            <div className="w-[350px] border-r flex flex-col bg-muted/10">
                <div className="p-8 pb-4">
                  <h2 className="text-2xl font-light">Mensagens</h2>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-1">Inbox Colaborativa</p>
                </div>
                <ConversationArea conversations={conversations || []} selected={selected} onSelect={setSelected} />
            </div>
            <div className="flex-1 p-12 flex flex-col items-center justify-center text-muted-foreground bg-card/50">
               <div className="max-w-md text-center space-y-4">
                  <div className="h-20 w-20 bg-primary/5 rounded-full flex items-center justify-center mx-auto text-primary">
                    <div className="h-10 w-10 border-2 border-primary rounded-lg opacity-20" />
                  </div>
                  <h3 className="text-xl font-medium text-foreground">Premium Canvas</h3>
                  <p className="text-sm italic">Selecione uma interação no menu lateral para focar no atendimento concierge.</p>
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-12">
            <CRMContentSwitch tab={activeTab} />
          </div>
        )}
      </div>
    </PremiumLayout>
  );
}
