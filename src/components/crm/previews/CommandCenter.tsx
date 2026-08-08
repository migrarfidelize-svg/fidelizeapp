import { useState } from "react";
import { CommandLayout } from "./layouts/CommandLayout";
import { CRMStats } from "./shared/CRMStats";
import { ConversationArea } from "./shared/ConversationArea";
import { useQuery } from "@tanstack/react-query";
import { getCRMConversations } from "@/lib/atendimento.functions";
import { CRMContentSwitch } from "./shared/CRMContentSwitch";
import { CRMThemeProvider } from "./shared/ThemeContext";

export function CommandCenter() {
  const [activeTab, setActiveTab] = useState("conversas");
  const [selected, setSelected] = useState(null);
  const { data: conversations } = useQuery({ 
    queryKey: ["crm-conversations"], 
    queryFn: () => getCRMConversations({ data: { status: "all" } })
  });

  return (
    <CRMThemeProvider theme="command">
      <CommandLayout activeTab={activeTab} setActiveTab={setActiveTab}>
        <div className="flex-1 p-6 space-y-6 overflow-y-auto bg-background">
          <CRMStats />
          {activeTab === "conversas" ? (
            <div className="grid grid-cols-[280px_1fr_280px] gap-4 h-[calc(100vh-180px)]">
              <div className="bg-card border rounded-md flex flex-col overflow-hidden shadow-sm">
                  <div className="p-3 border-b font-bold text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/30">Conversas</div>
                  <ConversationArea conversations={conversations || []} selected={selected} onSelect={setSelected} />
              </div>
              <div className="bg-card border rounded-md flex flex-col shadow-sm relative overflow-hidden">
                  <div className="flex-1 flex items-center justify-center text-muted-foreground/40 italic text-sm">
                      Selecione um atendimento para visualizar o histórico compactado
                  </div>
                  <div className="p-3 border-t bg-muted/20 flex gap-2">
                    <div className="flex-1 h-9 bg-background border rounded px-3 text-xs flex items-center text-muted-foreground/50">Escreva uma mensagem técnica...</div>
                    <div className="w-20 h-9 bg-primary text-primary-foreground rounded text-[10px] font-bold flex items-center justify-center">ENVIAR</div>
                  </div>
              </div>
              <div className="bg-card border rounded-md p-4 text-[11px] shadow-sm space-y-4">
                <div className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Perfil do Cliente</div>
                <div className="space-y-2">
                  <div className="p-2 bg-muted/50 rounded border">
                    <div className="text-[9px] font-bold opacity-50 uppercase">Telefone</div>
                    <div className="font-mono">5511999999999</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded border">
                    <div className="text-[9px] font-bold opacity-50 uppercase">Status</div>
                    <div className="text-green-600 font-bold">Online</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card border rounded-md p-8 shadow-sm">
              <CRMContentSwitch tab={activeTab} />
            </div>
          )}
        </div>
      </CommandLayout>
    </CRMThemeProvider>
  );
}
