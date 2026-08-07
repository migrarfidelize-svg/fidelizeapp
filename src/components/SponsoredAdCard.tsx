import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Tag, ChevronDown } from "lucide-react";
import { AdDisplayModel } from "@/lib/sponsored-ads-core";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface SponsoredAdData {
  id: string;
  title: string;
  description?: string;
  merchantName: string;
  originalPrice?: number; // in cents
  fidelizePrice?: number; // in cents
  discountLabel?: string;
  discountValue?: number; // percentage
  ctaLabel?: string;
  imageUrl: string;
  theme?: "dark" | "light";
  offerType?: "discount" | "percentage" | "value" | "benefit" | "loyalty" | "reward";
  benefitText?: string;
}

interface SponsoredAdCardProps {
  data: SponsoredAdData;
  model: AdDisplayModel;
  className?: string;
  initialExpanded?: boolean;
}

export function SponsoredAdCard({ data, model, className, initialExpanded = false }: SponsoredAdCardProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const SponsoredBadge = () => (
    <div className="inline-flex items-center px-2 py-1 rounded-full backdrop-blur-xl border border-white/10 bg-black/40 text-white/80 shadow-sm w-fit">
      <Sparkles className="h-2.5 w-2.5 mr-1.5 text-primary" />
      <span className="text-[9px] font-black uppercase tracking-[0.2em]">Patrocinado</span>
    </div>
  );

  const FidelizeBadge = () => (
    <div className="inline-flex items-center px-2 py-0.5 rounded bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-[0.1em] shadow-sm border border-white/10">
      Fidelize
    </div>
  );

  const DiscountBadge = () => {
    const label = data.discountLabel || (data.discountValue ? `${data.discountValue}% OFF` : null);
    if (!label) return null;
    return (
      <div className="bg-emerald-500 text-white px-2.5 py-1 rounded-lg font-display font-black text-[10px] uppercase tracking-wider shadow-lg flex items-center gap-1.5 border border-white/20">
        <Tag className="h-2.5 w-2.5" />
        {label}
      </div>
    );
  };

  const CTAButton = ({ size = "md" }: { size?: "sm" | "md" }) => {
    const label = data.ctaLabel || (model === "carousel" ? "Ver" : "Aproveitar oferta");
    
    return (
      <div className={cn(
        "bg-primary text-primary-foreground font-black uppercase tracking-[0.15em] shadow-xl active:scale-[0.97] transition-all flex items-center justify-center gap-2 group whitespace-nowrap border border-white/30 hover:brightness-110 cursor-pointer w-full sm:w-auto",
        size === "sm" ? "h-9 px-5 rounded-xl text-[10px]" : "h-12 px-8 rounded-2xl text-[11px]"
      )}>
        <span>{label}</span>
        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
      </div>
    );
  };

  const renderCommercialLine = (isCarousel = false) => {
    if (!data.fidelizePrice && !data.benefitText) return null;

    return (
      <div className="flex flex-col gap-1">
        {data.originalPrice && (
          <div className="text-[11px] font-bold line-through text-white/50 leading-none ml-1">
            De {formatCurrency(data.originalPrice)}
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-display font-black leading-none text-white tracking-tight",
              isCarousel ? "text-lg" : "text-2xl sm:text-3xl"
            )}>
              {data.fidelizePrice ? formatCurrency(data.fidelizePrice) : data.benefitText}
            </span>
            {data.fidelizePrice && <FidelizeBadge />}
          </div>
          <DiscountBadge />
        </div>
      </div>
    );
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // Base heights and scales
  const cardConfig = {
    premium_banner: {
      collapsed: "min-h-[260px] sm:aspect-[21/9]",
      expanded: "min-h-[420px]",
      titleSize: "text-2xl sm:text-4xl",
      padding: "p-6 sm:p-8"
    },
    sponsored_feed: {
      collapsed: "min-h-[220px] aspect-video",
      expanded: "min-h-[380px]",
      titleSize: "text-xl sm:text-2xl",
      padding: "p-5 sm:p-7"
    },
    carousel: {
      collapsed: "w-72 min-h-[200px] aspect-square",
      expanded: "w-72 min-h-[340px]",
      titleSize: "text-lg",
      padding: "p-5"
    }
  }[model];

  return (
    <motion.article 
      layout
      onClick={toggleExpand}
      className={cn(
        "relative w-full overflow-hidden group rounded-[2.5rem] flex flex-col justify-end cursor-pointer shadow-2xl",
        isExpanded ? cardConfig.expanded : cardConfig.collapsed,
        className
      )}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* 1. IMAGEM E FAIXA VISUAL (STRIP) */}
      <motion.div 
        layout
        className="absolute inset-0 z-0 overflow-hidden"
      >
        <motion.img 
          layout
          src={data.imageUrl} 
          alt={data.title} 
          animate={{ 
            scale: isExpanded ? 1.05 : 1,
            filter: isExpanded ? "brightness(0.7)" : "brightness(0.6)"
          }}
          className="w-full h-full object-cover" 
        />
        
        {/* 2. GRADIENTE PRETO DINÂMICO */}
        <motion.div 
          layout
          className={cn(
            "absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10",
            isExpanded ? "opacity-100" : "opacity-90"
          )} 
        />
      </motion.div>

      {/* 3. CONTEÚDO PRINCIPAL (LAYOUT EM FLUXO) */}
      <div className={cn("relative z-20 w-full flex flex-col gap-4", cardConfig.padding)}>
        <motion.div layout className="flex flex-col gap-3">
          <div className="flex justify-between items-start">
            <SponsoredBadge />
            <motion.div 
              animate={{ rotate: isExpanded ? 180 : 0 }}
              className="p-2 rounded-full bg-white/10 backdrop-blur-md text-white/70 sm:hidden"
            >
              <ChevronDown className="h-4 w-4" />
            </motion.div>
          </div>
          
          <div className="space-y-1">
            <motion.h3 layout className={cn(
              "text-white font-display font-black uppercase leading-[1] tracking-tight",
              cardConfig.titleSize
            )}>
              {data.title}
            </motion.h3>
            <motion.p layout className="text-primary text-[10px] sm:text-[11px] font-black uppercase tracking-[0.25em] opacity-90">
              {data.merchantName}
            </motion.p>
          </div>
          
          <AnimatePresence>
            {(isExpanded || model === "premium_banner") && data.description && (
              <motion.p 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-white/80 text-xs sm:text-sm font-medium line-clamp-3 max-w-xl leading-relaxed"
              >
                {data.description}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div layout className="flex flex-col gap-6 mt-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            {renderCommercialLine(model === "carousel" && !isExpanded)}
            
            <AnimatePresence>
              {isExpanded && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="w-full sm:w-auto"
                >
                  <CTAButton size={model === "premium_banner" ? "md" : "sm"} />
                </motion.div>
              )}
            </AnimatePresence>
            
            {!isExpanded && (
              <motion.div 
                layout
                className="p-2 rounded-full bg-primary/20 text-primary border border-primary/30"
              >
                <ArrowRight className="h-4 w-4" />
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
      
      {/* Visual Stripe/Indicator at bottom when collapsed */}
      {!isExpanded && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/40 z-30" />
      )}
    </motion.article>
  );
}