import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Preview1Premium, Preview2Marketplace, Preview3Gamification } from "@/components/DiscoverPreviews";
import { Home, Wallet, Compass, Bell, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/temp-previews")({
  component: PreviewsLayout,
});

function PreviewsLayout() {
  const [view, setView] = useState<"premium" | "marketplace" | "gamified">("premium");

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900 flex flex-col items-center py-10 px-4">
      <div className="mb-8 flex flex-wrap justify-center gap-3">
        {(["premium", "marketplace", "gamified"] as const).map((v) => (
          <button 
            key={v}
            onClick={() => setView(v)}
            className={`px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 ${
              view === v 
                ? "bg-primary text-primary-foreground scale-105 shadow-primary/20" 
                : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50"
            }`}
          >
            {v === "premium" && "1. Premium Clean"}
            {v === "marketplace" && "2. Marketplace"}
            {v === "gamified" && "3. Gamificação"}
          </button>
        ))}
      </div>

      {/* Mobile Frame */}
      <div className="w-full max-w-[390px] aspect-[9/19] bg-background rounded-[3.5rem] border-[10px] border-neutral-900 dark:border-neutral-800 overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-neutral-900 dark:border-neutral-800 rounded-b-3xl z-50 flex items-end justify-center pb-1">
          <div className="w-12 h-1 bg-neutral-800 rounded-full" />
        </div>
        
        <div className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {view === "premium" && <Preview1Premium />}
          {view === "marketplace" && <Preview2Marketplace />}
          {view === "gamified" && <Preview3Gamification />}
        </div>

        {/* Proposta de Navegação Inferior (Fixa no frame) */}
        <nav className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-2 bg-background/80 backdrop-blur-lg border-t border-border/40 z-40">
          <div className="flex justify-between items-center relative">
            <div className="flex flex-col items-center gap-1 opacity-40">
              <Home className="h-6 w-6" />
              <span className="text-[9px] font-bold uppercase tracking-widest">Início</span>
            </div>
            <div className="flex flex-col items-center gap-1 opacity-40">
              <Wallet className="h-6 w-6" />
              <span className="text-[9px] font-bold uppercase tracking-widest">Carteira</span>
            </div>
            
            {/* FAB central fixo conforme arquitetura sugerida */}
            <div className="relative -mt-10">
              <div className="bg-primary h-14 w-14 rounded-full flex items-center justify-center text-white shadow-xl shadow-primary/40 border-4 border-background ring-2 ring-primary/20">
                <Compass className="h-7 w-7" />
              </div>
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-widest text-primary whitespace-nowrap">Descobrir</span>
            </div>

            <div className="flex flex-col items-center gap-1 opacity-40">
              <Bell className="h-6 w-6" />
              <span className="text-[9px] font-bold uppercase tracking-widest">Avisos</span>
            </div>
            <div className="flex flex-col items-center gap-1 opacity-40">
              <User className="h-6 w-6" />
              <span className="text-[9px] font-bold uppercase tracking-widest">Perfil</span>
            </div>
          </div>
          {/* Home Indicator */}
          <div className="mt-6 mx-auto w-32 h-1 bg-neutral-300 dark:bg-neutral-800 rounded-full" />
        </nav>
      </div>

      <div className="mt-12 max-w-2xl text-center text-neutral-500 dark:text-neutral-400 space-y-2">
        <p className="text-sm">Os previews acima são protótipos de UX para validação.</p>
        <p className="text-xs opacity-60 italic">Navegue até /temp-previews no seu preview para ver em tela cheia.</p>
      </div>
    </div>
  );
}