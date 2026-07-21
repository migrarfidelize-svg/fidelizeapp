import { useEffect, useRef } from "react";

/**
 * Fiber-style glowing cursor trail with lag.
 * Cyan → magenta gradient, large radius, additive blending.
 * Skipped on touch / reduced-motion / coarse pointers.
 */
export function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduced || coarse) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Read theme colors from CSS variables (fallback to cyan/magenta).
    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue("--primary").trim() || "oklch(0.91 0.15 195)";
    const accent = styles.getPropertyValue("--accent").trim() || "oklch(0.78 0.19 330)";

    // Trail chain: each node lags behind the previous via lerp.
    const NODES = 26;
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const nodes = Array.from({ length: NODES }, () => ({ x: target.x, y: target.y }));
    let visible = false;
    let lastMove = 0;

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      visible = true;
      lastMove = performance.now();
    };
    const onLeave = () => { visible = false; };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);

    let raf = 0;
    const tick = () => {
      // ease head node toward cursor
      nodes[0].x += (target.x - nodes[0].x) * 0.28;
      nodes[0].y += (target.y - nodes[0].y) * 0.28;
      for (let i = 1; i < NODES; i++) {
        nodes[i].x += (nodes[i - 1].x - nodes[i].x) * 0.35;
        nodes[i].y += (nodes[i - 1].y - nodes[i].y) * 0.35;
      }

      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      // fade out after inactivity
      const idle = performance.now() - lastMove;
      const alpha = visible ? Math.max(0, 1 - idle / 900) : 0;
      if (alpha <= 0.01) {
        raf = requestAnimationFrame(tick);
        return;
      }

      ctx.globalCompositeOperation = "lighter";

      // Draw the ribbon in 3 stacked passes for a fiber-like glow.
      const grad = ctx.createLinearGradient(nodes[0].x, nodes[0].y, nodes[NODES - 1].x, nodes[NODES - 1].y);
      grad.addColorStop(0, primary);
      grad.addColorStop(1, accent);

      const drawStroke = (width: number, opacity: number, blur: number) => {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(nodes[0].x, nodes[0].y);
        for (let i = 1; i < NODES - 1; i++) {
          const midX = (nodes[i].x + nodes[i + 1].x) / 2;
          const midY = (nodes[i].y + nodes[i + 1].y) / 2;
          ctx.quadraticCurveTo(nodes[i].x, nodes[i].y, midX, midY);
        }
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = opacity * alpha;
        ctx.shadowBlur = blur;
        ctx.shadowColor = primary;
        ctx.strokeStyle = grad;
        ctx.stroke();
        ctx.restore();
      };

      drawStroke(28, 0.18, 30); // outer bloom
      drawStroke(14, 0.35, 18); // mid glow
      drawStroke(4, 0.9, 10);   // bright core

      // Cursor head glow
      ctx.save();
      ctx.globalAlpha = alpha;
      const r = 18;
      const hg = ctx.createRadialGradient(nodes[0].x, nodes[0].y, 0, nodes[0].x, nodes[0].y, r);
      hg.addColorStop(0, primary);
      hg.addColorStop(1, "transparent");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(nodes[0].x, nodes[0].y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9999]"
    />
  );
}
