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
    <div className="inline-flex items-center px-2 py-0.5 rounded-full backdrop-blur-xl border border-white/10 bg-black/30 text-white/70 shadow-sm mb-2">
      <Sparkles className="h-2 w-2 mr-1.5 text-primary/80" />
      <span className="text-[8px] font-black uppercase tracking-[0.2em]">Patrocinado</span>
    </div>
  );

  const FidelizeBadge = () => (
    <div className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[8px] font-black uppercase tracking-[0.1em] shadow-sm border border-white/10">
      Fidelize
    </div>
  );

  const DiscountBadge = () => {
    const label = data.discountLabel || (data.discountValue ? `${data.discountValue}% OFF` : null);
    if (!label) return null;
    return (
      <div className="bg-emerald-500 text-white px-2 py-0.5 rounded-md font-display font-black text-[9px] uppercase tracking-wider shadow-lg flex items-center gap-1">
        <Tag className="h-2 w-2" />
        {label}
      </div>
    );
  };

  const CTAButton = ({ size = "md" }: { size?: "sm" | "md" }) => {
    const label = data.ctaLabel || (model === "carousel" ? "Ver" : "Aproveitar oferta");
    
    return (
      <div className={cn(
        "bg-primary text-primary-foreground font-black uppercase tracking-[0.15em] shadow-lg active:scale-[0.97] transition-all flex items-center justify-center gap-2 group whitespace-nowrap border border-white/20 hover:brightness-110 cursor-pointer",
        size === "sm" ? "h-8 px-4 rounded-lg text-[9px]" : "h-10 px-6 rounded-xl text-[10px]"
      )}>
        <span>{label}</span>
        {model === "carousel" ? (
          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        ) : (
          <ExternalLink className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        )}
      </div>
    );
  };

  const renderCommercialLine = (compact = false) => {
    if (!data.fidelizePrice && !data.benefitText) return null;

    return (
      <div className="space-y-1">
        {data.originalPrice && (
          <div className="text-[10px] font-bold line-through text-white/40 leading-none">
            De {formatCurrency(data.originalPrice)}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "font-display font-black leading-none text-white tracking-tight",
              compact ? "text-base" : "text-xl"
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

  const minHeight = model === "premium_banner" ? "min-h-[220px]" : model === "sponsored_feed" ? "min-h-[180px]" : "min-h-[160px]";

  return (
    <motion.article 
      whileHover={{ y: -2 }}
      className={cn(
        "relative w-full overflow-hidden group rounded-[2rem] flex flex-col justify-end",
        model === "premium_banner" ? "sm:aspect-[21/9]" : model === "sponsored_feed" ? "aspect-video" : "w-64 aspect-square shrink-0",
        minHeight,
        className
      )}
    >
      {/* 1. IMAGEM ABSOLUTA (FULL BLEED) */}
      <div className="absolute inset-0 z-0">
        <img 
          src={data.imageUrl} 
          alt={data.title} 
          className="w-full h-full object-cover transition-transform duration-[3s] group-hover:scale-105" 
        />
        {/* 2. GRADIENTE PRETO OBRIGATÓRIO (FLUXO: TRANSPARENTE -> 15% -> 45% -> 85%) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />
      </div>

      {/* 3. CONTEÚDO EM FLUXO NORMAL (Z-INDEX ACIMA DO OVERLAY) */}
      <div className="relative z-20 w-full p-5 sm:p-7 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <SponsoredBadge />
          
          <div className="space-y-0.5">
            <h3 className={cn(
              "text-white font-display font-black uppercase leading-[1.1] tracking-tight line-clamp-2",
              model === "premium_banner" ? "text-xl sm:text-3xl" : "text-lg"
            )}>
              {data.title}
            </h3>
            <p className="text-primary text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] line-clamp-1 opacity-90">
              {data.merchantName}
            </p>
          </div>
          
          {data.description && (model !== "carousel") && (
            <p className="text-white/70 text-xs font-medium line-clamp-2 max-w-lg">
              {data.description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 mt-1">
          {renderCommercialLine(model === "carousel")}
          
          <div className="shrink-0">
            <CTAButton size={model === "premium_banner" ? "md" : "sm"} />
          </div>
        </div>
      </div>
    </motion.article>
  );
}
