import { motion } from "framer-motion";
import { 
  Compass, Search, MapPin, Tag, Star, ChevronRight, Gift, Target, 
  Sparkles, Heart, Coffee, Utensils, Scissors, ShoppingBag, 
  Filter, ArrowRight, Trophy, Zap, Clock, PlusCircle
} from "lucide-react";

const STYLES = {
  premium: {
    container: "bg-background min-h-screen font-sans",
    card: "bg-card border border-border/60 rounded-[2rem] overflow-hidden transition-all hover:shadow-lg hover:shadow-primary/5",
    accent: "text-primary",
    button: "rounded-2xl bg-primary text-primary-foreground font-bold transition-transform active:scale-95",
  },
  marketplace: {
    container: "bg-neutral-50 dark:bg-neutral-950 min-h-screen font-sans",
    card: "bg-white dark:bg-neutral-900 rounded-3xl overflow-hidden shadow-sm border border-neutral-200 dark:border-neutral-800",
    accent: "text-accent",
    button: "rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-black font-bold",
  },
  gamified: {
    container: "bg-background min-h-screen font-sans",
    card: "bg-card border-2 border-primary/20 rounded-[2.5rem] overflow-hidden relative",
    accent: "text-primary",
    button: "rounded-full bg-gradient-to-r from-primary to-accent text-white font-black italic tracking-tight shadow-lg shadow-primary/20",
  }
};

/** 
 * PREVIEW 1: PREMIUM / CLEAN
 * Foco em elegância, espaços em branco generosos e tipografia refinada.
 */
export function Preview1Premium() {
  return (
    <div className={STYLES.premium.container}>
      <header className="px-6 pt-8 pb-4 sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-display font-bold tracking-tight">Descobrir</h1>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <UserIcon />
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input 
            className="w-full rounded-2xl bg-secondary/50 border-none py-3.5 pl-12 pr-4 text-sm outline-none placeholder:text-muted-foreground/60" 
            placeholder="O que você procura hoje?" 
          />
        </div>
      </header>

      <main className="px-6 pb-24 space-y-10">
        {/* Categorias Minimalistas */}
        <section>
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
            {["Tudo", "Cafés", "Restaurantes", "Bem-estar", "Moda"].map((cat, i) => (
              <button key={cat} className={`shrink-0 px-5 py-2.5 rounded-2xl text-sm font-medium transition-colors ${i === 0 ? "bg-primary text-primary-foreground" : "bg-card border border-border/40 text-muted-foreground"}`}>
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* Continue Fidelizando - Cards horizontais elegantes */}
        <section>
          <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Continue fidelizando
          </h2>
          <div className="space-y-4">
            {[
              { name: "Artisan Coffee", progress: 80, icon: "☕", left: 2 },
              { name: "Bella Pasta", progress: 40, icon: "🍝", left: 6 }
            ].map((item) => (
              <div key={item.name} className="flex items-center gap-4 bg-card p-5 rounded-[2rem] border border-border/50 shadow-sm">
                <div className="h-14 w-14 rounded-2xl bg-primary/5 flex items-center justify-center text-2xl border border-primary/10">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm truncate">{item.name}</h3>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${item.progress}%` }} className="h-full bg-primary" />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground">Faltam {item.left}</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground/40" />
              </div>
            ))}
          </div>
        </section>

        {/* Perto de você - Grid sofisticado */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold">Perto de você</h2>
            <button className="text-xs font-bold text-primary">Ver todos</button>
          </div>
          <div className="grid grid-cols-1 gap-6">
            {[
              { name: "The Green Bowl", cat: "Saudável", dist: "400m", reward: "Suco grátis", img: "🥗" },
              { name: "Urban Barbers", cat: "Beleza", dist: "1.2km", reward: "Corte VIP", img: "✂️" }
            ].map((place) => (
              <div key={place.name} className={STYLES.premium.card}>
                <div className="aspect-[21/9] bg-primary/5 relative flex items-center justify-center text-4xl">
                  {place.img}
                  <button className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/80 backdrop-blur shadow-sm flex items-center justify-center">
                    <Heart className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="p-5 flex justify-between items-end">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-primary/60">{place.cat} • {place.dist}</span>
                    <h3 className="font-display text-xl font-bold mt-1">{place.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                      <Gift className="h-3.5 w-3.5 text-primary" /> {place.reward}
                    </p>
                  </div>
                  <button className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20">
                    <PlusCircle className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

/** 
 * PREVIEW 2: DISCOVERY / MARKETPLACE
 * Foco em apelo visual, imagens grandes e sensação de exploração.
 */
export function Preview2Marketplace() {
  return (
    <div className={STYLES.marketplace.container}>
      <div className="relative h-64 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-neutral-950/90 z-10" />
        <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center text-6xl">🍕</div>
        <div className="absolute bottom-6 left-6 right-6 z-20">
          <h1 className="text-3xl font-display font-black text-white leading-tight">Explore o<br/>que há de novo</h1>
          <p className="text-white/70 text-sm mt-1">Encontre seu próximo prêmio</p>
        </div>
      </div>

      <div className="px-4 -mt-6 relative z-30">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl p-1 flex items-center border border-neutral-200 dark:border-neutral-800">
          <div className="flex-1 flex items-center px-4 gap-3">
            <Search className="h-5 w-5 text-neutral-400" />
            <input className="bg-transparent border-none py-3 text-sm w-full outline-none" placeholder="Buscar por nome ou categoria" />
          </div>
          <button className="h-10 w-10 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center mr-1">
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      <main className="px-4 py-8 space-y-8">
        {/* Categorias Visuais */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Comer", icon: "🍔" },
            { label: "Beber", icon: "🍹" },
            { label: "Mimos", icon: "🎁" },
            { label: "Estilo", icon: "👟" }
          ].map(c => (
            <div key={c.label} className="flex flex-col items-center gap-2">
              <div className="h-16 w-16 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-2xl shadow-sm">
                {c.icon}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{c.label}</span>
            </div>
          ))}
        </div>

        {/* Cards de Descoberta - Capa Grande */}
        <section className="space-y-6">
          <h2 className="font-display font-black text-xl px-1">Recomendados</h2>
          {[
            { name: "Pizzaria Donatello", cat: "Italiana", reward: "Borda Recheada", img: "🍕", rating: 4.8 },
            { name: "Sweet Bliss Parlor", cat: "Doces", reward: "Casquinha Dupla", img: "🍦", rating: 4.9 }
          ].map(e => (
            <div key={e.name} className={STYLES.marketplace.card}>
              <div className="relative aspect-video bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-6xl">
                {e.img}
                <div className="absolute top-4 left-4 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1 shadow-sm">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> {e.rating}
                </div>
                <button className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/90 dark:bg-neutral-950/90 shadow-sm flex items-center justify-center">
                  <Heart className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-display font-bold text-lg">{e.name}</h3>
                    <p className="text-xs text-neutral-500 font-medium">{e.cat} • 800m de você</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl border border-neutral-100 dark:border-neutral-800 flex items-center justify-center font-bold text-primary">
                    {e.name.charAt(0)}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 bg-primary/5 dark:bg-primary/10 border border-primary/20 p-3 rounded-xl">
                  <Gift className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-primary">Recompensa: {e.reward}</span>
                </div>
                <button className="w-full mt-4 py-3 bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                  Ver estabelecimentos <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

/** 
 * PREVIEW 3: FIDELIDADE / GAMIFICAÇÃO
 * Foco em progresso, recompensas e sensação de conquista.
 */
export function Preview3Gamification() {
  return (
    <div className={STYLES.gamified.container}>
      <header className="px-6 py-8 bg-gradient-to-b from-primary/10 to-transparent">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Seu Progresso</span>
            <h1 className="text-4xl font-display font-black italic text-foreground leading-tight">Colecione<br/>Vitórias</h1>
          </div>
          <div className="h-14 w-14 rounded-[1.5rem] bg-card border-2 border-primary/20 flex items-center justify-center shadow-xl">
            <Trophy className="h-7 w-7 text-primary" />
          </div>
        </div>
      </header>

      <main className="px-6 pb-24 space-y-10">
        {/* Próximas Recompensas - Gamified */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-black text-lg italic tracking-tight uppercase">Perto de Ganhar</h2>
            <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500 animate-pulse" />
          </div>
          <div className="space-y-4">
            {[
              { name: "Burger Station", reward: "Hambúrguer Free", icon: "🍔", progress: 9, total: 10 },
              { name: "Gelato Master", reward: "Taça Suprema", icon: "🍦", progress: 4, total: 5 }
            ].map(item => (
              <div key={item.name} className="bg-card border-2 border-primary/20 rounded-[2rem] p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-10 -mt-10 blur-2xl" />
                <div className="flex gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-3xl font-black shadow-lg shadow-primary/30">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-sm uppercase tracking-tight">{item.name}</h3>
                    <p className="text-[10px] font-bold text-primary mt-0.5">🏆 {item.reward}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 flex gap-1">
                        {Array.from({ length: item.total }).map((_, i) => (
                          <div key={i} className={`h-1.5 flex-1 rounded-full ${i < item.progress ? "bg-primary" : "bg-primary/10"}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] font-black text-muted-foreground mt-2 uppercase">Só falta {item.total - item.progress} carimbo!</p>
                  </div>
                </div>
                <button className="mt-4 w-full bg-primary/10 hover:bg-primary/20 border border-primary/30 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary transition-all">
                  Completar agora
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Exploração Gamificada */}
        <section>
          <h2 className="font-display font-black text-lg italic tracking-tight uppercase mb-4">Novas Missões</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: "Sushi Zen", reward: "Combo 12 unidades", icon: "🍣", color: "bg-orange-500" },
              { name: "Power Gym", reward: "Shake Protein", icon: "💪", color: "bg-blue-500" },
              { name: "Retro Bar", reward: "Drink Especial", icon: "🍸", color: "bg-purple-500" },
              { name: "Lash Studio", reward: "Design Premium", icon: "👁️", color: "bg-pink-500" }
            ].map(m => (
              <div key={m.name} className="bg-card border-2 border-border/40 rounded-[1.8rem] p-4 text-center group active:scale-95 transition-transform">
                <div className={`h-16 w-16 mx-auto rounded-full ${m.color}/10 flex items-center justify-center text-3xl mb-3 shadow-inner`}>
                  {m.icon}
                </div>
                <h3 className="font-black text-xs uppercase tracking-tight truncate">{m.name}</h3>
                <div className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-muted-foreground uppercase bg-secondary px-2 py-1 rounded-full">
                  <Target className="h-2.5 w-2.5" /> Iniciar
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
