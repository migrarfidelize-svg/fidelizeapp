import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { 
  PreviewAPremiumBanner, 
  PreviewBSponsoredFeed, 
  PreviewCSponsoredCarousel 
} from "@/components/DiscoverAdsPreviews";
import { Home, Wallet, QrCode, Bell, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/temp-previews")({
  component: PreviewsLayout,
});

function PreviewsLayout() {
  const [view, setView] = useState<"A" | "B" | "C">("A");
  const [adsPaused, setAdsPaused] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900 flex flex-col items-center py-10 px-4">
      {/* View Selector */}
      <div className="mb-6 flex flex-wrap justify-center gap-3">
        {(["A", "B", "C"] as const).map((v) => (
          <button 
            key={v}
            onClick={() => setView(v)}
            className={`px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg transition-all active:scale-95 ${
              view === v 
                ? "bg-primary text-primary-foreground scale-105 shadow-primary/20" 
                : "bg-card text-muted-foreground border border-border/40 hover:bg-muted"
            }`}
          >
            {v === "A" && "A. Premium Banner"}
            {v === "B" && "B. Sponsored Feed"}
            {v === "C" && "C. Carousel"}
          </button>
        ))}
      </div>

      {/* Admin Control Simulator */}
      <div className="mb-10 flex items-center gap-4 bg-card px-5 py-3 rounded-2xl border border-border/60 shadow-sm">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Super Admin Demo:</span>
        <label className="flex items-center cursor-pointer gap-2">
          <div className="relative">
            <input 
              type="checkbox" 
              className="sr-only" 
              checked={adsPaused} 
              onChange={() => setAdsPaused(!adsPaused)} 
            />
            <div className={`w-10 h-5 rounded-full transition-colors ${adsPaused ? "bg-muted" : "bg-primary/40"}`}></div>
            <div className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${adsPaused ? "translate-x-0" : "translate-x-5"}`}></div>
          </div>
          <span className="text-[10px] font-bold text-foreground">{adsPaused ? "Anúncios Pausados" : "Anúncios Ativos"}</span>
        </label>
      </div>

      {/* Mobile Frame */}
      <div className="w-full max-w-[390px] aspect-[9/19] bg-background rounded-[3.5rem] border-[10px] border-neutral-900 dark:border-neutral-800 overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-neutral-900 dark:border-neutral-800 rounded-b-3xl z-50 flex items-end justify-center pb-1">
          <div className="w-12 h-1 bg-neutral-800 rounded-full" />
        </div>
        
        <div className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-32">
          {view === "A" && <PreviewAPremiumBanner adsPaused={adsPaused} />}
          {view === "B" && <PreviewBSponsoredFeed adsPaused={adsPaused} />}
          {view === "C" && <PreviewCSponsoredCarousel adsPaused={adsPaused} />}
        </div>


        {/* Global Bottom Navigation with QR Focus */}
        <nav className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-background/80 backdrop-blur-xl border-t border-border/40 z-40">
          <div className="flex justify-between items-center relative">
            <NavItem icon={Home} label="Início" />
            <NavItem icon={Wallet} label="Carteira" />
            
            {/* CENTRAL QR ACTION (FAB) */}
            <div className="relative -mt-14">
              <div className="bg-primary h-16 w-16 rounded-full flex items-center justify-center text-primary-foreground shadow-2xl shadow-primary/40 border-[6px] border-background ring-1 ring-primary/10 active:scale-90 transition-transform">
                <QrCode className="h-7 w-7" />
              </div>
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-[0.2em] text-primary whitespace-nowrap">Capturar</span>
            </div>

            <NavItem icon={Bell} label="Avisos" />
            <NavItem icon={User} label="Perfil" />
          </div>
          <div className="mt-8 mx-auto w-32 h-1.5 bg-neutral-300 dark:bg-neutral-800 rounded-full" />
        </nav>
      </div>

      <div className="mt-12 max-w-xl text-center space-y-4">
        <p className="text-sm font-medium text-neutral-500">
          Esta é uma demonstração de integração de anúncios patrocinados.
        </p>
        <div className="flex flex-col gap-2 text-xs text-neutral-400 italic">
          <p>• Pressione o botão QR no centro para simular a ação principal.</p>
          <p>• Use o toggle acima para ver como a interface se comporta sem anúncios.</p>
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label }: any) {
  return (
    <div className="flex flex-col items-center gap-1.5 opacity-30 hover:opacity-100 transition-opacity cursor-pointer">
      <Icon className="h-5 w-5" />
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </div>
  );
}
