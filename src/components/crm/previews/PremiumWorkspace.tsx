import { useState } from "react";
import { PremiumLayout } from "./layouts/PremiumLayout";
import { ConversationArea } from "./shared/ConversationArea";
import { useQuery } from "@tanstack/react-query";
import { getCRMConversations } from "@/lib/atendimento.functions";
import { CRMContentSwitch } from "./shared/CRMContentSwitch";
import { CRMThemeProvider } from "./shared/ThemeContext";

export function PremiumWorkspace() {
  const [activeTab, setActiveTab] = useState("conversas");
  const [selected, setSelected] = useState(null);
  const { data: conversations } = useQuery({ 
    queryKey: ["crm-conversations"], 
    queryFn: () => getCRMConversations({ data: { status: "all" } })
  });

  return (
    <CRMThemeProvider theme="premium">
      <PremiumLayout activeTab={activeTab} setActiveTab={setActiveTab}>
        <div className="flex-1 flex overflow-hidden bg-background">
          {activeTab === "conversas" ? (
            <>
              <div className="w-[380px] border-r flex flex-col bg-muted/5">
                  <div className="p-10 pb-6">
                    <h2 className="text-3xl font-light tracking-tight text-foreground">Mensagens</h2>
                    <p className="text-[11px] uppercase font-bold text-muted-foreground tracking-[0.2em] mt-2 opacity-60">Atendimento Concierge</p>
                  </div>
                  <div className="px-6 pb-6">
                    <div className="h-10 bg-muted/30 rounded-full flex items-center px-4 text-xs text-muted-foreground border border-border/50">Procurar conversa...</div>
                  </div>
                  <ConversationArea conversations={conversations || []} selected={selected} onSelect={setSelected} />
              </div>
              <div className="flex-1 p-16 flex flex-col items-center justify-center bg-card/20 relative">
                 <div className="max-w-md text-center space-y-8 animate-in fade-in zoom-in duration-700">
                    <div className="h-24 w-24 bg-primary/5 rounded-[32px] flex items-center justify-center mx-auto text-primary border border-primary/10 shadow-inner">
                      <div className="h-12 w-12 border-2 border-primary/20 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-medium text-foreground tracking-tight">Premium Canvas</h3>
                      <p className="text-sm text-muted-foreground font-light leading-relaxed">
                        Inicie uma experiência de suporte personalizada selecionando um cliente no menu lateral.
                      </p>
                    </div>
                 </div>
                 
                 {/* Decorative element */}
                 <div className="absolute bottom-16 right-16 h-64 w-64 bg-primary/5 rounded-full blur-3xl -z-10" />
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-16 animate-in slide-in-from-bottom-4 duration-500">
              <div className="max-w-5xl mx-auto">
                <CRMContentSwitch tab={activeTab} />
              </div>
            </div>
          )}
        </div>
      </PremiumLayout>
    </CRMThemeProvider>
  );
}
