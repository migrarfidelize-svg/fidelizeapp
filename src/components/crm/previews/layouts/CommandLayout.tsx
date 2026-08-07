import { ReactNode } from "react";
import { MessageSquare, History, UserCheck, GitBranch, Contact, FileText, Smartphone, Settings2, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function CommandLayout({ children, activeTab, setActiveTab }: LayoutProps) {
  const menuItems = [
    { id: "conversas", label: "Conversas", icon: MessageSquare, group: "OPERAÇÃO" },
    { id: "fila", label: "Fila", icon: History, group: "OPERAÇÃO" },
    { id: "agente", label: "Agente", icon: UserCheck, group: "AUTOMAÇÃO" },
    { id: "fluxos", label: "Fluxos", icon: GitBranch, group: "AUTOMAÇÃO" },
    { id: "contatos", label: "Contatos", icon: Contact, group: "SISTEMA" },
    { id: "templates", label: "Templates", icon: FileText, group: "SISTEMA" },
    { id: "otp", label: "OTP", icon: Smartphone, group: "SISTEMA" },
    { id: "config", label: "Config", icon: Settings2, group: "SISTEMA" },
  ];

  const groups = ["OPERAÇÃO", "AUTOMAÇÃO", "SISTEMA"];

  return (
    <div className="flex h-full bg-[#f8f9fa] dark:bg-zinc-950">
      {/* Sidebar Rail */}
      <div className="w-64 bg-card border-r flex flex-col">
        <div className="p-6 border-b flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg gradient-brand flex items-center justify-center text-white">
                <LayoutGrid className="h-5 w-5" />
            </div>
            <span className="font-black text-sm tracking-tighter">OPS CENTER</span>
        </div>
        <div className="flex-1 py-4 space-y-6 overflow-y-auto">
            {groups.map(group => (
                <div key={group} className="px-4 space-y-1">
                    <div className="px-2 mb-2 text-[10px] font-black text-muted-foreground tracking-widest">{group}</div>
                    {menuItems.filter(i => i.group === group).map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all",
                                activeTab === item.id 
                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </button>
                    ))}
                </div>
            ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
