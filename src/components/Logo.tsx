type LogoProps = {
  className?: string;
  showWordmark?: boolean;
};

/**
 * Fidelize brand mark.
 * Symbol: purple squircle + white "F" wrapped by a return arc (loyalty return cycle).
 * Wordmark rendered in real editable typography (Plus Jakarta Sans via font-display).
 */
export function Logo({ className = "", showWordmark = true }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 font-display font-bold text-xl ${className}`}>
      <LogoSymbol className="h-8 w-8 shrink-0" />
      {showWordmark ? <span className="tracking-tight">Fidelize</span> : null}
    </span>
  );
}

export function LogoSymbol({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Fidelize"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="14" fill="#7C3AED" />
      <path
        d="M 28.5 10.5 A 22 22 0 1 0 47.2 16.9"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <path d="M 43.4 11.6 L 52.4 14.7 L 46.9 22.4 Z" fill="#ffffff" />
      <g fill="#ffffff">
        <rect x="23.5" y="20" width="5.6" height="24" rx="2.8" />
        <rect x="23.5" y="20" width="14.5" height="5.6" rx="2.8" />
        <rect x="23.5" y="28.7" width="11" height="5.4" rx="2.7" />
      </g>
    </svg>
  );
}
