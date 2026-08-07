import { motion, AnimatePresence } from "framer-motion";
import { Search, QrCode, User, Compass, Clock, Sparkles, Star, Heart, Gift, ArrowRight, Filter, ChevronRight, Zap, Trophy, Target } from "lucide-react";
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
    description: "Hambúrguer artesanal premiado com fritas e refrigerante."
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
    title: "Beleza e Bem-Estar",
    merchantName: "Salão Bella",
    imageUrl: "https://images.unsplash.com/photo-1560066984-1389b4cda4f1?q=80&w=800",
    theme: "premium_light",
    fidelizePrice: 8990,
    discountLabel: "20% OFF",
    description: "Transforme seu visual com nosso design premium de sobrancelhas e cuidados faciais."
  }
];

export function Preview1PremiumClean() {
  return (
    <div className="bg-background min-h-screen p-6 font-sans">
      <header className="flex items-center justify-between mb-8">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Descobrir</span>
          <h1 className="text-3xl font-bold tracking-tight">Afidelize</h1>
        </div>
        <button className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20">
          <QrCode className="h-6 w-6" />
        </button>
      </header>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input className="w-full bg-card border border-border/60 py-4 pl-12 pr-4 rounded-2xl text-sm" placeholder="O que deseja descobrir hoje?" />
      </div>

      <section className="mb-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Destaques</h2>
        <SponsoredAdCard data={MOCK_ADS[0]} model="premium_banner" />
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Perto de você</h2>
        <div className="space-y-4">
          <div className="bg-card p-5 rounded-3xl border border-border/60 flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">🥗</div>
            <div className="flex-1">
              <h3 className="font-bold text-sm">The Green Bowl</h3>
              <p className="text-[10px] font-medium text-muted-foreground">Faltam 2 carimbos para um suco</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
          </div>
        </div>
      </section>
    </div>
  );
}

export function Preview2Editorial() {
  return (
    <div className="bg-neutral-50 min-h-screen p-6 font-serif">
      <header className="mb-8">
        <h1 className="text-4xl font-bold italic lowercase">Afidelize</h1>
        <p className="text-neutral-500 font-sans text-xs uppercase tracking-[0.2em] mt-1">Edição Semanal</p>
      </header>

      <section className="mb-10">
        <SponsoredAdCard data={MOCK_ADS[1]} model="premium_banner" />
      </section>

      <section>
        <h2 className="font-sans text-xs font-bold uppercase tracking-widest text-neutral-400 mb-6">Em alta</h2>
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="aspect-square bg-white rounded-3xl border border-neutral-100 p-4 flex flex-col justify-end">
              <span className="text-xl">☕</span>
              <p className="font-bold text-sm mt-2">Café e Cia</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function Preview3ModernDark() {
  return (
    <div className="bg-neutral-950 min-h-screen p-6 font-sans text-white">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-black italic">AFIDELIZE</h1>
        <div className="bg-white/10 p-2.5 rounded-full">
          <QrCode className="h-5 w-5" />
        </div>
      </header>

      <section className="mb-8">
        <SponsoredAdCard data={MOCK_ADS[2]} model="premium_banner" />
      </section>

      <section className="bg-neutral-900/50 p-6 rounded-[2.5rem] border border-white/5">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-black italic uppercase text-primary">Missões</h2>
          <Zap className="text-yellow-500 h-5 w-5" />
        </div>
        <div className="space-y-4">
          <div className="bg-neutral-900 p-4 rounded-2xl flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-lg">🍔</div>
            <div className="flex-1">
              <p className="text-xs font-black">Burger Station</p>
              <div className="h-1 bg-white/10 mt-2 rounded-full"><div className="h-full bg-primary w-3/4 rounded-full" /></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
