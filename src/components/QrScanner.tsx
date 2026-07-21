import { useEffect, useRef, useState } from "react";
import QrScannerLib from "qr-scanner";
import { Button } from "@/components/ui/button";
import { Camera, Image as ImageIcon, RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
  onDetected: (text: string) => void;
  paused?: boolean;
}

type CamState = "idle" | "requesting" | "running" | "denied" | "unavailable" | "error";

export function QrScanner({ onDetected, paused }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScannerLib | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<CamState>("idle");
  const [errMsg, setErrMsg] = useState<string>("");
  const lastEmitted = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  function emit(text: string) {
    const now = Date.now();
    if (lastEmitted.current.text === text && now - lastEmitted.current.at < 2500) return;
    lastEmitted.current = { text, at: now };
    onDetected(text);
  }

  async function start() {
    if (!videoRef.current) return;
    setState("requesting");
    setErrMsg("");
    try {
      const hasCam = await QrScannerLib.hasCamera();
      if (!hasCam) { setState("unavailable"); return; }
      const scanner = new QrScannerLib(
        videoRef.current,
        (result) => emit(result.data),
        { preferredCamera: "environment", highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 5 },
      );
      scannerRef.current = scanner;
      await scanner.start();
      setState("running");
    } catch (e: any) {
      const msg = String(e?.message || e || "");
      if (/Permission|NotAllowed|denied/i.test(msg)) setState("denied");
      else if (/NotFound|no camera/i.test(msg)) setState("unavailable");
      else { setState("error"); setErrMsg(msg); }
    }
  }

  useEffect(() => {
    start();
    return () => { scannerRef.current?.stop(); scannerRef.current?.destroy(); scannerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!scannerRef.current) return;
    if (paused) scannerRef.current.stop();
    else if (state === "running") scannerRef.current.start().catch(() => {});
  }, [paused, state]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const res = await QrScannerLib.scanImage(f, { returnDetailedScanResult: true });
      emit(res.data);
    } catch {
      setErrMsg("Não foi possível ler um QR Code nessa imagem.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="scanner-stage mx-auto max-w-md">
        <div className="scanner-viewport">
          <video ref={videoRef} muted playsInline />

          {/* HUD overlays */}
          <div className="scanner-grid" aria-hidden />
          <div className="scanner-vignette" aria-hidden />
          <span className="scan-corner scan-corner-tl" aria-hidden />
          <span className="scan-corner scan-corner-tr" aria-hidden />
          <span className="scan-corner scan-corner-bl" aria-hidden />
          <span className="scan-corner scan-corner-br" aria-hidden />
          <div className="scan-reticle" aria-hidden />
          {state === "running" && <div className="scan-beam" aria-hidden />}

          <div className="scan-hud scan-hud-top" aria-hidden>
            <span className="scan-hud-dot" />
            {state === "running" ? "SCANNING · LIVE" : state === "requesting" ? "INITIALIZING" : "STANDBY"}
          </div>
          <div className="scan-hud scan-hud-bot" aria-hidden>QR · FIDELIZE</div>

          {state !== "running" && (
            <div className="scan-overlay">
              {state === "requesting" && (
                <div className="flex items-center gap-2 text-sm">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Solicitando câmera…
                </div>
              )}
              {state === "denied" && (
                <div className="space-y-3">
                  <AlertTriangle className="h-8 w-8 mx-auto text-warning" />
                  <div className="text-sm">Acesso à câmera negado. Ative a permissão no navegador.</div>
                  <Button size="sm" variant="secondary" onClick={start}>Tentar novamente</Button>
                </div>
              )}
              {state === "unavailable" && (
                <div className="space-y-3">
                  <Camera className="h-8 w-8 mx-auto opacity-60" />
                  <div className="text-sm">Câmera indisponível neste dispositivo.</div>
                </div>
              )}
              {state === "error" && (
                <div className="space-y-3">
                  <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
                  <div className="text-sm">Erro: {errMsg || "não foi possível iniciar."}</div>
                  <Button size="sm" variant="secondary" onClick={start}>Tentar novamente</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="text-center text-[11px] uppercase tracking-[0.24em] text-primary/80">
        Aponte a câmera para o QR do cartão
      </div>

      <div className="flex gap-2 justify-center">
        <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} className="border-primary/30 hover:bg-primary/10">
          <ImageIcon className="h-4 w-4 mr-1" /> Enviar imagem
        </Button>
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>
      {errMsg && state === "running" && <div className="text-xs text-center text-destructive">{errMsg}</div>}
    </div>
  );
}

