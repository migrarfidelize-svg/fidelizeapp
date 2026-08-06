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

  const base = `block w-auto max-w-full object-contain object-left shrink-0 transition-opacity duration-200 ${imgClassName || "h-10 sm:h-12"}`;

  return (
    <span className={`inline-flex min-w-[120px] items-center ${className}`}>
      <img 
        src={brand.logoUrl} 
        alt={brand.alt} 
        className={`${base} dark:hidden`} 
        loading="eager" 
        decoding="sync"
        fetchPriority="high"
        width="160"
        height="48"
      />
      <img 
        src={brand.logoDarkUrl} 
        alt={brand.alt} 
        className={`${base} hidden dark:block`} 
        loading="eager" 
        decoding="sync" 
        fetchPriority="high"
        width="160"
        height="48"
      />
    </span>
  );
}
}
