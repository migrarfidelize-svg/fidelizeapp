import { ReactNode } from "react";
import { MessageSquare, History, UserCheck, GitBranch, Contact, FileText, Smartphone, Settings2, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function PremiumLayout({ children, activeTab, setActiveTab }: LayoutProps) {
  const menuItems = [
    { id: "conversas", label: "Conversas", icon: MessageSquare },
    { id: "fila", label: "Fila", icon: History },
    { id: "agente", label: "Agente", icon: UserCheck },
    { id: "fluxos", label: "Fluxos", icon: GitBranch },
    { id: "contatos", label: "Contatos", icon: Contact },
    { id: "templates", label: "Templates", icon: FileText },
    { id: "otp", label: "OTP", icon: Smartphone },
    { id: "config", label: "Config", icon: Settings2 },
  ];

  return (
    <div className="flex h-full bg-white dark:bg-zinc-950 font-sans">
      {/* Slim Sidebar */}
      <div className="w-20 bg-card border-r flex flex-col items-center py-8 gap-8">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Briefcase className="h-6 w-6" />
        </div>
        <div className="flex-1 flex flex-col gap-4">
            {menuItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center transition-all relative group",
                        activeTab === item.id 
                            ? "bg-primary text-primary-foreground shadow-xl" 
                            : "text-muted-foreground hover:bg-muted"
                    )}
                >
                    <item.icon className="h-5 w-5" />
                    <div className="absolute left-full ml-4 px-3 py-1.5 bg-zinc-900 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                        {item.label}
                    </div>
                </button>
            ))}
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden p-8">
        <div className="flex-1 bg-card border shadow-2xl rounded-[40px] overflow-hidden flex flex-col">
            {children}
        </div>
      </div>
    </div>
  );
}
