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
    <div className="inline-flex items-center px-2 py-0.5 rounded-full backdrop-blur-md border border-white/10 bg-black/30 text-white/90 z-20">
      <Sparkles className="h-2 w-2 mr-1 text-primary animate-pulse" />
      <span className="text-[8px] font-black uppercase tracking-[0.2em]">Patrocinado</span>
    </div>
  );

  const FidelizeBadge = () => (
    <div className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[8px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 border border-primary-foreground/10">
      Fidelize
    </div>
  );

  const CTAButton = ({ size = "md" }: { size?: "sm" | "md" }) => {
    const label = data.ctaLabel || (model === "carousel" ? "Ver" : "Aproveitar oferta");
    
    return (
      <div className={cn(
        "bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-xl shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2 group whitespace-nowrap border border-white/10 hover:shadow-primary/40 cursor-pointer",
        size === "sm" ? "px-4 py-2 rounded-xl text-[9px]" : "px-6 py-3 rounded-2xl text-[10px]"
      )}>
        {label}
        {model === "carousel" ? (
          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        ) : (
          <ExternalLink className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        )}
      </div>
    );
  };

  const renderPrices = (compact = false) => {
    if (!data.fidelizePrice && !data.benefitText) return null;

    return (
      <div className={cn("flex flex-col", compact ? "gap-0" : "gap-1")}>
        {data.originalPrice && (
          <div className="text-[10px] font-bold line-through text-white/40 leading-none">
            De {formatCurrency(data.originalPrice)}
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "font-display font-black leading-none text-white drop-shadow-md",
              compact ? "text-base" : "text-2xl"
            )}>
              {data.fidelizePrice ? formatCurrency(data.fidelizePrice) : data.benefitText}
            </span>
            {data.fidelizePrice && <FidelizeBadge />}
          </div>
          {data.fidelizePrice && !compact && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/60 drop-shadow-sm">
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
        <div className="bg-emerald-500 text-white px-3 py-1.5 rounded-2xl font-display font-black text-[10px] shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 border border-white/20 uppercase tracking-widest">
          <Tag className="h-2.5 w-2.5" />
          {label}
        </div>
      </div>
    );
  };

  if (model === "premium_banner") {
    return (
      <motion.div 
        whileHover={{ y: -4 }}
        className={cn(
          "relative w-full aspect-[21/9] rounded-[2.5rem] overflow-hidden shadow-2xl group border border-white/5",
          className
        )}
      >
        <img src={data.imageUrl} alt={data.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
        
        {/* Overlay Black Gradient (Bottom to Top) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

        <div className="absolute inset-0 p-8 flex flex-col justify-between z-10">
          <div className="flex justify-between items-start">
            <SponsoredBadge />
            {renderDiscount()}
          </div>

          <div className="flex items-end justify-between gap-8">
            <div className="space-y-4 flex-1 max-w-[70%]">
              <div className="space-y-1">
                <h3 className="text-white text-3xl font-display font-black leading-[1.1] tracking-tight drop-shadow-2xl line-clamp-2">
                  {data.title}
                </h3>
                {data.description && (
                  <p className="text-white/70 text-sm font-medium line-clamp-1 drop-shadow-md">
                    {data.description}
                  </p>
                )}
                <p className="text-primary text-[10px] font-black uppercase tracking-[0.2em] pt-1">
                  {data.merchantName}
                </p>
              </div>
              {renderPrices()}
            </div>
            
            <div className="pb-1 shrink-0">
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
          "relative w-full aspect-[16/9] rounded-[2rem] overflow-hidden shadow-xl group border border-white/5",
          className
        )}
      >
        <img src={data.imageUrl} alt={data.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
        
        {/* Gradient Base Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />

        <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
          <div className="flex justify-between items-start">
            <SponsoredBadge />
            {renderDiscount()}
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-white text-xl font-display font-black leading-tight line-clamp-2 drop-shadow-xl">
                {data.title}
              </h3>
              {data.description && (
                <p className="text-white/60 text-xs font-medium line-clamp-1">
                  {data.description}
                </p>
              )}
              <p className="text-primary text-[9px] font-black uppercase tracking-[0.2em]">
                {data.merchantName}
              </p>
            </div>

            <div className="flex items-end justify-between gap-4">
              {renderPrices(true)}
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
      whileHover={{ y: -4 }}
      className={cn(
        "relative w-64 aspect-square rounded-[2rem] overflow-hidden shadow-lg group shrink-0 border border-white/5",
        className
      )}
    >
      <img src={data.imageUrl} alt={data.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
      
      {/* Gradient Base Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

      <div className="absolute inset-0 p-5 flex flex-col justify-between z-10">
        <div className="flex justify-between items-start">
          <SponsoredBadge />
          {data.discountValue && (
            <div className="bg-emerald-500 text-white h-6 px-2 rounded-lg font-display font-black text-[9px] flex items-center justify-center border border-white/20 uppercase tracking-tighter">
              -{data.discountValue}%
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-white text-[13px] font-display font-black leading-tight line-clamp-2 drop-shadow-lg">
              {data.title}
            </h3>
            <p className="text-primary text-[8px] font-black uppercase tracking-widest truncate">
              {data.merchantName}
            </p>
          </div>

          <div className="flex items-end justify-between gap-2">
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
