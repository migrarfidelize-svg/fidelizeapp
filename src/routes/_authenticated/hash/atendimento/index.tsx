import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { FlowsView } from "@/components/crm/FlowsView";
import { WhatsAppManager } from "@/components/crm/WhatsAppManager";

import { BroadcastManager } from "@/components/crm/broadcasts/BroadcastManager";
import { MessageSquare, History, Contact, UserCheck, GitBranch, FileText, Smartphone, Settings2, Moon, Sun, Search, Bell, Plus, Filter, SendHorizontal } from "lucide-react";
import { useTheme } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_authenticated/hash/atendimento/")({
  component: AtendimentoCRM,
});

function AtendimentoCRM() {
  const { theme, toggle } = useTheme();
  const [activeTab, setActiveTab] = useState("conversas");
  const [selectedFlow, setSelectedFlow] = useState<any>(null);
  
  const navItems = [
    { group: "Operação", items: [
      { id: "conversas", label: "Conversas", icon: MessageSquare },
      { id: "fila", label: "Fila", icon: History },
      { id: "contatos", label: "Contatos", icon: Contact },
      { id: "disparos", label: "Disparos", icon: SendHorizontal },
    ]},
    { group: "Automação", items: [
      { id: "agente", label: "Agente", icon: UserCheck },
      { id: "fluxos", label: "Fluxos", icon: GitBranch, subId: "fluxos_editor" },
    ]},
    { group: "Comunicação", items: [
      { id: "templates", label: "Templates", icon: FileText },
      { id: "otp", label: "OTP", icon: MessageSquare },
      { id: "whatsapp", label: "WhatsApp", icon: Smartphone },
    ]},
    { group: "Sistema", items: [
      { id: "config", label: "Configurações", icon: Settings2 },
    ]},
  ];

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      {/* Object Dock Superior */}
      <header className="h-14 border-b flex items-center justify-between px-4 bg-card shrink-0">
        <div className="flex items-center h-full gap-6">
          {navItems.map((group, gIdx) => (
            <div key={group.group} className="flex items-center gap-1 h-full">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setSelectedFlow(null); }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all border border-transparent",
                    activeTab === item.id 
                      ? "bg-primary/10 text-primary border-primary/20 shadow-sm" 
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              ))}
              {gIdx < navItems.length - 1 && <div className="w-[1px] h-4 bg-border mx-2" />}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
            <button onClick={toggle} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground">
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
        </div>
      </header>

      {/* Conteúdo CRM */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === "conversas" ? (
          <div className="flex h-full w-full">
            <div className="w-80 border-r flex flex-col bg-card">
              <div className="h-12 border-b flex items-center px-4 gap-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input className="flex-1 text-xs bg-transparent outline-none" placeholder="Buscar..." />
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 p-2 space-y-1">
                <div className="text-xs text-muted-foreground p-4 text-center">Nenhuma conversa.</div>
              </div>
            </div>
            <div className="flex-1 flex flex-col bg-background">
              <div className="h-12 border-b flex items-center px-4 justify-between">
                <span className="font-semibold text-sm">Selecione uma conversa</span>
              </div>
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
                Selecione uma conversa para começar a atender.
              </div>
              <div className="h-16 border-t p-2 flex items-center gap-2">
                <textarea className="flex-1 bg-muted/30 rounded-md p-2 text-xs h-full resize-none" placeholder="Digite uma mensagem..." />
                <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-xs font-semibold">Enviar</button>
              </div>
            </div>
            <div className="w-72 border-l bg-card hidden md:block">
              <div className="h-12 border-b flex items-center px-4 text-sm font-semibold">Contato</div>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-8">
            {activeTab === "fila" && <p>Visualização de Fila</p>}
            {activeTab === "contatos" && <ContactManager />}
            {activeTab === "disparos" && <BroadcastManager />}
            {activeTab === "agente" && <AgentConfig />}
            {activeTab === "fluxos" && (
              <FlowsView 
                onEdit={(flow) => {
                  setSelectedFlow(flow);
                  setActiveTab("fluxos_editor");
                }} 
              />
            )}
            {activeTab === "fluxos_editor" && (
              <FlowEditor 
                flow={selectedFlow} 
                onBack={() => { 
                  setActiveTab("fluxos"); 
                  setSelectedFlow(null); 
                }} 
              />
            )}


            {activeTab === "templates" && <TemplateManager />}
            {activeTab === "otp" && <OTPEditor />}
            {activeTab === "whatsapp" && <WhatsAppManager />}
            {activeTab === "config" && <p>Configurações de atendimento</p>}
          </div>
        )}
      </main>
    </div>
  );
}
