import { motion } from "framer-motion";
import { Sparkles, ExternalLink, ArrowRight, Tag } from "lucide-react";
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
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const SponsoredBadge = () => (
    <div className="absolute top-6 left-6 inline-flex items-center px-3 py-1 rounded-full backdrop-blur-xl border border-white/20 bg-black/40 text-white/90 z-30 shadow-2xl">
      <Sparkles className="h-2.5 w-2.5 mr-2 text-primary animate-pulse fill-primary/20" />
      <span className="text-[9px] font-black uppercase tracking-[0.2em]">Patrocinado</span>
    </div>
  );

  const FidelizeBadge = () => (
    <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-[0.15em] shadow-lg shadow-primary/20 border border-primary-foreground/10 ring-1 ring-white/10">
      Fidelize
    </div>
  );

  const CTAButton = ({ size = "md" }: { size?: "sm" | "md" }) => {
    const label = data.ctaLabel || (model === "carousel" ? "Ver" : "Aproveitar oferta");
    
    return (
      <div className={cn(
        "bg-primary text-primary-foreground font-black uppercase tracking-[0.15em] shadow-[0_10px_30px_-10px_rgba(var(--primary-rgb),0.5)] active:scale-[0.97] transition-all flex items-center justify-center gap-2 group whitespace-nowrap border border-white/20 hover:shadow-[0_15px_40px_-10px_rgba(var(--primary-rgb),0.6)] cursor-pointer relative z-30",
        size === "sm" ? "px-5 py-2.5 rounded-xl text-[10px]" : "px-8 py-4 rounded-2xl text-[11px]"
      )}>
        {label}
        {model === "carousel" ? (
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
        ) : (
          <ExternalLink className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        )}
      </div>
    );
  };

  const renderPrices = (compact = false) => {
    if (!data.fidelizePrice && !data.benefitText) return null;

    return (
      <div className={cn("flex flex-col items-start", compact ? "gap-0.5" : "gap-2")}>
        {data.originalPrice && (
          <div className="text-[11px] font-bold line-through text-white/40 leading-none tracking-tight">
            De {formatCurrency(data.originalPrice)}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={cn(
              "font-display font-black leading-none text-white tracking-tighter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]",
              compact ? "text-lg" : "text-3xl"
            )}>
              {data.fidelizePrice ? formatCurrency(data.fidelizePrice) : data.benefitText}
            </span>
            {data.fidelizePrice && <FidelizeBadge />}
          </div>
          {data.fidelizePrice && !compact && (
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary drop-shadow-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Benefício Exclusivo
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
      <div className="absolute top-6 right-6 z-30">
        <div className="bg-emerald-500/90 backdrop-blur-md text-white px-4 py-2 rounded-2xl font-display font-black text-[11px] shadow-xl shadow-emerald-500/20 flex items-center gap-2 border border-white/20 uppercase tracking-[0.15em]">
          <Tag className="h-3 w-3" />
          {label}
        </div>
      </div>
    );
  };

  if (model === "premium_banner") {
    return (
      <motion.div 
        whileHover={{ scale: 1.01 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={cn(
          "relative w-full aspect-[21/9] rounded-[3rem] overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] group border border-white/10",
          className
        )}
      >
        <img src={data.imageUrl} alt={data.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-105" />
        
        {/* Overlay Black Gradient - Proteção Visual Robusta */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90 z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent z-10" />

        <div className="absolute inset-0 p-10 flex flex-col justify-between z-20">
          <div className="relative">
            <SponsoredBadge />
            {renderDiscount()}
          </div>

          <div className="flex items-end justify-between gap-12 mt-auto">
            <div className="space-y-6 flex-1 max-w-[70%]">
              <div className="space-y-2">
                <p className="text-primary text-[11px] font-black uppercase tracking-[0.3em]">
                  {data.merchantName}
                </p>
                <h3 className="text-white text-4xl lg:text-5xl font-display font-black leading-[1] tracking-tighter drop-shadow-2xl line-clamp-2 uppercase">
                  {data.title}
                </h3>
                {data.description && (
                  <p className="text-white/80 text-base font-medium line-clamp-1 max-w-xl">
                    {data.description}
                  </p>
                )}
              </div>
              <div className="pt-2">
                {renderPrices()}
              </div>
            </div>
            
            <div className="pb-2 shrink-0">
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
        whileHover={{ scale: 1.01 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={cn(
          "relative w-full aspect-[16/9] rounded-[2.5rem] overflow-hidden shadow-2xl group border border-white/10",
          className
        )}
      >
        <img src={data.imageUrl} alt={data.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-105" />
        
        {/* Gradient Base Overlay - Centralizado no conteúdo inferior */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-90 z-10" />

        <div className="absolute inset-0 p-8 flex flex-col justify-between z-20">
          <div className="relative">
            <SponsoredBadge />
            {renderDiscount()}
          </div>

          <div className="space-y-6 mt-auto">
            <div className="space-y-2">
              <p className="text-primary text-[10px] font-black uppercase tracking-[0.25em]">
                {data.merchantName}
              </p>
              <h3 className="text-white text-2xl lg:text-3xl font-display font-black leading-tight line-clamp-2 uppercase tracking-tight">
                {data.title}
              </h3>
              {data.description && (
                <p className="text-white/70 text-sm font-medium line-clamp-1">
                  {data.description}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-6 pt-2">
              <div className="flex-1">
                {renderPrices(true)}
              </div>
              <CTAButton size="sm" />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // CAROUSEL
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn(
        "relative w-72 aspect-square rounded-[2.5rem] overflow-hidden shadow-xl group shrink-0 border border-white/10",
        className
      )}
    >
      <img src={data.imageUrl} alt={data.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-105" />
      
      {/* Gradient Base Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-95 z-10" />

      <div className="absolute inset-0 p-6 flex flex-col justify-between z-20">
        <div className="relative">
          <SponsoredBadge />
          {data.discountValue && (
            <div className="absolute top-0 right-0 bg-emerald-500/90 backdrop-blur-md text-white px-2.5 py-1 rounded-xl font-display font-black text-[10px] flex items-center justify-center border border-white/20 uppercase tracking-widest shadow-lg">
              -{data.discountValue}%
            </div>
          )}
        </div>

        <div className="space-y-4 mt-auto">
          <div className="space-y-1">
            <p className="text-primary text-[9px] font-black uppercase tracking-widest truncate">
              {data.merchantName}
            </p>
            <h3 className="text-white text-base font-display font-black leading-tight line-clamp-2 uppercase tracking-tight">
              {data.title}
            </h3>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex-1 min-w-0">
              {renderPrices(true)}
            </div>
            <div className="shrink-0">
              <CTAButton size="sm" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
