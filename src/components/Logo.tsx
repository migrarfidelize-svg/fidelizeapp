export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display font-bold text-xl ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-xl overflow-hidden surface-glow">
        <svg viewBox="0 0 512 512" className="h-8 w-8" aria-hidden="true">
          <defs>
            <linearGradient id="fz-logo-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#8B5CF6" />
              <stop offset="1" stopColor="#6D28D9" />
            </linearGradient>
          </defs>
          <rect width="512" height="512" rx="112" ry="112" fill="url(#fz-logo-g)" />
          <path
            d="M 384 256 A 128 128 0 1 1 256 128"
            fill="none"
            stroke="#ffffff"
            strokeWidth="28"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path d="M 236 108 L 268 128 L 236 148 Z" fill="#ffffff" opacity="0.85" />
          <g fill="#ffffff">
            <rect x="196" y="156" width="40" height="216" rx="12" />
            <rect x="196" y="156" width="140" height="40" rx="12" />
            <rect x="196" y="244" width="104" height="36" rx="10" />
          </g>
        </svg>
      </span>
      <span>Fidelize</span>
    </span>
  );
}
