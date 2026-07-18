import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface Props {
  file: File | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Output size in px (square). Default 512. */
  outputSize?: number;
  onCropped: (blob: Blob) => void;
}

/**
 * Cropper simples: canvas quadrado com pan (arrastar) e zoom (slider/roda).
 * Sempre gera um PNG quadrado no tamanho `outputSize`, ideal para logos.
 */
export function LogoCropper({ file, open, onOpenChange, outputSize = 512, onCropped }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [ready, setReady] = useState(false);
  const VIEW = 320; // preview canvas size (px)

  // Load image when file changes
  useEffect(() => {
    if (!file) { imgRef.current = null; setReady(false); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Fit-cover baseline: min zoom so the image covers the crop area
      const base = Math.max(VIEW / img.width, VIEW / img.height);
      setZoom(base);
      setOffset({ x: 0, y: 0 });
      setReady(true);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); setReady(false); };
    img.src = url;
  }, [file]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, VIEW, VIEW);
    // Checkerboard background so PNG transparency is visible
    ctx.fillStyle = "#f4f4f5";
    ctx.fillRect(0, 0, VIEW, VIEW);
    ctx.fillStyle = "#e4e4e7";
    const s = 16;
    for (let y = 0; y < VIEW; y += s) {
      for (let x = 0; x < VIEW; x += s) {
        if (((x / s) + (y / s)) % 2 === 0) ctx.fillRect(x, y, s, s);
      }
    }
    const w = img.width * zoom;
    const h = img.height * zoom;
    const dx = (VIEW - w) / 2 + offset.x;
    const dy = (VIEW - h) / 2 + offset.y;
    ctx.drawImage(img, dx, dy, w, h);
  }, [zoom, offset]);

  useEffect(() => { if (ready) draw(); }, [draw, ready]);

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragging) return;
    setOffset({ x: dragStart.current.ox + (e.clientX - dragStart.current.x), y: dragStart.current.oy + (e.clientY - dragStart.current.y) });
  }
  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }
  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoom((z) => Math.max(minZoom(), Math.min(6, z + delta)));
  }
  function minZoom() {
    const img = imgRef.current;
    if (!img) return 0.1;
    return Math.max(VIEW / img.width, VIEW / img.height);
  }
  function reset() {
    const img = imgRef.current; if (!img) return;
    setZoom(Math.max(VIEW / img.width, VIEW / img.height));
    setOffset({ x: 0, y: 0 });
  }

  async function confirm() {
    const img = imgRef.current;
    if (!img) return;
    const out = document.createElement("canvas");
    out.width = outputSize; out.height = outputSize;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const scale = outputSize / VIEW;
    const w = img.width * zoom * scale;
    const h = img.height * zoom * scale;
    const dx = (outputSize - w) / 2 + offset.x * scale;
    const dy = (outputSize - h) / 2 + offset.y * scale;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, dx, dy, w, h);
    const blob: Blob | null = await new Promise((res) => out.toBlob((b) => res(b), "image/png", 0.95));
    if (blob) { onCropped(blob); onOpenChange(false); }
  }

  const min = minZoom();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar logo</DialogTitle>
          <DialogDescription>Arraste para posicionar e use o zoom para enquadrar. O logo ficará quadrado.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={VIEW}
            height={VIEW}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onWheel={onWheel}
            className="rounded-full border touch-none cursor-grab active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
          />
        </div>
        <div className="flex items-center gap-3">
          <ZoomOut className="h-4 w-4 text-muted-foreground" />
          <Slider min={min} max={Math.max(min * 4, 4)} step={0.01} value={[zoom]} onValueChange={([v]) => setZoom(v)} className="flex-1" />
          <ZoomIn className="h-4 w-4 text-muted-foreground" />
          <Button type="button" size="icon" variant="ghost" onClick={reset} title="Redefinir">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={confirm} disabled={!ready}>Usar este recorte</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
