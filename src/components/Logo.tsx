import { useBrand } from "@/lib/use-brand";

/**
 * Logo horizontal da plataforma (menu desktop, cabeçalhos e telas públicas).
 * A imagem vem do painel admin (Página inicial → Marca) com fallback na logo oficial.
 */
export function Logo({
  className = "",
  imgClassName = "",
}: {
  className?: string;
  /** Sobrescreve a altura padrão (h-7 no mobile / h-8 no desktop). */
  imgClassName?: string;
}) {
  const brand = useBrand();
  const base = `block w-auto max-w-full object-contain object-left shrink-0 ${imgClassName || "h-9 sm:h-11"}`;

  return (
    <span className={`inline-flex min-w-0 items-center ${className}`}>
      <img src={brand.logoUrl} alt={brand.alt} className={`${base} dark:hidden`} loading="eager" decoding="async" />
      <img src={brand.logoDarkUrl} alt="" aria-hidden="true" className={`${base} hidden dark:block`} loading="eager" decoding="async" />
    </span>
  );
}
