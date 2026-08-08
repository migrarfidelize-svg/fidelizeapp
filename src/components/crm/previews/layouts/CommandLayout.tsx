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
    <div className="flex h-full bg-background dark:bg-zinc-950 font-sans text-foreground">
      {/* Sidebar Rail */}
      <div className="w-56 bg-zinc-900 border-r border-white/5 flex flex-col shadow-2xl z-10">
        <div className="p-4 border-b border-white/5 flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground">
                <LayoutGrid className="h-3.5 w-3.5" />
            </div>
            <span className="font-black text-[10px] tracking-[0.2em] text-white">COMMAND / OPS</span>
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
                                "w-full flex items-center gap-2 px-3 py-1.5 rounded transition-all text-[11px] font-bold",
                                activeTab === item.id 
                                    ? "bg-primary text-primary-foreground" 
                                    : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
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
