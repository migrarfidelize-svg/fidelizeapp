import { motion } from "framer-motion";
import { Sparkles, ExternalLink, ArrowRight, Gift, Tag } from "lucide-react";
import { AdDisplayModel } from "@/lib/sponsored-ads-core";
import { cn } from "@/lib/utils";

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
}

export function SponsoredAdCard({ data, model, className }: SponsoredAdCardProps) {
  const isDark = data.theme === "dark";

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const SponsoredBadge = () => (
    <div className={cn(
      "inline-flex items-center px-2.5 py-1 rounded-full backdrop-blur-md border z-20",
      isDark 
        ? "bg-black/40 border-white/10 text-white/90" 
        : "bg-white/60 border-black/5 text-black/80"
    )}>
      <Sparkles className="h-2.5 w-2.5 mr-1.5 text-primary" />
      <span className="text-[9px] font-black uppercase tracking-[0.15em]">Patrocinado</span>
    </div>
  );

  const FidelizeBadge = () => (
    <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[8px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">
      Fidelize
    </div>
  );

  const CTAButton = () => {
    if (model === "carousel") {
      return (
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-transform flex items-center gap-1.5">
          {data.ctaLabel || "Ver"} <ArrowRight className="h-3 w-3" />
        </button>
      );
    }

    return (
      <button className="px-6 py-3 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/30 active:scale-95 transition-transform flex items-center gap-2 group">
        {data.ctaLabel || "Aproveitar oferta"} 
        <ExternalLink className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
      </button>
    );
  };

  const renderPrices = () => {
    if (!data.fidelizePrice && !data.benefitText) return null;

    return (
      <div className="space-y-0.5">
        {data.originalPrice && (
          <div className={cn(
            "text-[10px] font-medium line-through opacity-60",
            isDark ? "text-white" : "text-black"
          )}>
            De {formatCurrency(data.originalPrice)}
          </div>
        )}
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1.5">
            <span className={cn(
              "text-lg font-display font-black leading-tight",
              isDark ? "text-white" : "text-black"
            )}>
              {data.fidelizePrice ? formatCurrency(data.fidelizePrice) : data.benefitText}
            </span>
            {data.fidelizePrice && <FidelizeBadge />}
          </div>
          {data.fidelizePrice && (
            <span className={cn(
              "text-[9px] font-bold uppercase tracking-wider opacity-70",
              isDark ? "text-white/80" : "text-black/60"
            )}>
              exclusivo Fidelize
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderDiscount = () => {
    const label = data.discountLabel || (data.discountValue ? `${data.discountValue}% OFF` : null);
    if (!label) return null;

    return (
      <div className="absolute top-4 right-4 z-20">
        <div className="bg-emerald-500 text-white px-3 py-1.5 rounded-2xl font-display font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 border border-white/20">
          <Tag className="h-3 w-3" />
          {label}
        </div>
      </div>
    );
  };

  // --- RENDERING MODELS ---

  if (model === "premium_banner") {
    return (
      <motion.div 
        whileHover={{ y: -4 }}
        className={cn(
          "relative w-full aspect-[21/9] rounded-[2.5rem] overflow-hidden shadow-2xl group",
          className
        )}
      >
        {/* Full Bleed Image */}
        <img src={data.imageUrl} alt={data.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        
        {/* Overlays */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t via-transparent to-transparent",
          isDark ? "from-black/90" : "from-black/60"
        )} />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />

        {/* Content Container */}
        <div className="absolute inset-0 p-8 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <SponsoredBadge />
            {renderDiscount()}
          </div>

          <div className="flex items-end justify-between gap-6">
            <div className="space-y-2 flex-1 max-w-[65%]">
              <div>
                <h3 className="text-white text-2xl font-display font-black leading-tight drop-shadow-sm line-clamp-2">
                  {data.title}
                </h3>
                <p className="text-white/80 text-xs font-bold uppercase tracking-[0.1em] mt-1 drop-shadow-sm">
                  {data.merchantName}
                </p>
              </div>
              {renderPrices()}
            </div>
            
            <div className="pb-1">
              <CTAButton />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (model === "sponsored_feed") {
    return (
      <motion.div 
        whileHover={{ y: -4 }}
        className={cn(
          "relative w-full aspect-[16/9] rounded-[2rem] overflow-hidden shadow-xl group border border-border/40",
          className
        )}
      >
        {/* Full Bleed Image */}
        <img src={data.imageUrl} alt={data.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        
        {/* Overlays */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t via-transparent to-transparent",
          isDark ? "from-black/90" : "from-black/60"
        )} />

        {/* Content Container */}
        <div className="absolute inset-0 p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <SponsoredBadge />
            {renderDiscount()}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end gap-4">
              <div className="flex-1">
                <h3 className="text-white text-xl font-display font-black leading-tight line-clamp-2">
                  {data.title}
                </h3>
                <p className="text-white/70 text-[10px] font-bold uppercase tracking-[0.1em] mt-1">
                  {data.merchantName}
                </p>
              </div>
            </div>

            <div className="flex items-end justify-between">
              {renderPrices()}
              <CTAButton />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // CAROUSEL
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className={cn(
        "relative w-64 aspect-square rounded-[2rem] overflow-hidden shadow-lg group shrink-0 border border-border/40",
        className
      )}
    >
      {/* Full Bleed Image */}
      <img src={data.imageUrl} alt={data.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
      
      {/* Overlays */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-t via-black/20 to-transparent",
        isDark ? "from-black/95" : "from-black/80"
      )} />

      {/* Content Container */}
      <div className="absolute inset-0 p-5 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <SponsoredBadge />
          {data.discountValue && (
            <div className="bg-emerald-500 text-white h-7 px-2 rounded-lg font-display font-black text-[10px] flex items-center justify-center border border-white/20">
              -{data.discountValue}%
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-white text-sm font-display font-black leading-tight line-clamp-2">
              {data.title}
            </h3>
            <p className="text-white/60 text-[9px] font-bold uppercase tracking-widest mt-0.5 truncate">
              {data.merchantName}
            </p>
          </div>

          <div className="flex items-end justify-between gap-2">
            <div className="flex-1 min-w-0">
              {data.originalPrice && (
                <div className="text-[9px] text-white/50 line-through">
                  De {formatCurrency(data.originalPrice)}
                </div>
              )}
              <div className="text-base font-display font-black text-white leading-none">
                {data.fidelizePrice ? formatCurrency(data.fidelizePrice) : data.benefitText}
              </div>
            </div>
            <CTAButton />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
