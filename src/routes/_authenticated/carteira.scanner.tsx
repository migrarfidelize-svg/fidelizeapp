import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { QrScanner } from "@/components/QrScanner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, CameraOff, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/_authenticated/carteira/scanner")({
  component: WalletScannerPage,
});

function WalletScannerPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<"denied" | "unavailable" | "error" | "invalid" | null>(null);
  const [paused, setPaused] = useState(false);

  const onDetected = async (text: string) => {
    if (paused) return;
    setPaused(true);

    const raw = text.trim();
    // Exemplo de URL: https://afidelize.app/cartao/restaurante-do-joao
    const match = raw.match(/\/cartao\/([A-Za-z0-9_-]+)/);
    
    if (match && match[1]) {
      const slug = match[1];
      toast.success("Estabelecimento identificado!");
      navigate({ to: "/carteira/$slug", params: { slug } });
    } else {
      setError("invalid");
      setPaused(false);
      toast.error("QR Code não reconhecido.");
    }
  };

  const handleRetry = () => {
    setError(null);
    setPaused(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black text-white">
      {/* Header */}
      <div className="relative z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-white hover:bg-white/10"
          onClick={() => navigate({ to: "/carteira" })}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-lg font-bold">Escanear Estabelecimento</h1>
        <div className="w-10" />
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center p-6 text-center">
        <AnimatePresence mode="wait">
          {!error ? (
            <motion.div 
              key="scanner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full max-w-sm flex flex-col items-center justify-center"
            >
              <div className="w-full aspect-square relative overflow-hidden rounded-[40px] shadow-[0_0_100px_rgba(var(--primary-rgb),0.2)]">
                <QrScanner onDetected={onDetected} paused={paused} />
                
                {/* O QrScanner já renderiza HUD overlays se o CSS bater, mas garantimos o visual Afidelize */}
                <div className="absolute inset-0 pointer-events-none border-2 border-primary/20 rounded-[40px]" />
              </div>
              <p className="mt-10 text-sm text-neutral-400 font-medium max-w-[240px] leading-relaxed">
                Aponte a câmera para o QR Code de um estabelecimento parceiro
              </p>
            </motion.div>
          ) : (
            <motion.div 
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-6"
            >
              {error === "denied" ? (
                <>
                  <CameraOff className="h-16 w-16 text-destructive" />
                  <div>
                    <h2 className="text-xl font-bold">Câmera Negada</h2>
                    <p className="text-sm text-neutral-400 mt-2">Ative a permissão de câmera nas configurações do seu navegador.</p>
                  </div>
                </>
              ) : error === "invalid" ? (
                <>
                  <AlertCircle className="h-16 w-16 text-yellow-500" />
                  <div>
                    <h2 className="text-xl font-bold">QR Inválido</h2>
                    <p className="text-sm text-neutral-400 mt-2">Este QR Code não pertence a um estabelecimento Afidelize.</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-16 w-16 text-destructive" />
                  <div>
                    <h2 className="text-xl font-bold">Câmera Indisponível</h2>
                    <p className="text-sm text-neutral-400 mt-2">Não detectamos uma câmera funcional neste dispositivo.</p>
                  </div>
                </>
              )}

              <div className="flex flex-col gap-3 w-full max-w-[220px] mt-4">
                <Button onClick={handleRetry} className="w-full gap-2 gradient-brand">
                  <RefreshCw className="h-4 w-4" /> Tentar novamente
                </Button>
                <Button variant="ghost" onClick={() => navigate({ to: "/carteira" })} className="w-full text-neutral-400">
                  Voltar para Carteira
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

