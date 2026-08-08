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
    <div className="flex h-full bg-[#fafafa] dark:bg-zinc-950 font-sans">
      {/* Slim Sidebar */}
      <div className="w-24 bg-white border-r border-zinc-100 flex flex-col items-center py-10 gap-10">
        <div className="h-14 w-14 rounded-[22px] bg-primary/5 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <Briefcase className="h-6 w-6" />
        </div>
        <div className="flex-1 flex flex-col gap-6">
            {menuItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                        "h-14 w-14 rounded-[22px] flex items-center justify-center transition-all relative group",
                        activeTab === item.id 
                            ? "bg-primary text-primary-foreground shadow-[0_20px_40px_-10px_rgba(var(--primary),0.3)] scale-110" 
                            : "text-zinc-400 hover:bg-zinc-50 hover:text-primary"
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
      <div className="flex-1 flex flex-col overflow-hidden p-12">
        <div className="flex-1 bg-white border border-zinc-100 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.04)] rounded-[60px] overflow-hidden flex flex-col">
            {children}
        </div>
      </div>
    </div>
  );
}
