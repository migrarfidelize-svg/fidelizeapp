import { motion, AnimatePresence } from "framer-motion";
import { Search, QrCode, User, Compass, Clock, Sparkles, Star, Heart, Gift, ArrowRight, Filter, ChevronRight, Zap, Trophy, Target, MapPin, Tag, Smartphone, TrendingUp, Navigation, PlusCircle } from "lucide-react";
import { SponsoredAdCard, SponsoredAdData } from "./SponsoredAdCard";
import { cn } from "@/lib/utils";

const MOCK_ADS: SponsoredAdData[] = [
  { 
    id: "p1", 
    title: "Combo Premium Smash Burger", 
    merchantName: "Burger Club", 
    imageUrl: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?q=80&w=800",
    theme: "premium_dark",
    fidelizePrice: 3490,
    originalPrice: 4990,
    discountValue: 30,
    description: "Hambúrguer artesanal premiado com fritas e refrigerante gelado."
  },
  { 
    id: "p2", 
    title: "Café Especial Torra Fresca", 
    merchantName: "Café & Prosa", 
    imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800",
    theme: "editorial",
    benefitText: "Ganhe um cookie artesanal",
    description: "Grãos arábica selecionados para sua melhor experiência matinal."
  },
  {
    id: "p3",
    title: "Black Friday Antecipada",
    merchantName: "Loja Tech",
    imageUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=800",
    theme: "gradient_promo",
    discountLabel: "50% OFF",
    benefitText: "Frete Grátis Fidelize",
    description: "Toda a linha de eletrônicos pela metade do preço exclusivo para membros."
  },
  {
    id: "p4",
    title: "Minimal Glow Skin",
    merchantName: "Beauty Studio",
    imageUrl: "https://images.unsplash.com/photo-1560066984-1389b4cda4f1?q=80&w=800",
    theme: "minimal_product",
    fidelizePrice: 12000,
    originalPrice: 18000,
    description: "Tratamento facial minimalista para peles sensíveis."
  }
];

const CATEGORIES = [
  { id: "all", label: "Tudo", icon: "✨" },
  { id: "cafes", label: "Cafés", icon: "☕" },
  { id: "rest", label: "Restaurantes", icon: "🍔" },
  { id: "beauty", label: "Beleza", icon: "💅" },
  { id: "retail", label: "Varejo", icon: "🛍️" },
];

export function Preview1PremiumClean() {
  return (
    <div className="bg-neutral-50 dark:bg-neutral-950 min-h-screen font-sans pb-32">
      {/* Header Premium */}
      <header className="px-6 pt-8 pb-6 bg-white dark:bg-neutral-900 shadow-sm sticky top-0 z-30">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-primary rounded-xl flex items-center justify-center text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-display font-black tracking-tight text-foreground">Descobrir</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="h-10 w-10 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground transition-transform active:scale-90">
              <Navigation className="h-5 w-5" />
            </button>
            <button className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20 transition-transform active:scale-90">
              <QrCode className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
          <input className="w-full bg-neutral-100 dark:bg-neutral-800 border-none py-3.5 pl-12 pr-4 rounded-2xl text-sm focus:ring-2 ring-primary/20 outline-none" placeholder="O que você procura hoje?" />
        </div>
      </header>

      <main className="px-6 mt-8 space-y-12">
        {/* Categorias */}
        <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((cat, i) => (
            <button key={cat.id} className={cn(
              "shrink-0 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all",
              i === 0 ? "bg-primary text-primary-foreground shadow-lg shadow-primary/10" : "bg-card border border-border/60 text-muted-foreground hover:bg-muted"
            )}>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Patrocinado Premium Dark */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-primary" /> Sugestão Fidelize
            </h2>
          </div>
          <SponsoredAdCard data={MOCK_ADS[0]} model="premium_banner" />
        </section>

        {/* Continue Fidelizando */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="font-display text-lg font-black tracking-tight">Continue fidelizando</h2>
            <button className="text-[10px] font-black uppercase text-primary">Ver tudo</button>
          </div>
          <div className="space-y-4">
            <div className="bg-card p-5 rounded-[2.5rem] border border-border/50 shadow-sm flex items-center gap-4 group cursor-pointer hover:border-primary/30 transition-colors">
              <div className="h-16 w-16 rounded-[1.8rem] bg-primary/5 border border-primary/10 flex items-center justify-center text-3xl">☕</div>
              <div className="flex-1">
                <h3 className="font-bold text-sm">Artisan Coffee</h3>
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: "80%" }} className="h-full bg-primary" />
                  </div>
                  <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Faltam 2</span>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
            </div>
          </div>
        </section>

        {/* Perto de Você */}
        <section>
          <h2 className="font-display text-lg font-black tracking-tight mb-4 px-1">Perto de você</h2>
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-card border border-border/60 rounded-[3rem] overflow-hidden group">
              <div className="aspect-[21/9] bg-primary/5 relative flex items-center justify-center text-6xl">
                🥗
                <button className="absolute top-5 right-5 h-10 w-10 rounded-full bg-white/80 dark:bg-black/40 backdrop-blur shadow-sm flex items-center justify-center">
                  <Heart className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-7 flex justify-between items-end">
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-black text-primary/60">Saudável • 400m</span>
                  <h3 className="font-display text-xl font-bold mt-1.5 tracking-tight">The Green Bowl</h3>
                  <p className="text-xs text-muted-foreground mt-2 font-medium flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary" /> Suco natural grátis
                  </p>
                </div>
                <button className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20 active:scale-90 transition-transform">
                  <PlusCircle className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export function Preview2Editorial() {
  return (
    <div className="bg-[#FAF9F6] min-h-screen font-serif pb-32">
      <header className="px-6 pt-12 pb-8 text-center sticky top-0 bg-[#FAF9F6]/80 backdrop-blur-md z-30">
        <h1 className="text-5xl font-bold italic tracking-tighter lowercase text-neutral-900">Afidelize</h1>
        <div className="flex items-center justify-center gap-3 mt-4">
          <span className="h-[1px] w-8 bg-neutral-300" />
          <span className="text-[10px] font-sans uppercase tracking-[0.3em] text-neutral-400">Edição Discovery</span>
          <span className="h-[1px] w-8 bg-neutral-300" />
        </div>
      </header>

      <main className="px-6 space-y-16 mt-4">
        {/* Busca Editorial */}
        <div className="relative border-b border-neutral-200 pb-2">
          <input className="w-full bg-transparent border-none py-2 text-lg italic outline-none placeholder:text-neutral-300 text-neutral-900" placeholder="Procure algo extraordinário..." />
          <Search className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-300" />
        </div>

        {/* Patrocinado Editorial */}
        <section>
          <div className="mb-6 text-center">
            <span className="text-[9px] font-sans font-black uppercase tracking-[0.4em] text-neutral-400">Em Destaque</span>
          </div>
          <SponsoredAdCard data={MOCK_ADS[1]} model="premium_banner" />
        </section>

        {/* Categorias em Texto */}
        <div className="flex gap-8 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-y border-neutral-100 py-6">
          {CATEGORIES.map(cat => (
            <button key={cat.id} className="shrink-0 font-sans text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 hover:text-neutral-900 transition-colors">
              {cat.label}
            </button>
          ))}
        </div>

        {/* Recompensas / Próximos passos */}
        <section>
          <h2 className="text-2xl italic mb-8 text-neutral-900">Suas Próximas Conquistas</h2>
          <div className="space-y-12">
            <div className="flex items-center gap-6 group cursor-pointer">
              <div className="h-20 w-20 rounded-full bg-neutral-100 flex items-center justify-center text-4xl group-hover:scale-105 transition-transform">🍝</div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900 tracking-tight">Bella Pasta</h3>
                <p className="font-sans text-[10px] uppercase tracking-widest text-neutral-400 mt-1">Faltam 6 carimbos</p>
                <div className="mt-4 w-40 h-[1px] bg-neutral-200 relative">
                  <div className="absolute inset-0 w-1/3 bg-neutral-900" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export function Preview3ModernDark() {
  return (
    <div className="bg-[#050505] min-h-screen font-sans text-white pb-32 selection:bg-primary selection:text-white">
      {/* Glass Header */}
      <header className="px-6 pt-10 pb-6 sticky top-0 bg-black/40 backdrop-blur-2xl border-b border-white/5 z-30">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-8 bg-primary rounded-full" />
            <h1 className="text-xl font-black tracking-tighter italic">DISCOVER</h1>
          </div>
          <div className="flex gap-4">
            <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <User className="h-4 w-4" />
            </div>
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary),0.3)]">
              <QrCode className="h-5 w-5" />
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 mt-8 space-y-12">
        {/* Search Neon */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
          <div className="relative bg-neutral-900 rounded-2xl flex items-center p-1">
            <Search className="h-5 w-5 ml-4 text-white/30" />
            <input className="bg-transparent border-none py-3 px-4 text-sm w-full outline-none placeholder:text-white/20" placeholder="Buscar vibes..." />
            <div className="h-10 w-10 bg-white/5 rounded-xl flex items-center justify-center mr-1">
              <Filter className="h-4 w-4 text-white/40" />
            </div>
          </div>
        </div>

        {/* Sponsored Gradient Promo */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Drop Exclusivo</span>
          </div>
          <SponsoredAdCard data={MOCK_ADS[2]} model="premium_banner" />
        </section>

        {/* Gamified Rewards */}
        <section className="bg-neutral-900/40 rounded-[2.5rem] border border-white/5 p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-[80px] -mr-20 -mt-20" />
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-black uppercase italic tracking-widest text-primary">Level Up</h2>
            <Trophy className="h-6 w-6 text-yellow-500" />
          </div>
          
          <div className="space-y-6">
            <div className="relative p-6 bg-black/40 rounded-3xl border border-white/5 group hover:border-primary/30 transition-all cursor-pointer">
              <div className="flex items-center gap-5">
                <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center text-4xl shadow-inner shadow-primary/10">🍔</div>
                <div className="flex-1">
                  <h3 className="font-black uppercase tracking-tight text-sm">Burger Station</h3>
                  <p className="text-[10px] font-black text-white/40 mt-1 uppercase tracking-widest">9 de 10 carimbos</p>
                  <div className="mt-4 flex gap-1.5">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className={cn(
                        "h-1.5 flex-1 rounded-full",
                        i < 9 ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "bg-white/10"
                      )} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 w-full py-3 bg-primary/10 border border-primary/20 rounded-xl text-[9px] font-black uppercase tracking-[0.3em] text-primary text-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                Resgatar prêmio
              </div>
            </div>
          </div>
        </section>

        {/* Perto de você - Minimal Feed */}
        <section>
          <h2 className="text-lg font-black uppercase italic tracking-widest mb-6 px-1">Near You</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: "Urban Barbers", cat: "Beleza", dist: "1.2km", icon: "✂️" },
              { name: "Sweet Bliss", cat: "Doces", dist: "800m", icon: "🍦" }
            ].map(e => (
              <div key={e.name} className="bg-neutral-900/50 rounded-[2rem] border border-white/5 p-5 group hover:bg-neutral-900 transition-colors cursor-pointer">
                <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                  {e.icon}
                </div>
                <h3 className="font-bold text-xs uppercase tracking-tight truncate">{e.name}</h3>
                <span className="text-[8px] font-black uppercase tracking-widest text-white/30 mt-1 block">{e.cat} • {e.dist}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
