import { useBrand } from "@/lib/use-brand";

/**
 * Marca compacta do Fidelize — usada quando o menu lateral está colapsado
 * ou em espaços quadrados (mobile, avatares, atalhos).
 */
export function LogoMark({ className = "", size = 36 }: { className?: string; size?: number }) {
  const brand = useBrand();

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-2xl ${className}`}
      style={{ width: size, height: size }}
      aria-label={brand.alt}
    >
      <img
        src={brand.markUrl}
        alt=""
        aria-hidden="true"
        className="h-full w-full object-contain p-0.5"
        loading="eager"
        decoding="async"
      />
    </span>
  );
}
