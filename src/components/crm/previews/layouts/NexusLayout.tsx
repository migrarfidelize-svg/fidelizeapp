import { ReactNode } from "react";
import { MessageSquare, History, UserCheck, GitBranch, Contact, FileText, Smartphone, Settings2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function NexusLayout({ children, activeTab, setActiveTab }: LayoutProps) {
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
    <div className="flex h-full bg-black text-zinc-400">
      {/* Futuristic Sidebar */}
      <div className="w-72 border-r border-zinc-800 flex flex-col bg-zinc-950/50 backdrop-blur-xl">
        <div className="p-8 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full border-2 border-primary flex items-center justify-center text-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]">
                <Zap className="h-5 w-5 fill-primary" />
            </div>
            <div>
                <div className="font-black text-white tracking-widest text-lg italic">NEXUS</div>
                <div className="text-[8px] font-bold text-primary animate-pulse tracking-[0.3em]">SYSTEM ACTIVE</div>
            </div>
        </div>
        <div className="flex-1 py-4 px-4 space-y-1">
            {menuItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                        "w-full flex items-center gap-4 px-4 py-3 rounded-xl text-xs font-bold transition-all border border-transparent",
                        activeTab === item.id 
                            ? "bg-zinc-900 border-zinc-800 text-white shadow-2xl" 
                            : "hover:bg-white/5"
                    )}
                >
                    <item.icon className={cn("h-4 w-4 transition-colors", activeTab === item.id ? "text-primary" : "")} />
                    {item.label}
                    {activeTab === item.id && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_#fff]" />}
                </button>
            ))}
        </div>
        <div className="p-8 border-t border-zinc-800">
            <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                <div className="text-[8px] font-black uppercase tracking-widest mb-2">Network Status</div>
                <div className="flex gap-1">
                    {[1,2,3,4,5].map(i => <div key={i} className="flex-1 h-1 bg-primary rounded-full shadow-[0_0_5px_rgba(var(--primary),0.5)]" />)}
                </div>
            </div>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(var(--primary),0.05),transparent)]">
        {children}
      </div>
    </div>
  );
}
