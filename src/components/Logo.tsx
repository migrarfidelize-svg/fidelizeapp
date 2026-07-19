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
            <linearGradient id="fz-logo-f-shine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.92" />
              <stop offset="1" stopColor="#E9D5FF" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="fz-logo-arc-shine" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="0.5" stopColor="#F5F3FF" stopOpacity="1" />
              <stop offset="1" stopColor="#DDD6FE" stopOpacity="0.95" />
            </linearGradient>
            <filter id="fz-logo-arc-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width="512" height="512" rx="112" ry="112" fill="url(#fz-logo-g)" />
          <g filter="url(#fz-logo-arc-glow)">
            <path
              d="M 384 256 A 128 128 0 1 1 256 128"
              fill="none"
              stroke="url(#fz-logo-arc-shine)"
              strokeWidth="30"
              strokeLinecap="round"
            />
            <path d="M 236 108 L 268 128 L 236 148 Z" fill="url(#fz-logo-arc-shine)" />
          </g>


          <g fill="url(#fz-logo-f-shine)">
            <rect x="196" y="156" width="40" height="216" rx="12" />
            <rect x="196" y="156" width="140" height="40" rx="12" />
            <rect x="196" y="244" width="104" height="36" rx="10" />
          </g>
          <g fill="#ffffff" opacity="0.45" style={{ mixBlendMode: "overlay" }}>
            <rect x="200" y="160" width="14" height="208" rx="7" />
            <rect x="200" y="160" width="132" height="10" rx="5" />
          </g>

        </svg>
      </span>
      <span>Fidelize</span>
    </span>
  );
}
