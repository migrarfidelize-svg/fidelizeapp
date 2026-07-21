import { useEffect, useRef } from "react";

/**
 * Multi-ribbon fiber cursor trail, scoped to a container.
 * Renders as an absolutely-positioned canvas that fills its parent.
 * The parent MUST be `position: relative` and clip overflow if desired.
 *
 * Multiple ribbons follow the pointer with different lag/curl so the
 * effect feels expansive and organic. Palette mixes cyan, magenta,
 * violet and soft white to stay on-brand without being monotone.
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
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let rect = parent.getBoundingClientRect();

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    // Brand-aligned palette (cyan → magenta → violet → soft white).
    const PALETTE: Array<[string, string]> = [
      ["#00ffff", "#ff2bd6"], // cyan → magenta
      ["#7cf5ff", "#a855f7"], // aqua → violet
      ["#00e0ff", "#ffffff"], // cyan → white
      ["#ff5cf0", "#00ffff"], // magenta → cyan
      ["#8b5cf6", "#00ffff"], // violet → cyan
    ];

    type Ribbon = {
      nodes: { x: number; y: number }[];
      head: number;   // lerp toward cursor (slower = smaller)
      chain: number;  // lerp along the chain
      spread: number; // px offset from cursor (expansive fan-out)
      phase: number;  // radians offset for spread direction
      width: number;
      opacity: number;
      colors: [string, string];
    };

    const NODES = 42; // longer chain
    const RIBBONS = 5;
    const cx = width / 2;
    const cy = height / 2;
    const ribbons: Ribbon[] = Array.from({ length: RIBBONS }, (_, i) => ({
      nodes: Array.from({ length: NODES }, () => ({ x: cx, y: cy })),
      // Slower easing = longer, softer lag.
      head: 0.045 + i * 0.006,
      chain: 0.10 + i * 0.012,
      // Tighter fan-out so the ribbons stay close together.
      spread: 6 + i * 4,
      phase: (i * Math.PI * 2) / RIBBONS,
      width: 2 + i * 0.25,
      opacity: 0.85 - i * 0.07,
      colors: PALETTE[i % PALETTE.length],
    }));

    const target = { x: cx, y: cy };
    let visible = false;
    let lastMove = 0;

    const onMove = (e: PointerEvent) => {
      const r = parent.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) {
        visible = false;
        return;
      }
      target.x = x;
      target.y = y;
      visible = true;
      lastMove = performance.now();
    };
    const onLeave = () => { visible = false; };
    window.addEventListener("pointermove", onMove, { passive: true });
    parent.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);

    let raf = 0;
    let t0 = performance.now();
    const tick = (now: number) => {
      const dt = (now - t0) / 1000;

      // Fan-out targets: each ribbon aims at a slowly rotating point
      // near the cursor so the group feels wide and breathing.
      for (const rb of ribbons) {
        const ang = rb.phase + dt * 0.25;
        const tx = target.x + Math.cos(ang) * rb.spread;
        const ty = target.y + Math.sin(ang) * rb.spread * 0.75;
        rb.nodes[0].x += (tx - rb.nodes[0].x) * rb.head;
        rb.nodes[0].y += (ty - rb.nodes[0].y) * rb.head;
        for (let i = 1; i < NODES; i++) {
          rb.nodes[i].x += (rb.nodes[i - 1].x - rb.nodes[i].x) * rb.chain;
          rb.nodes[i].y += (rb.nodes[i - 1].y - rb.nodes[i].y) * rb.chain;
        }
      }

      ctx.clearRect(0, 0, width, height);

      const idle = performance.now() - lastMove;
      const alpha = visible ? Math.max(0, 1 - idle / 1400) : 0;
      if (alpha <= 0.01) {
        raf = requestAnimationFrame(tick);
        return;
      }

      ctx.globalCompositeOperation = "lighter";

      for (const rb of ribbons) {
        const grad = ctx.createLinearGradient(
          rb.nodes[0].x, rb.nodes[0].y,
          rb.nodes[NODES - 1].x, rb.nodes[NODES - 1].y,
        );
        grad.addColorStop(0, rb.colors[0]);
        grad.addColorStop(1, rb.colors[1]);

        const drawStroke = (w: number, op: number, blur: number, color: string | CanvasGradient) => {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(rb.nodes[0].x, rb.nodes[0].y);
          for (let i = 1; i < NODES - 1; i++) {
            const midX = (rb.nodes[i].x + rb.nodes[i + 1].x) / 2;
            const midY = (rb.nodes[i].y + rb.nodes[i + 1].y) / 2;
            ctx.quadraticCurveTo(rb.nodes[i].x, rb.nodes[i].y, midX, midY);
          }
          ctx.lineWidth = w;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.globalAlpha = op * alpha * rb.opacity;
          ctx.shadowBlur = blur;
          ctx.shadowColor = rb.colors[0];
          ctx.strokeStyle = color;
          ctx.stroke();
          ctx.restore();
        };

        drawStroke(rb.width * 7, 0.09, 26, grad); // outer bloom
        drawStroke(rb.width * 3, 0.20, 16, grad); // mid glow
        drawStroke(rb.width,     0.80, 8,  grad); // bright core
      }

      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      parent.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
