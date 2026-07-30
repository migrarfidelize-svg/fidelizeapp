import { useEffect, useRef, useState } from "react";

/**
 * Igual ao useInView, mas "ao vivo": volta a false quando o elemento sai da tela.
 * Usado para pausar animações fora do viewport (economia de CPU/bateria no mobile).
 */
export function useOnScreen<T extends HTMLElement = HTMLDivElement>(rootMargin = "120px") {
  const ref = useRef<T | null>(null);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setOnScreen(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setOnScreen(!!entry?.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return { ref, onScreen };
}

/** true enquanto a aba estiver visível (pausa animações em background tabs). */
export function useDocumentVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const sync = () => setVisible(document.visibilityState !== "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return visible;
}

/**
 * Timer que só roda quando `active` é true, a aba está visível e o usuário
 * não pediu "reduzir movimento". Evita re-render em loop fora da tela.
 */
export function useVisibleInterval(callback: () => void, ms: number, active: boolean) {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  const pageVisible = useDocumentVisible();

  useEffect(() => {
    if (!active || !pageVisible || prefersReducedMotion()) return;
    const id = window.setInterval(() => cbRef.current(), ms);
    return () => window.clearInterval(id);
  }, [active, pageVisible, ms]);
}

export function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.25) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, inView };
}

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useCountUp(target: number, active: boolean, duration = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);

  return value;
}
