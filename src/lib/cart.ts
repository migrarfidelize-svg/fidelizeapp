import { useCallback, useEffect, useState } from "react";

export type CartLine = { id: string; qty: number };

const key = (slug: string) => `fidelize:cart:${slug}`;

/** Carrinho simples da vitrine pública, persistido no navegador do cliente. */
export function useCart(slug: string) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key(slug));
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* ignora */
    }
  }, [slug]);

  const persist = useCallback(
    (next: CartLine[]) => {
      setLines(next);
      try {
        localStorage.setItem(key(slug), JSON.stringify(next));
      } catch {
        /* ignora */
      }
    },
    [slug],
  );

  const add = useCallback(
    (id: string, qty = 1) => {
      const cur = lines.find((l) => l.id === id);
      persist(
        cur
          ? lines.map((l) => (l.id === id ? { ...l, qty: Math.min(99, l.qty + qty) } : l))
          : [...lines, { id, qty }],
      );
    },
    [lines, persist],
  );

  const setQty = useCallback(
    (id: string, qty: number) => {
      persist(qty <= 0 ? lines.filter((l) => l.id !== id) : lines.map((l) => (l.id === id ? { ...l, qty } : l)));
    },
    [lines, persist],
  );

  const remove = useCallback((id: string) => setQty(id, 0), [setQty]);
  const clear = useCallback(() => persist([]), [persist]);
  const qtyOf = useCallback((id: string) => lines.find((l) => l.id === id)?.qty ?? 0, [lines]);
  const count = lines.reduce((a, l) => a + l.qty, 0);

  return { lines, add, setQty, remove, clear, qtyOf, count };
}
