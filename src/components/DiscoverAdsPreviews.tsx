import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, MapPin, Star, Heart, Gift, Clock, PlusCircle, 
  User, Home, Wallet, Compass, Bell, ArrowRight,
  Sparkles, ExternalLink, QrCode
} from "lucide-react";
import { useState } from "react";

// Shared data for simulation
const MOCK_ESTABLISHMENTS = [
  { id: 1, name: "The Green Bowl", cat: "Saudável", dist: "400m", reward: "Suco grátis", img: "🥗", rating: 4.8 },
  { id: 2, name: "Urban Barbers", cat: "Beleza", dist: "1.2km", reward: "Corte VIP", img: "✂️", rating: 4.7 },
  { id: 3, name: "Artisan Coffee", cat: "Cafés", dist: "200m", reward: "Café grátis", img: "☕", rating: 4.9 },
  { id: 4, name: "Bella Pasta", cat: "Restaurante", dist: "800m", reward: "Bruschetta", img: "🍝", rating: 4.6 }
];

const MOCK_ADS = [
  { 
    id: "ad1", 
    title: "Burger Club — Combo especial hoje", 
    merchant: "Burger Club", 
    benefit: "Batata grátis no primeiro pedido", 
    img: "🍔", 
    cta: "Aproveitar" 
  },
  { 
    id: "ad2", 
    title: "Barbearia VIP — 20% na primeira visita", 
    merchant: "Barbearia VIP", 
    benefit: "Desconto exclusivo Afidelize", 
    img: "💈", 
    cta: "Agendar" 
  },
  { 
    id: "ad3", 
    title: "Café & Prosa — Ganhe café grátis no 5º carimbo", 
    merchant: "Café & Prosa", 
    benefit: "Fidelidade acelerada", 
    img: "☕", 
    cta: "Visitar" 
  }
];

// Helper components
const SponsoredBadge = () => (
  <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
    <Sparkles className="h-2.5 w-2.5 text-primary mr-1" />
    <span className="text-[9px] font-black uppercase tracking-widest text-primary">Patrocinado</span>
  </div>
);

const SectionHeader = ({ title, icon: Icon, showAll = true }: { title: string, icon?: any, showAll?: boolean }) => (
  <div className="flex items-center justify-between mb-4">
    <h2 className="font-display text-lg font-bold flex items-center gap-2 text-foreground">
      {Icon && <Icon className="h-4 w-4 text-primary" />} {title}
    </h2>
    {showAll && <button className="text-xs font-bold text-primary/60 hover:text-primary transition-colors">Ver todos</button>}
  </div>
);

// --- PREVIEW A: PREMIUM BANNER ---
export function PreviewAPremiumBanner({ adsPaused = false }) {
  return (
    <div className="bg-background min-h-screen font-sans pb-24">
      <Header />
      <main className="px-6 space-y-10 mt-6">
        <Categories />
        
        {/* Sponsored Banner - Modular */}
        <AnimatePresence>
          {!adsPaused && (
            <motion.section 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="relative bg-card rounded-[2rem] border border-border/60 p-6 flex items-center gap-5 shadow-sm overflow-hidden group">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors" />
                
                <div className="h-20 w-20 rounded-2xl bg-primary/5 flex items-center justify-center text-4xl border border-primary/10">
                  {MOCK_ADS[0].img}
                </div>
                <div className="flex-1 min-w-0">
                  <SponsoredBadge />
                  <h3 className="font-display font-bold text-sm mt-2 leading-tight">{MOCK_ADS[0].title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{MOCK_ADS[0].benefit}</p>
                  <button className="mt-3 flex items-center text-[10px] font-black uppercase tracking-widest text-primary gap-1 group/btn">
                    {MOCK_ADS[0].cta} <ExternalLink className="h-3 w-3 transition-transform group-hover/btn:translate-x-0.5" />
                  </button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <section>
          <SectionHeader title="Continue fidelizando" icon={Clock} />
          <div className="space-y-4">
            <LoyaltyRow name="Artisan Coffee" progress={80} left={2} icon="☕" />
            <LoyaltyRow name="Bella Pasta" progress={40} left={6} icon="🍝" />
          </div>
        </section>

        <section>
          <SectionHeader title="Perto de você" />
          <div className="grid grid-cols-1 gap-6">
            {MOCK_ESTABLISHMENTS.slice(0, 2).map(e => <PremiumCard key={e.id} {...e} />)}
          </div>
        </section>
      </main>
    </div>
  );
}

// --- PREVIEW B: SPONSORED FEED ---
export function PreviewBSponsoredFeed({ adsPaused = false }) {
  return (
    <div className="bg-background min-h-screen font-sans pb-24">
      <Header />
      <main className="px-6 space-y-10 mt-6">
        <Categories />
        
        <section>
          <SectionHeader title="Perto de você" />
          <div className="grid grid-cols-1 gap-6">
            <PremiumCard {...MOCK_ESTABLISHMENTS[0]} />
            
            {/* Integrated Sponsored Card */}
            <AnimatePresence>
              {!adsPaused && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="bg-card border border-primary/20 rounded-[2rem] overflow-hidden shadow-sm relative"
                >
                  <div className="absolute top-4 left-4 z-10">
                    <SponsoredBadge />
                  </div>
                  <div className="aspect-[21/9] bg-primary/5 flex items-center justify-center text-5xl">
                    {MOCK_ADS[1].img}
                  </div>
                  <div className="p-6">
                    <h3 className="font-display text-xl font-bold">{MOCK_ADS[1].merchant}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{MOCK_ADS[1].title}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-primary font-bold text-xs italic">
                        <Gift className="h-4 w-4" /> {MOCK_ADS[1].benefit}
                      </div>
                      <button className="px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">
                        {MOCK_ADS[1].cta}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <PremiumCard {...MOCK_ESTABLISHMENTS[1]} />
          </div>
        </section>

        <section>
          <SectionHeader title="Novidades" />
          <div className="grid grid-cols-1 gap-6">
            <PremiumCard {...MOCK_ESTABLISHMENTS[2]} />
          </div>
        </section>
      </main>
    </div>
  );
}

// --- PREVIEW C: SPONSORED CAROUSEL ---
export function PreviewCSponsoredCarousel({ adsPaused = false }) {
  return (
    <div className="bg-background min-h-screen font-sans pb-24">
      <Header />
      <main className="space-y-10 mt-6">
        <div className="px-6">
          <Categories />
        </div>
        
        {/* Sponsored Carousel */}
        <AnimatePresence>
          {!adsPaused && (
            <motion.section 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            >
              <div className="px-6">
                <SectionHeader title="Destaques para você" icon={Sparkles} showAll={false} />
              </div>
              <div className="flex gap-4 overflow-x-auto px-6 pb-4 [scrollbar-width:none]">
                {MOCK_ADS.map(ad => (
                  <div key={ad.id} className="shrink-0 w-72 bg-card border border-border/60 rounded-[2rem] p-5 shadow-sm relative overflow-hidden">
                    <div className="absolute top-4 right-4">
                      <SponsoredBadge />
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center text-3xl mb-4 border border-primary/10">
                      {ad.img}
                    </div>
                    <h3 className="font-display font-bold text-sm leading-tight line-clamp-2 mb-2">{ad.title}</h3>
                    <p className="text-[10px] text-muted-foreground mb-4 line-clamp-1">{ad.benefit}</p>
                    <button className="w-full py-2.5 bg-secondary hover:bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors border border-border/40">
                      {ad.cta}
                    </button>
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <div className="px-6 space-y-10">
          <section>
            <SectionHeader title="Continue fidelizando" icon={Clock} />
            <div className="space-y-4">
              <LoyaltyRow name="Artisan Coffee" progress={80} left={2} icon="☕" />
            </div>
          </section>

          <section>
            <SectionHeader title="Perto de você" />
            <div className="grid grid-cols-1 gap-6">
              {MOCK_ESTABLISHMENTS.slice(0, 2).map(e => <PremiumCard key={e.id} {...e} />)}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

// --- SHARED UI COMPONENTS ---

function Header() {
  return (
    <header className="px-6 pt-8 pb-4 sticky top-0 bg-background/80 backdrop-blur-md z-30">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Descobrir</span>
          <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Premium</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Top Level QR Access icon option */}
          <button className="h-10 w-10 rounded-full bg-card border border-border/60 flex items-center justify-center text-primary shadow-sm active:scale-95 transition-transform">
            <QrCode className="h-5 w-5" />
          </button>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 overflow-hidden">
            <User className="h-5 w-5" />
          </div>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
        <input 
          className="w-full rounded-2xl bg-secondary/50 border border-border/20 py-3.5 pl-12 pr-4 text-sm outline-none placeholder:text-muted-foreground/40 text-foreground" 
          placeholder="O que você procura hoje?" 
        />
      </div>
    </header>
  );
}

function Categories() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
      {["Tudo", "Cafés", "Restaurantes", "Bem-estar", "Moda", "Pet Shop"].map((cat, i) => (
        <button 
          key={cat} 
          className={`shrink-0 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
            i === 0 
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105" 
              : "bg-card border border-border/40 text-muted-foreground hover:border-primary/40"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

function LoyaltyRow({ name, progress, left, icon }: any) {
  return (
    <div className="flex items-center gap-4 bg-card p-5 rounded-[2rem] border border-border/60 shadow-sm hover:border-primary/20 transition-colors">
      <div className="h-14 w-14 rounded-2xl bg-primary/5 flex items-center justify-center text-2xl border border-primary/10">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-sm truncate text-foreground">{name}</h3>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-primary" />
          </div>
          <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest whitespace-nowrap">Faltam {left}</span>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
    </div>
  );
}

function PremiumCard({ name, cat, dist, reward, img, rating }: any) {
  return (
    <div className="bg-card border border-border/60 rounded-[2.5rem] overflow-hidden transition-all hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1">
      <div className="aspect-[21/9] bg-primary/5 relative flex items-center justify-center text-5xl">
        {img}
        <div className="absolute top-4 left-4 bg-white/80 dark:bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1 shadow-sm border border-white/20">
          <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> {rating}
        </div>
        <button className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/80 dark:bg-black/40 backdrop-blur shadow-sm flex items-center justify-center border border-white/20">
          <Heart className="h-4 w-4 text-muted-foreground hover:text-red-500 transition-colors" />
        </button>
      </div>
      <div className="p-6 flex justify-between items-end">
        <div>
          <span className="text-[9px] uppercase tracking-[0.2em] font-black text-primary/60">{cat} • {dist}</span>
          <h3 className="font-display text-xl font-bold mt-1 text-foreground">{name}</h3>
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2 font-medium">
            <Gift className="h-3.5 w-3.5 text-primary" /> {reward}
          </p>
        </div>
        <button className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20 active:scale-90 transition-transform">
          <PlusCircle className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
