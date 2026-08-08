import { useState } from "react";
import { NexusLayout } from "./layouts/NexusLayout";
import { ConversationArea } from "./shared/ConversationArea";
import { useQuery } from "@tanstack/react-query";
import { getCRMConversations } from "@/lib/atendimento.functions";
import { CRMContentSwitch } from "./shared/CRMContentSwitch";
import { CRMThemeProvider } from "./shared/ThemeContext";

export function NexusServiceHub() {
  const [activeTab, setActiveTab] = useState("conversas");
  const [selected, setSelected] = useState(null);
  const { data: conversations } = useQuery({ 
    queryKey: ["crm-conversations"], 
    queryFn: () => getCRMConversations({ data: { status: "all" } })
  });

  return (
    <CRMThemeProvider theme="nexus">
      <NexusLayout activeTab={activeTab} setActiveTab={setActiveTab}>
        <div className="flex-1 flex overflow-hidden bg-background">
          {activeTab === "conversas" ? (
            <>
              <div className="w-[320px] border-r border-white/5 flex flex-col bg-black/40 backdrop-blur-md">
                  <div className="p-8 border-b border-white/5 bg-white/5 flex items-center justify-between">
                     <div>
                        <div className="text-[9px] font-black uppercase tracking-[0.3em] text-primary mb-1">Nexus Stream</div>
                        <div className="text-white font-bold text-sm">Live Operations</div>
                     </div>
                     <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
                  </div>
                  <div className="p-4 bg-primary/5">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex justify-between">
                        <span>Canal Ativo</span>
                        <span className="text-primary">WhatsApp</span>
                    </div>
                    <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full w-2/3 bg-primary" />
                    </div>
                  </div>
                  <ConversationArea conversations={conversations || []} selected={selected} onSelect={setSelected} />
              </div>
              <div className="flex-1 p-16 flex flex-col items-center justify-center relative overflow-hidden">
                 {/* Futuristic background effects */}
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-20" />
                 <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-20" />
                 
                 <div className="relative group">
                    <div className="absolute inset-0 bg-primary/30 blur-[120px] rounded-full group-hover:bg-primary/40 transition-all duration-1000" />
                    <div className="relative border border-white/10 bg-zinc-900/60 backdrop-blur-3xl p-20 rounded-[48px] border-t-white/20 shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center transform transition-transform duration-700 hover:scale-105">
                      <div className="inline-block px-4 py-1 rounded-full border border-primary/30 bg-primary/5 text-[10px] font-black text-primary tracking-[0.4em] mb-8 uppercase">Handoff Mode</div>
                      <h3 className="text-4xl font-black text-white italic tracking-tighter mb-6">NEXUS CORE</h3>
                      <div className="h-0.5 w-16 bg-primary mx-auto mb-8 shadow-[0_0_15px_rgba(var(--primary),0.8)]" />
                      <p className="text-[11px] text-zinc-400 max-w-[240px] mx-auto uppercase tracking-[0.2em] leading-relaxed font-bold">
                        Interface em standby. Inicialize um canal para visualização de dados.
                      </p>
                    </div>
                 </div>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-16 animate-in fade-in duration-700">
               <div className="bg-card border border-white/10 rounded-[32px] p-10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <div className="text-[40px] font-black italic tracking-tighter">NX</div>
                  </div>
                  <CRMContentSwitch tab={activeTab} />
               </div>
            </div>
          )}
        </div>
      </NexusLayout>
    </CRMThemeProvider>
  );
}
