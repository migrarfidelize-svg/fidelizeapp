import { useBrand } from "@/lib/use-brand";
import { useState, useEffect } from "react";

/**
 * Logo horizontal da plataforma (menu desktop, cabeçalhos e telas públicas).
 * A imagem vem do painel admin (Página inicial → Marca) com fallback na logo oficial.
 */
export function Logo({
  className = "",
  imgClassName = "",
}: {
  className?: string;
  /** Sobrescreve a altura padrão (h-12 no mobile / h-16 no desktop). */
  imgClassName?: string;
}) {
  const brand = useBrand();
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Força exibição imediata se for SSR ou se a logo já estiver em cache
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const base = `block w-auto max-w-full object-contain object-left shrink-0 transition-opacity duration-200 ${imgClassName || "h-12 sm:h-16"} ${isLoaded ? "opacity-100" : "opacity-0"}`;

  return (
    <span className={`inline-flex min-w-[120px] items-center ${className}`}>
      {!isLoaded && <div className={`animate-pulse bg-muted/20 rounded ${imgClassName || "h-12 w-32 sm:h-16 sm:w-40"}`} />}
      <img 
        src={brand.logoUrl} 
        alt={brand.alt} 
        className={`${base} dark:hidden`} 
        style={{ display: isLoaded ? 'block' : 'none' }}
        loading="eager" 
        decoding="async"
        fetchPriority="high"
      />
      <img 
        src={brand.logoDarkUrl} 
        alt="" 
        aria-hidden="true" 
        className={`${base} hidden dark:isLoaded:block`} 
        style={{ display: isLoaded ? undefined : 'none' }}
        loading="eager" 
        decoding="async" 
        fetchPriority="high"
      />
    </span>
  );
}
