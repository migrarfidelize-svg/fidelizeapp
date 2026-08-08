import { Search, History, UserCheck, GitBranch, Contact, FileText, Smartphone, Settings2, MessageSquare, ChevronLeft, ChevronRight, Moon, Sun, ShieldCheck, ShieldAlert, Menu } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  getCRMStats,
  getWhatsAppInstanceStatus
} from "@/lib/atendimento.functions";
import { cn } from "@/lib/utils";
import { TemplateManager } from "@/components/crm/TemplateManager";
import { OTPEditor } from "@/components/crm/OTPEditor";
import { AgentConfig } from "@/components/crm/AgentConfig";
import { ContactManager } from "@/components/crm/ContactManager";
import { FlowEditor } from "@/components/crm/FlowEditor";
import { WhatsAppManager } from "@/components/crm/WhatsAppManager";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTheme } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_authenticated/hash/atendimento/")({
  component: AtendimentoCRM,
});

function AtendimentoCRM() {
  const { theme, toggle } = useTheme();
  const [activeTab, setActiveTab] = useState("conversas");
  const [selectedFlow, setSelectedFlow] = useState<any>(null);
  const { data: stats } = useQuery({ queryKey: ["crm-stats"], queryFn: () => getCRMStats() });

  const navItems = [
    { id: "conversas", label: "Conversas", icon: MessageSquare, group: "Operação" },
    { id: "fila", label: "Fila", icon: History, group: "Operação" },
    { id: "contatos", label: "Contatos", icon: Contact, group: "Operação" },
    { id: "agente", label: "Agente", icon: UserCheck, group: "Automação" },
    { id: "fluxos", label: "Fluxos", icon: GitBranch, group: "Automação" },
    { id: "templates", label: "Templates", icon: FileText, group: "Comunicação" },
    { id: "otp", label: "OTP", icon: MessageSquare, group: "Comunicação" },
    { id: "whatsapp", label: "WhatsApp", icon: Smartphone, group: "Comunicação" },
    { id: "config", label: "Configurações", icon: Settings2, group: "Sistema" },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative crm-enterprise-layout">
      {/* Object Dock Superior */}
      <header className="h-14 border-b flex items-center justify-between px-4 bg-background z-20 shrink-0">
        <div className="flex items-center h-full overflow-x-auto no-scrollbar gap-1">
          {navItems.map((item, idx) => {
            const isFirstInSection = idx === 0 || navItems[idx - 1].group !== item.group;
            return (
              <div key={item.id} className="flex items-center h-full">
                {isFirstInSection && idx !== 0 && (
                  <div className="w-[1px] h-6 bg-border mx-2" />
                )}
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 h-9 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                    activeTab === item.id 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 pl-4 border-l ml-2">
            <button
                onClick={toggle}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted"
            >
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
        </div>
      </header>

      {/* Conteúdo CRM */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === "conversas" && (
            <div className="flex h-full w-full">
                {/* Lista */}
                <div className="w-80 border-r flex flex-col">
                    <div className="h-12 border-b flex items-center px-4">
                        <input className="w-full text-xs bg-muted/50 px-2 py-1 rounded" placeholder="Buscar conversas..." />
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {/* Lista de conversas */}
                        <div className="text-xs text-muted-foreground p-4 text-center">Nenhuma conversa encontrada.</div>
                    </div>
                </div>
                {/* Chat */}
                <div className="flex-1 flex flex-col border-r">
                    <div className="h-14 border-b flex items-center px-4 font-bold text-sm">Conversa ativa</div>
                    <div className="flex-1 bg-muted/10"></div>
                    <div className="h-20 border-t p-2">
                        <textarea className="w-full h-full text-xs p-2" placeholder="Digite uma mensagem..." />
                    </div>
                </div>
                {/* Detalhes */}
                <div className="w-72">
                    <div className="h-14 border-b flex items-center px-4 font-bold text-sm">Detalhes</div>
                </div>
            </div>
        )}

        {/* Renderização de outros componentes (ajustar conforme necessário) */}
        {activeTab !== "conversas" && (
            <div className="h-full overflow-y-auto p-8">
              {activeTab === "fila" && <p>Visualização de Fila</p>}
              {activeTab === "contatos" && <ContactManager />}
              {activeTab === "agente" && <AgentConfig />}
              {activeTab === "fluxos" && <FlowEditor flow={selectedFlow} onBack={() => { setActiveTab("conversas"); setSelectedFlow(null); }} />}
              {activeTab === "templates" && <TemplateManager />}
              {activeTab === "otp" && <OTPEditor />}
              {activeTab === "whatsapp" && <WhatsAppManager />}
              {activeTab === "config" && <p>Configurações gerais</p>}
            </div>
        )}
      </main>
    </div>
  );
}
