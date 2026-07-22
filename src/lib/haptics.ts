/**
 * Haptic feedback via navigator.vibrate.
 * Respeita prefers-reduced-motion e desativa em navegadores sem suporte.
 */
type Pattern = "tap" | "success" | "stamp" | "error";

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 10,
  success: [15, 40, 30],
  stamp: [20, 30, 20, 30, 60], // pulso duplo + selado
  error: [50, 30, 50],
};

export function haptic(pattern: Pattern = "tap"): void {
  if (typeof window === "undefined") return;
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    /* no-op */
  }
}
