import { DEFAULT_BRANDS, type BrandItem } from "@/lib/landing-content";

type Brand = {
  name: string;
  node: React.ReactNode;
};

/** Glifos monocromáticos — traçados oficiais, sem alteração de forma. */
const NikeMark = () => (
  <svg viewBox="0 0 24 24" className="h-8 w-auto md:h-10" fill="currentColor" role="img" aria-label="Nike">
    <path d="M24 7.8L6.442 15.276c-1.456.616-2.679.925-3.668.925-1.12 0-1.933-.392-2.437-1.177-.317-.504-.41-1.143-.28-1.918.13-.775.476-1.6 1.036-2.478.467-.71 1.232-1.643 2.297-2.8a6.122 6.122 0 00-.784 1.848c-.28 1.195-.028 2.072.756 2.632.373.261.886.392 1.54.392.522 0 1.11-.084 1.764-.252L24 7.8z" />
  </svg>
);

const AdidasMark = () => (
  <svg viewBox="0 0 24 24" className="h-8 w-auto md:h-10" fill="currentColor" role="img" aria-label="Adidas">
    <path d="m24 19.535-8.697-15.07-4.659 2.687 7.145 12.383Zm-8.287 0L9.969 9.59 5.31 12.277l4.192 7.258ZM4.658 14.723l2.776 4.812H1.223L0 17.41Z" />
  </svg>
);

const AppleMark = () => (
  <svg viewBox="0 0 24 24" className="h-9 w-auto md:h-11" fill="currentColor" role="img" aria-label="Apple">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.422-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
  </svg>
);

/** Wordmarks tipográficos monocromáticos. */
const Word = ({
  children,
  className = "",
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) => (
  <span aria-label={label} className={`whitespace-nowrap leading-none ${className}`}>
    {children}
  </span>
);

const BRANDS: Brand[] = [
  {
    name: "Cimed",
    node: (
      <Word label="Cimed" className="text-3xl font-bold tracking-tight md:text-4xl">
        Cimed
      </Word>
    ),
  },
  {
    name: "Mansão Maromba",
    node: (
      <Word
        label="Mansão Maromba"
        className="text-center text-[0.95rem] font-extrabold uppercase tracking-[0.22em] md:text-lg"
      >
        Mansão
        <br />
        Maromba
      </Word>
    ),
  },
  {
    name: "Renner",
    node: (
      <Word label="Renner" className="text-3xl font-semibold lowercase tracking-[0.12em] md:text-4xl">
        renner
      </Word>
    ),
  },
  { name: "Nike", node: <NikeMark /> },
  { name: "Adidas", node: <AdidasMark /> },
  {
    name: "WePink",
    node: (
      <Word label="WePink" className="text-2xl font-light uppercase tracking-[0.35em] md:text-3xl">
        wepink
      </Word>
    ),
  },
  {
    name: "Ray-Ban",
    node: (
      <Word label="Ray-Ban" className="text-2xl font-black uppercase tracking-[0.06em] md:text-3xl">
        Ray-Ban
      </Word>
    ),
  },
  { name: "Apple", node: <AppleMark /> },
];

/** Marca vinda do painel admin: usa logo enviada ou o glifo/wordmark padrão. */
function resolveBrand(item: BrandItem): Brand {
  if (item.img) {
    return {
      name: item.name,
      node: (
        <img
          src={item.img}
          alt={item.name}
          loading="lazy"
          className="h-8 w-auto max-w-[140px] object-contain md:h-10"
        />
      ),
    };
  }
  const known = BRANDS.find((b) => b.name.toLowerCase() === item.name.toLowerCase());
  if (known) return known;
  return {
    name: item.name,
    node: (
      <Word label={item.name} className="text-2xl font-bold tracking-tight md:text-3xl">
        {item.name}
      </Word>
    ),
  };
}

export function BrandMarquee({ brands }: { brands?: BrandItem[] } = {}) {
  const source = brands?.length ? brands : DEFAULT_BRANDS.brands;
  const resolved = source.map(resolveBrand);
  const loop = [...resolved, ...resolved];

  return (
    <div className="brand-marquee">
      <div className="brand-marquee-track">
        {loop.map((b, i) => (
          <div key={`${b.name}-${i}`} className="brand-marquee-item" title={b.name}>
            {b.node}
          </div>
        ))}
      </div>
    </div>
  );
}
