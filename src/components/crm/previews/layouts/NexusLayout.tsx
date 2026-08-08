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
      <div className="w-72 border-r border-white/5 flex flex-col bg-black/60 backdrop-blur-3xl z-20">
        <div className="p-10 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl border border-primary/30 bg-primary/5 flex items-center justify-center text-primary shadow-[0_0_30px_rgba(var(--primary),0.2)]">
                <Zap className="h-6 w-6 fill-primary" />
            </div>
            <div>
                <div className="font-black text-white tracking-[0.3em] text-xl italic uppercase">Nexus</div>
                <div className="text-[7px] font-black text-primary animate-pulse tracking-[0.5em] mt-1">CORE AUTHENTICATED</div>
            </div>
        </div>
        <div className="flex-1 py-4 px-4 space-y-1">
            {menuItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                        "w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border border-white/5 relative group overflow-hidden",
                        activeTab === item.id 
                            ? "bg-primary text-primary-foreground border-primary/50 shadow-[0_0_40px_rgba(var(--primary),0.3)]" 
                            : "text-zinc-500 hover:bg-white/5 hover:text-white"
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
