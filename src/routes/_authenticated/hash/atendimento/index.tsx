import { Search, History, UserCheck, GitBranch, Contact, FileText, Smartphone, Settings2, MessageSquare, ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  getCRMStats
} from "@/lib/atendimento.functions";
import { cn } from "@/lib/utils";
import { TemplateManager } from "@/components/crm/TemplateManager";
import { OTPEditor } from "@/components/crm/OTPEditor";
import { AgentConfig } from "@/components/crm/AgentConfig";
import { ContactManager } from "@/components/crm/ContactManager";
import { FlowEditor } from "@/components/crm/FlowEditor";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_authenticated/hash/atendimento/")({
  component: AtendimentoCRM,
});

function AtendimentoCRM() {
  const { theme, toggle } = useTheme();
  const [activeTab, setActiveTab] = useState("conversas");
  const [selectedFlow, setSelectedFlow] = useState<any>(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("crm-sidebar-collapsed");
      if (saved !== null) return saved === "true";
      return window.innerWidth < 1024;
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("crm-sidebar-collapsed", String(isCollapsed));
  }, [isCollapsed]);

  const { data: stats } = useQuery({ queryKey: ["crm-stats"], queryFn: () => getCRMStats() });

  const navItems = [
    { id: "conversas", label: "Conversas", icon: MessageSquare },
    { id: "fila", label: "Fila", icon: History },
    { id: "contatos", label: "Contatos", icon: Contact },
    { id: "agente", label: "Agente", icon: UserCheck },
    { id: "fluxos", label: "Fluxos", icon: GitBranch },
    { id: "templates", label: "Templates", icon: FileText },
    { id: "otp", label: "OTP", icon: Smartphone },
    { id: "config", label: "Configurações", icon: Settings2 },
  ];

  return (
    <TooltipProvider delayDuration={400}>
      <div className={cn(
        "flex h-[calc(100dvh-56px)] bg-background crm-enterprise-layout crm-scrollbar overflow-hidden -m-4 md:-m-6 lg:-m-7 relative",
        isCollapsed && "crm-sidebar-collapsed"
      )}>
        {/* Sidebar Interna Nexus */}
        <aside className="w-[var(--crm-sidebar-width)] border-r bg-sidebar flex flex-col shrink-0 z-30 transition-all duration-300 relative">
          <div className="h-[var(--crm-header-height)] flex items-center px-6 border-b font-bold tracking-tight text-xs opacity-60 uppercase relative">
            ATENDIMENTO
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => setIsCollapsed(true)}
                  className="crm-collapse-trigger crm-collapse-trigger-hide"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Ocultar menu</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex-1 overflow-y-auto py-4 crm-scrollbar">
            <div className="crm-sidebar-section-label">Operação</div>
            {navItems.filter(i => ["conversas", "fila", "contatos"].includes(i.id)).map(item => (
              <button 
                  key={item.id} 
                  onClick={() => setActiveTab(item.id)}
                  className={cn("crm-sidebar-item", activeTab === item.id && "active")}
              >
                  <item.icon className="h-4 w-4" />
                  {item.label}
              </button>
            ))}
            
            <div className="crm-sidebar-section-label">Automação</div>
            {navItems.filter(i => ["agente", "fluxos"].includes(i.id)).map(item => (
              <button 
                  key={item.id} 
                  onClick={() => setActiveTab(item.id)}
                  className={cn("crm-sidebar-item", activeTab === item.id && "active")}
              >
                  <item.icon className="h-4 w-4" />
                  {item.label}
              </button>
            ))}
            
            <div className="crm-sidebar-section-label">Comunicação</div>
            {navItems.filter(i => ["templates", "otp"].includes(i.id)).map(item => (
              <button 
                  key={item.id} 
                  onClick={() => setActiveTab(item.id)}
                  className={cn("crm-sidebar-item", activeTab === item.id && "active")}
              >
                  <item.icon className="h-4 w-4" />
                  {item.label}
              </button>
            ))}

            <div className="crm-sidebar-section-label">Sistema</div>
            {navItems.filter(i => ["config"].includes(i.id)).map(item => (
              <button 
                  key={item.id} 
                  onClick={() => setActiveTab(item.id)}
                  className={cn("crm-sidebar-item", activeTab === item.id && "active")}
              >
                  <item.icon className="h-4 w-4" />
                  {item.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Área Principal */}
        <main className="flex-1 flex flex-col h-full bg-background min-h-0 min-w-0 overflow-hidden relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => setIsCollapsed(false)}
                className="crm-collapse-trigger crm-collapse-trigger-expand"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expandir menu</TooltipContent>
          </Tooltip>

          {/* Header Interno */}
          <header className="h-[var(--crm-header-height)] border-b px-8 flex items-center justify-between shrink-0 bg-background/50 backdrop-blur z-20">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary z-50 flex items-center justify-center">
              <span className="bg-primary text-primary-foreground text-[10px] font-black px-4 py-0.5 rounded-b-md shadow-lg">
                NEXUS LIVE — c8d1e2f
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold uppercase tracking-widest truncate">{navItems.find(i => i.id === activeTab)?.label}</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest truncate">Afidelize Nexus Enterprise</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
               <div className="hidden sm:flex gap-4">
                  {[ { label: "Abertas", val: stats?.open || 0 }, { label: "Fila", val: stats?.waiting || 0 } ].map(s => (
                      <div key={s.label} className="text-right">
                          <div className="text-[9px] font-bold text-muted-foreground uppercase">{s.label}</div>
                          <div className="text-sm font-black">{s.val}</div>
                      </div>
                  ))}
               </div>
               <div className="hidden sm:block w-[1px] h-6 bg-border mx-2" />
               <div className="flex items-center gap-2">
                 <button
                   onClick={toggle}
                   className="crm-button-secondary w-8 h-8 p-0 flex items-center justify-center"
                   title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
                 >
                   {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                 </button>
               </div>
            </div>
          </header>

          {/* Conteúdo dinâmico com scroll interno */}
          <section className="flex-1 overflow-y-auto crm-scrollbar relative min-h-0">
              {activeTab === "templates" && <TemplateManager />}
              {activeTab === "otp" && <OTPEditor />}
              {activeTab === "config" && <AgentConfig />}
              {activeTab === "contatos" && <ContactManager />}
              {activeTab === "fluxos" && <FlowEditor flow={selectedFlow} onBack={() => { setActiveTab("conversas"); setSelectedFlow(null); }} />}
              {activeTab === "conversas" && <div className="p-8 text-sm text-muted-foreground">Área de Conversas (Interface Nexus)</div>}
              {activeTab === "fila" && <div className="p-8 text-sm text-muted-foreground">Fila de Atendimento</div>}
          </section>
        </main>
      </div>
    </TooltipProvider>
  );
}
