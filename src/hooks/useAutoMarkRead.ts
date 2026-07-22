import { useEffect, useMemo, useRef } from "react";

/**
 * Marks new unread items as read. Re-runs whenever the set of unread ids
 * changes so items that arrive via background refetches are also acknowledged
 * — but never re-sends ids already processed.
 */
export function useAutoMarkRead<T extends { id: string; read: boolean }>(
  items: T[] | undefined,
  markFn: (args: { data: { ids: string[] } }) => Promise<unknown>,
  onMarked?: () => void,
) {
  const seenRef = useRef<Set<string>>(new Set());

  const unreadIds = useMemo(
    () => (items ?? []).filter((m) => !m.read).map((m) => m.id),
    [items],
  );

  const key = unreadIds.join(",");

  useEffect(() => {
    if (!unreadIds.length) return;
    const fresh = unreadIds.filter((id) => !seenRef.current.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => seenRef.current.add(id));
    markFn({ data: { ids: fresh } })
      .then(() => onMarked?.())
      .catch(() => {
        // rollback so a retry can happen on next tick
        fresh.forEach((id) => seenRef.current.delete(id));
      });
    // key covers the identity change without depending on the array reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return unreadIds;
}
