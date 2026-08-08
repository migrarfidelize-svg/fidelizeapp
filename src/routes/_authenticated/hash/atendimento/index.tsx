import { Search, History, UserCheck, GitBranch, Contact, FileText, Smartphone, Settings2, MessageSquare, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_authenticated/hash/atendimento/")({
  component: AtendimentoCRM,
});

function AtendimentoCRM() {
  console.log("Rendering AtendimentoCRM (New Structure)");
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
    <div className="flex h-[calc(100vh-56px)] bg-background crm-enterprise-layout crm-scrollbar overflow-hidden -m-4 md:-m-6 lg:-m-7 relative">
      {/* Sidebar Interna */}
      <aside className="w-[var(--crm-sidebar-width)] border-r bg-sidebar flex flex-col shrink-0 z-30">
        <div className="h-[var(--crm-header-height)] flex items-center px-6 border-b font-bold tracking-tight text-xs opacity-60 uppercase">ATENDIMENTO</div>
        
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
      <main className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
        {/* Header Interno */}
        <header className="h-[var(--crm-header-height)] border-b px-8 flex items-center justify-between shrink-0 bg-background/50 backdrop-blur z-20">
          <div>
            <h1 className="text-sm font-bold uppercase tracking-widest">{navItems.find(i => i.id === activeTab)?.label}</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Afidelize Enterprise CRM</p>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex gap-4">
                {[ { label: "Abertas", val: stats?.open || 0 }, { label: "Fila", val: stats?.waiting || 0 } ].map(s => (
                    <div key={s.label} className="text-right">
                        <div className="text-[9px] font-bold text-muted-foreground uppercase">{s.label}</div>
                        <div className="text-sm font-black">{s.val}</div>
                    </div>
                ))}
             </div>
             <div className="w-[1px] h-6 bg-border mx-2" />
             <Link to="/hash/atendimento/preview" className="crm-button-secondary text-[10px] h-8">
                <Play className="h-3 w-3 mr-2" /> Previews
             </Link>
          </div>
        </header>

        {/* Conteúdo dinâmico */}
        <section className="flex-1 overflow-hidden relative">
            {activeTab === "templates" && <TemplateManager />}
            {activeTab === "otp" && <OTPEditor />}
            {activeTab === "config" && <AgentConfig />}
            {activeTab === "contatos" && <ContactManager />}
            {activeTab === "fluxos" && <FlowEditor flow={selectedFlow} onBack={() => { setActiveTab("conversas"); setSelectedFlow(null); }} />}
            {/* Outros tabs placeholders para implementação incremental */}
            {activeTab === "conversas" && <div className="p-8 text-sm text-muted-foreground">Área de Conversas (Em implementação com novo design)</div>}
            {activeTab === "fila" && <div className="p-8 text-sm text-muted-foreground">Fila de Atendimento (Em implementação)</div>}
        </section>
      </main>
    </div>
  );
}
