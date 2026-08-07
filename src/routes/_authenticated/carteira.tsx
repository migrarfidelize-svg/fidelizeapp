import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { 
  Home, 
  Compass, 
  Wallet, 
  User, 
  QrCode,
  Search,
  Bell,
  Menu,
  X,
  LogOut,
  Settings,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  Star,
  MapPin,
  Clock,
  Gift,
  PlusCircle,
  Heart,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/LogoMark";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/_authenticated/carteira")({
  component: WalletLayout,
});

function WalletLayout() {
  const location = useLocation();
  const activeTab = location.pathname;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const tabs = [
    { icon: Home, label: "Início", path: "/carteira" },
    { icon: Compass, label: "Descobrir", path: "/carteira/descobrir" },
    { icon: QrCode, label: "QR Code", path: "/qr", isFab: true },
    { icon: Wallet, label: "Meus Vouchers", path: "/carteira/vouchers" },
    { icon: User, label: "Meu Perfil", path: "/carteira/perfil" },
  ];

  const secondaryNav = [
    { icon: Bell, label: "Notificações", count: 2 },
    { icon: Star, label: "Favoritos" },
    { icon: HelpCircle, label: "Ajuda" },
    { icon: Settings, label: "Configurações" },
  ];

  // Prevent scroll when sidebar is open on mobile
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isSidebarOpen]);

  return (
    <div className="flex min-h-screen bg-[oklch(0.985_0.006_285)] dark:bg-[oklch(0.14_0.018_288)] font-sans transition-colors duration-300">
      
      {/* 1. SIDEBAR (DESKTOP) & DRAWER (MOBILE) */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 transform bg-background/80 backdrop-blur-2xl border-r border-border/40 transition-all duration-500 ease-in-out lg:relative lg:translate-x-0 lg:w-20 xl:w-72",
        isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Overlay for mobile when sidebar is open */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm lg:hidden -z-10" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <div className="flex flex-col h-full p-4 xl:p-6">
          {/* Logo Section */}
          <div className="flex items-center gap-4 mb-10 px-2 lg:justify-center xl:justify-start">
            <div className="relative group">
              <LogoMark size={40} className="rounded-2xl shadow-xl shadow-primary/20 transition-transform group-hover:scale-110" />
              <div className="absolute -inset-1 rounded-2xl bg-primary/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col lg:hidden xl:flex text-left">
              <span className="font-display text-xl font-black tracking-tighter text-primary">Fidelize</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 leading-none">Premium Clean</span>
            </div>
            <button 
              className="ml-auto p-2 lg:hidden text-muted-foreground hover:bg-accent rounded-xl"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Main Navigation */}
          <nav className="flex-1 space-y-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.path || (tab.path === "/carteira" && activeTab === "/carteira/");
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-4 p-3 xl:p-4 rounded-[1.25rem] transition-all group lg:justify-center xl:justify-start",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-6 w-6 shrink-0 transition-transform", isActive ? "scale-110" : "group-hover:scale-110")} />
                  <span className={cn("font-bold text-sm lg:hidden xl:block", isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100")}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <motion.div 
                      layoutId="activePill" 
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-foreground lg:hidden xl:block" 
                    />
                  )}
                </Link>
              );
            })}

            <div className="my-6 h-px bg-border/40 lg:w-8 lg:mx-auto xl:w-full" />

            {secondaryNav.map((item) => (
              <button
                key={item.label}
                className="w-full flex items-center gap-4 p-3 xl:p-4 rounded-[1.25rem] text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-all group lg:justify-center xl:justify-start"
              >
                <div className="relative">
                  <item.icon className="h-6 w-6 shrink-0 transition-transform group-hover:scale-110" />
                  {item.count && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-black text-white ring-2 ring-background">
                      {item.count}
                    </span>
                  )}
                </div>
                <span className="font-bold text-sm lg:hidden xl:block opacity-70 group-hover:opacity-100">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* User Profile Mini (Sidebar Bottom) */}
          <div className="mt-auto p-2 lg:p-0 xl:p-2">
             <div className="flex items-center gap-3 p-3 rounded-2xl bg-accent/40 border border-border/20 lg:justify-center xl:justify-start">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-black shadow-lg">
                  JD
                </div>
                <div className="min-w-0 flex-1 lg:hidden xl:block text-left">
                  <p className="text-xs font-black truncate">João Doria</p>
                  <p className="text-[10px] text-muted-foreground font-bold truncate">Premium Member</p>
                </div>
                <button className="text-muted-foreground hover:text-destructive transition-colors lg:hidden xl:block">
                  <LogOut className="h-4 w-4" />
                </button>
             </div>
          </div>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 max-h-screen overflow-hidden">
        
        {/* Top Header - Desktop & Mobile */}
        <header className="sticky top-0 z-40 w-full bg-background/60 backdrop-blur-xl border-b border-border/40 px-4 xl:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 -ml-2 text-muted-foreground hover:bg-accent rounded-xl"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            
            {/* Contextual Title / Breadcrumb */}
            <div className="hidden sm:block text-left">
               <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/60 leading-none mb-1">
                 {activeTab.includes('descobrir') ? 'Exploração' : 'Minha Central'}
               </h2>
               <p className="text-lg font-display font-black tracking-tight text-foreground">
                 {activeTab.includes('descobrir') ? 'Descobrir' : 'Início'}
               </p>
            </div>
          </div>

          {/* Desktop Search & Global Actions */}
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="hidden md:flex items-center relative group">
              <Search className="absolute left-4 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input 
                placeholder="Pesquisar estabelecimentos..." 
                className="w-64 xl:w-80 h-11 bg-accent/40 border-none rounded-2xl pl-11 pr-4 text-sm font-medium focus:ring-4 focus:ring-primary/5 transition-all"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <button className="h-11 w-11 flex items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                <QrCode className="h-5 w-5" />
              </button>
              <button className="md:hidden h-11 w-11 flex items-center justify-center rounded-2xl bg-accent/60 text-muted-foreground">
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Content Container */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-[oklch(0.985_0.006_285)] dark:bg-[oklch(0.14_0.018_288)]">
          <div className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 xl:p-10">
            {/* Desktop Layout Pattern: Main content + Sidebar Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12">
              
              {/* Primary Column */}
              <div className="lg:col-span-8 xl:col-span-9 space-y-12">
                <Outlet />
              </div>

              {/* Contextual Secondary Sidebar (Right) - Desktop Only */}
              <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 space-y-10">
                
                {/* 1. Quick Progress Section */}
                <section className="bg-background/40 backdrop-blur-md rounded-[2.5rem] p-6 border border-border/40 shadow-sm text-left">
                   <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Progresso Rápido</h3>
                      <button className="text-[10px] font-bold text-primary hover:underline">Ver todos</button>
                   </div>
                   
                   <div className="space-y-5">
                      {[
                        { name: "Coffee House", progress: 8, total: 10, icon: "☕" },
                        { name: "Fit Food", progress: 4, total: 5, icon: "🥗" }
                      ].map(item => (
                        <div key={item.name} className="group cursor-pointer">
                           <div className="flex items-center gap-3 mb-2">
                              <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                {item.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <p className="text-sm font-bold truncate">{item.name}</p>
                                 <p className="text-[10px] text-muted-foreground font-medium">Faltam {item.total - item.progress} carimbos</p>
                              </div>
                           </div>
                           <div className="h-1.5 w-full bg-accent/60 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(item.progress/item.total)*100}%` }}
                                className="h-full bg-primary" 
                              />
                           </div>
                        </div>
                      ))}
                   </div>

                   <button className="w-full mt-8 h-12 rounded-2xl bg-white dark:bg-black/20 border border-border/40 text-xs font-black uppercase tracking-wider hover:bg-accent transition-colors flex items-center justify-center gap-2 group">
                      <span>Explorar mais</span>
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                   </button>
                </section>

                {/* 2. Your Rewards Section */}
                <section className="text-left">
                   <div className="flex items-center gap-2 mb-4 px-2">
                      <Gift className="h-4 w-4 text-primary" />
                      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Prêmios Disponíveis</h3>
                   </div>
                   
                   <div className="grid grid-cols-1 gap-3">
                      <div className="p-4 rounded-3xl bg-gradient-to-br from-primary to-accent text-white shadow-xl shadow-primary/10 group cursor-pointer overflow-hidden relative">
                         <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl group-hover:scale-150 transition-transform duration-700" />
                         <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Restaurante Gourmet</p>
                         <h4 className="text-lg font-display font-black leading-tight mb-3">Voucher Almoço Grátis</h4>
                         <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase bg-white/20 px-2 py-1 rounded-lg">Expira em 2d</span>
                            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                              <ChevronRight className="h-4 w-4" />
                            </div>
                         </div>
                      </div>
                   </div>
                </section>

                {/* 3. Favorite Merchants */}
                <section className="text-left">
                   <div className="flex items-center gap-2 mb-4 px-2">
                      <Heart className="h-4 w-4 text-destructive" />
                      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Favoritos</h3>
                   </div>
                   
                   <div className="flex flex-wrap gap-2">
                      {['🍣', '✂️', '🍔', '🧘'].map((emoji, i) => (
                        <div key={i} className="h-12 w-12 rounded-2xl bg-background border border-border/40 flex items-center justify-center text-xl shadow-sm hover:scale-110 hover:shadow-md transition-all cursor-pointer">
                          {emoji}
                        </div>
                      ))}
                      <div className="h-12 w-12 rounded-2xl bg-accent/40 border border-dashed border-border/60 flex items-center justify-center text-muted-foreground cursor-pointer hover:bg-accent transition-colors">
                        <PlusCircle className="h-5 w-5" />
                      </div>
                   </div>
                </section>
              </aside>

            </div>
          </div>

          {/* Footer Area */}
          <footer className="mt-20 border-t border-border/20 py-10 px-6 opacity-40">
            <div className="max-w-md mx-auto text-center">
              <LogoMark size={24} className="mx-auto grayscale opacity-50 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">Fidelize 2.0 • Premium Clean Platform</p>
            </div>
          </footer>
        </main>
      </div>

      {/* 3. BOTTOM NAV (MOBILE ONLY) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4 pointer-events-none">
        <div className="flex w-full max-w-md items-center justify-around gap-1 rounded-[2rem] border border-white/20 bg-black/80 p-2 text-white shadow-2xl backdrop-blur-2xl pointer-events-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.path || (tab.path === "/carteira" && activeTab === "/carteira/");
            const Icon = tab.icon;

            if (tab.isFab) {
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className="group relative -top-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg transition-transform active:scale-95 hover:scale-105"
                >
                  <Icon className="h-7 w-7" />
                  <div className="absolute -inset-1 rounded-2xl bg-primary/20 blur-lg group-hover:bg-primary/30 transition-colors" />
                </Link>
              );
            }

            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-bold transition-all active:scale-95",
                  isActive ? "text-primary" : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
                <span className={cn("transition-opacity", isActive ? "opacity-100" : "opacity-60")}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 20px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.1);
        }
      `}} />
    </div>
  );
}
