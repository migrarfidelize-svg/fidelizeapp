import { motion } from "framer-motion";
import { Compass, Search, MapPin, Tag, Star, ChevronRight, Gift, Target, Sparkles, PlusCircle } from "lucide-react";

export function Preview1Premium() {
  return (
    <div className="bg-background min-h-screen p-6 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-display font-bold">Descobrir</h1>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <input className="w-full rounded-2xl bg-card border border-border/60 py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-primary/20" placeholder="Buscar lugares..." />
        </div>
      </header>

      <section className="mb-8">
        <div className="flex gap-4 overflow-x-auto pb-2">
          {["Cafés", "Restaurantes", "Lojas", "Salões"].map((cat) => (
            <button key={cat} className="rounded-full bg-card px-4 py-2 text-sm font-semibold border border-border/60">{cat}</button>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Continue fidelizando</h2>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 bg-card p-4 rounded-3xl border border-border/60">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 grid place-items-center">☕</div>
            <div className="flex-1">
              <h3 className="font-bold">Café Central</h3>
              <div className="h-2 w-full bg-muted rounded-full mt-2"><div className="h-full bg-primary rounded-full w-2/3"></div></div>
            </div>
            <ChevronRight className="text-muted-foreground" />
          </div>
        ))}
      </section>
    </div>
  );
}

export function Preview2Marketplace() {
  return (
    <div className="bg-background min-h-screen p-4 font-sans">
      <header className="mb-6">
        <div className="bg-gradient-to-br from-primary/20 to-accent/20 h-40 rounded-3xl p-6 flex flex-col justify-end">
          <h1 className="text-2xl font-bold font-display">Descubra novos lugares</h1>
          <p className="text-sm opacity-80">Recompensas exclusivas perto de você</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-3xl overflow-hidden border border-border/60">
            <div className="h-24 bg-muted"></div>
            <div className="p-3">
              <h3 className="font-bold text-sm">Burger Joy</h3>
              <div className="flex items-center text-xs text-muted-foreground mt-1 gap-1">
                <MapPin className="h-3 w-3" /> 200m
              </div>
              <button className="mt-3 w-full bg-primary text-primary-foreground py-2 rounded-xl text-xs font-bold">Ver Cartão</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Preview3Gamification() {
  return (
    <div className="bg-background min-h-screen p-6 font-sans">
      <header className="mb-8 text-center">
        <h2 className="text-muted-foreground uppercase tracking-widest text-xs font-black">Progresso Geral</h2>
        <div className="text-4xl font-black font-display text-primary mt-2">84%</div>
        <p className="text-sm text-muted-foreground">Rumo à próxima recompensa ouro</p>
      </header>

      <section className="space-y-4">
        <h3 className="font-display font-bold text-lg">Perto de ganhar</h3>
        {[1, 2].map((i) => (
          <div key={i} className="bg-card p-5 rounded-3xl border border-primary/30 flex items-center gap-4">
            <Star className="text-yellow-500 h-8 w-8" />
            <div className="flex-1">
              <h4 className="font-bold">Sushi House</h4>
              <p className="text-xs text-muted-foreground">Faltam 1 carimbo</p>
            </div>
            <div className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide">Ganhe prêmio</div>
          </div>
        ))}
      </section>
    </div>
  );
}
