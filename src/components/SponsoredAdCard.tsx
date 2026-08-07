import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Tag, ChevronDown, Gift, ShoppingBag, Utensils, Star, MapPin } from "lucide-react";
import { AdDisplayModel } from "@/lib/sponsored-ads-core";
import { cn } from "@/lib/utils";
import { useState } from "react";

export type AdTheme = 
  | "premium_dark" 
  | "premium_light" 
  | "gradient_promo" 
  | "editorial" 
  | "minimal_product" 
  | "seasonal";


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
  videoUrl?: string; // New field for video support
  theme?: AdTheme;
  offerType?: "discount" | "percentage" | "value" | "benefit" | "loyalty" | "reward";
  benefitText?: string;
  category?: string;
  rating?: number;
  distance?: string;
  // Visibility toggles
  hideTitle?: boolean;
  hideDescription?: boolean;
  hideMerchantName?: boolean;
  hidePrices?: boolean;
  hideLogo?: boolean;
  hideCTA?: boolean;
  fullBleedMode?: boolean; // If true, only image/video + "Patrocinado" badge
}


interface SponsoredAdCardProps {
  data: SponsoredAdData;
  model: AdDisplayModel;
  className?: string;
  initialExpanded?: boolean;
}

export function SponsoredAdCard({ data, model, className, initialExpanded = false }: SponsoredAdCardProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const theme = data.theme || "premium_dark";

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const getThemeStyles = () => {
    switch (theme) {
      case "premium_light":
        return {
          container: "bg-white border-white/20",
          textTitle: "text-neutral-900",
          textSecondary: "text-neutral-500",
          badge: "bg-neutral-100 text-neutral-800 border-neutral-200",
          accent: "text-primary",
          gradient: "from-white via-white/40 to-transparent",
          cta: "bg-neutral-900 text-white hover:bg-neutral-800"
        };
      case "gradient_promo":
        return {
          container: "bg-gradient-to-br from-primary via-accent to-purple-600 border-white/20",
          textTitle: "text-white",
          textSecondary: "text-white/80",
          badge: "bg-white/20 text-white border-white/30",
          accent: "text-white",
          gradient: "from-primary/80 via-transparent to-transparent",
          cta: "bg-white text-primary hover:bg-neutral-50"
        };
      case "editorial":
        return {
          container: "bg-neutral-50 border-neutral-200",
          textTitle: "text-neutral-900 font-serif lowercase italic",
          textSecondary: "text-neutral-400 font-sans uppercase tracking-[0.2em]",
          badge: "bg-transparent text-neutral-900 border-neutral-900",
          accent: "text-neutral-900",
          gradient: "from-neutral-50 via-neutral-50/20 to-transparent",
          cta: "bg-transparent border border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white"
        };
      case "minimal_product":
        return {
          container: "bg-white border-neutral-100",
          textTitle: "text-black text-center",
          textSecondary: "text-neutral-500 text-center",
          badge: "bg-black text-white",
          accent: "text-black",
          gradient: "from-white/90 via-transparent to-transparent",
          cta: "bg-black text-white rounded-full"
        };
      case "seasonal":
        return {
          container: "bg-rose-50 border-rose-200", // Example for mother's day / valentine
          textTitle: "text-rose-950",
          textSecondary: "text-rose-500",
          badge: "bg-rose-500 text-white",
          accent: "text-rose-600",
          gradient: "from-rose-50 via-rose-50/20 to-transparent",
          cta: "bg-rose-600 text-white"
        };
      default: // premium_dark
        return {
          container: "bg-neutral-950 border-white/10",
          textTitle: "text-white",
          textSecondary: "text-primary",
          badge: "bg-black/60 text-white/90 border-white/10",
          accent: "text-primary",
          gradient: "from-black via-black/60 to-transparent",
          cta: "bg-primary text-primary-foreground shadow-primary/20"
        };
    }
  };

  const styles = getThemeStyles();

  const SponsoredBadge = () => (
    <div className={cn(
      "inline-flex items-center px-2 py-1 rounded-full backdrop-blur-xl border shadow-sm w-fit",
      styles.badge
    )}>
      <Sparkles className={cn("h-2.5 w-2.5 mr-1.5", styles.accent)} />
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
    const label = data.ctaLabel || (model === "carousel" ? "Ver" : "Aproveitar");
    
    return (
      <div className={cn(
        "font-black uppercase tracking-[0.15em] shadow-xl active:scale-[0.97] transition-all flex items-center justify-center gap-2 group whitespace-nowrap border border-white/10 cursor-pointer w-full sm:w-auto",
        styles.cta,
        size === "sm" ? "h-9 px-5 rounded-xl text-[10px]" : "h-11 px-8 rounded-2xl text-[11px]"
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
          <div className={cn(
            "text-[10px] font-bold line-through leading-none ml-1 opacity-50",
            theme === "premium_light" || theme === "editorial" || theme === "minimal_product" ? "text-neutral-900" : "text-white"
          )}>
            De {formatCurrency(data.originalPrice)}
          </div>
        )}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-display font-black leading-none tracking-tight",
              theme === "premium_light" || theme === "editorial" || theme === "minimal_product" ? "text-neutral-900" : "text-white",
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

  const cardConfig = {
    premium_banner: {
      collapsed: "min-h-[240px] sm:min-h-[280px] xl:min-h-[340px]",
      expanded: "min-h-[420px] xl:min-h-[500px]",
      titleSize: "text-2xl sm:text-3xl xl:text-4xl",
      padding: "p-6 sm:p-8 xl:p-12"
    },
    sponsored_feed: {
      collapsed: "min-h-[200px] aspect-video xl:aspect-[21/9]",
      expanded: "min-h-[380px] xl:min-h-[450px]",
      titleSize: "text-xl sm:text-2xl xl:text-3xl",
      padding: "p-5 sm:p-7 xl:p-10"
    },
    carousel: {
      collapsed: "w-64 min-h-[180px] aspect-square",
      expanded: "w-72 min-h-[360px]",
      titleSize: "text-lg",
      padding: "p-5"
    }
  }[model];

  return (
    <motion.article 
      layout
      onClick={toggleExpand}
      className={cn(
        "relative w-full overflow-hidden group rounded-[2.5rem] flex flex-col justify-end cursor-pointer shadow-2xl transition-all border",
        styles.container,
        isExpanded ? cardConfig.expanded : cardConfig.collapsed,
        className
      )}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* 1. MÍDIA ABSOLUTA (FULL BLEED) */}
      <motion.div 
        layout
        className="absolute inset-0 z-0 overflow-hidden"
      >
        {data.videoUrl ? (
          <video
            src={data.videoUrl}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            poster={data.imageUrl}
          />
        ) : (
          <motion.img 
            layout
            src={data.imageUrl} 
            alt={data.title} 
            animate={{ 
              scale: isExpanded ? 1.05 : 1,
              filter: isExpanded ? "brightness(0.7) blur(2px)" : "brightness(0.6)"
            }}
            className="w-full h-full object-cover" 
          />
        )}
        
        {/* 2. GRADIENTE PRETO OBRIGATÓRIO (DINÂMICO PELO TEMA) */}
        {!data.fullBleedMode && (
          <motion.div 
            layout
            className={cn(
              "absolute inset-0 bg-gradient-to-t z-10",
              styles.gradient,
              isExpanded ? "opacity-100" : "opacity-90"
            )} 
          />
        )}
      </motion.div>


      {/* 3. CONTEÚDO EM FLUXO NORMAL */}
      <div className={cn("relative z-20 w-full flex flex-col gap-4", cardConfig.padding, data.fullBleedMode && "h-full justify-between")}>
        <motion.div layout className="flex flex-col gap-3">
          <div className="flex justify-between items-start">
            <SponsoredBadge />
            {!data.fullBleedMode && (
              <motion.div 
                animate={{ rotate: isExpanded ? 180 : 0 }}
                className="p-2 rounded-full bg-white/10 backdrop-blur-md text-white/70 sm:hidden"
              >
                <ChevronDown className="h-4 w-4" />
              </motion.div>
            )}
          </div>
          
          {!data.fullBleedMode && (
            <div className={cn("space-y-1.5", theme === "minimal_product" && "items-center")}>
              {!data.hideTitle && (
                <motion.h3 layout className={cn(
                  "font-display font-black uppercase leading-[1] tracking-tight",
                  styles.textTitle,
                  cardConfig.titleSize
                )}>
                  {data.title}
                </motion.h3>
              )}
              {!data.hideMerchantName && (
                <motion.p layout className={cn(
                  "text-[10px] sm:text-[11px] font-black uppercase tracking-[0.25em] opacity-90",
                  styles.textSecondary
                )}>
                  {data.merchantName}
                </motion.p>
              )}
            </div>
          )}
          
          <AnimatePresence>
            {(isExpanded || model === "premium_banner") && data.description && !data.hideDescription && !data.fullBleedMode && (
              <motion.p 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={cn(
                  "text-xs sm:text-sm font-medium line-clamp-3 max-w-xl leading-relaxed",
                  theme === "premium_light" || theme === "editorial" || theme === "minimal_product" ? "text-neutral-700" : "text-white/80"
                )}
              >
                {data.description}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {!data.fullBleedMode && (
          <motion.div layout className="flex flex-col gap-5 mt-1">
            <div className="flex flex-wrap items-end justify-between gap-4">
              {!data.hidePrices && renderCommercialLine(model === "carousel" && !isExpanded)}
              
              <AnimatePresence>
                {isExpanded && !data.hideCTA && (
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
                  className={cn(
                    "p-2 rounded-full border active:scale-95 transition-all",
                    styles.cta
                  )}
                >
                  <ArrowRight className="h-4 w-4" />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

      </div>
      
      {/* 4. FAIXA DO CRIATIVO (STRIPE) */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 h-1 z-30 overflow-hidden"
          >
            <div className={cn("w-full h-full", styles.accent, "bg-current opacity-60")} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
