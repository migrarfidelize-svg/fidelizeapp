/**
 * Marca compacta do Fidelize — usada quando o menu lateral está colapsado.
 * Reproduz o "F" da logo com animação sutil em loop (aurora respirando).
 */
export function LogoMark({ className = "", size = 36 }: { className?: string; size?: number }) {
  return (
    <span
      className={`relative inline-grid place-items-center rounded-2xl overflow-hidden logo-mark-aurora ${className}`}
      style={{ width: size, height: size }}
      aria-label="Fidelize"
    >
      <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id="fz-mark-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#BEDCFF" />
            <stop offset="1" stopColor="#7FB4F0" />
          </linearGradient>
          <linearGradient id="fz-mark-ink" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1E2A44" />
            <stop offset="1" stopColor="#2A3A5A" />
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="128" fill="url(#fz-mark-g)" />
        <g fill="url(#fz-mark-ink)">
          <rect x="176" y="140" width="52" height="240" rx="14" />
          <rect x="176" y="140" width="176" height="52" rx="14" />
          <rect x="176" y="238" width="132" height="46" rx="12" />
        </g>
      </svg>
    </span>
  );
}
