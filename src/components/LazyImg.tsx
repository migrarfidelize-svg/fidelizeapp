import { useEffect, useRef, useState } from "react";

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  eager?: boolean;
  fadeMs?: number;
};

/**
 * Lazy image with:
 * - IntersectionObserver (renders src only near viewport)
 * - decoding="async" + async decode() before fade-in
 * - graceful fade-in to avoid jank when cache miss
 */
export function LazyImg({ src, eager, fadeMs = 220, style, className, onLoad, ...rest }: Props) {
  const ref = useRef<HTMLImageElement | null>(null);
  const [visible, setVisible] = useState(!!eager);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (eager || visible) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager, visible]);

  return (
    <img
      {...rest}
      ref={ref}
      src={visible ? src : undefined}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      // @ts-expect-error - valid HTML attribute
      fetchpriority={eager ? "high" : "low"}
      onLoad={(e) => {
        setReady(true);
        onLoad?.(e);
      }}
      className={className}
      style={{
        opacity: ready ? 1 : 0,
        transition: `opacity ${fadeMs}ms ease`,
        backgroundColor: "rgba(23,19,14,0.05)",
        ...style,
      }}
    />
  );
}
