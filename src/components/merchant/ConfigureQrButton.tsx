import { Link } from "@tanstack/react-router";
import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QrDest } from "@/lib/qr-destination-url";

/**
 * Atalho "Configurar QR Code": leva para a central de QR Codes já com o
 * destino desta área selecionado.
 */
export function ConfigureQrButton({
  dest,
  label = "Configurar QR Code",
  className,
  variant = "outline",
  size = "sm",
}: {
  dest: QrDest;
  label?: string;
  className?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "sm" | "default";
}) {
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <Link to="/app/qr" search={{ dest }}>
        <QrCode className="mr-2 h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
