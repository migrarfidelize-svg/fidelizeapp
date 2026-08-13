import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, ExternalLink, X, Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getMyWallet } from "@/lib/my-wallet.functions";
import { useQuery } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type WalletItem = Awaited<ReturnType<typeof getMyWallet>>[number];

/**
 * Mapeia o destino técnico do QR para um nome amigável para o cliente.
 */
function getFriendlyDestinationName(dest: string | null | undefined): string {
  const v = String(dest ?? "").toLowerCase();
  switch (v) {
    case "menu":
      return "Cardápio";
    case "catalog":
      return "Catálogo";
    case "landing":
      return "Fidelidade";
    case "reviews":
      return "Avaliações";
    case "linktree":
      return "Links";
    default:
      return "Página do estabelecimento";
  }
}

export function WalletQrSheet({ open, onOpenChange }: Props) {
  const { data: wallet, isLoading } = useQuery({
    enabled: open,
    queryKey: ["my-wallet"],
    queryFn: () => getMyWallet(),
    staleTime: 30_000,
  });

  const activeItems = (wallet ?? []).filter(
    (it) => (it.establishment as { active: boolean }).active
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="border-b border-border/60 bg-background/70 px-5 py-4 backdrop-blur shrink-0">
          <DialogTitle className="flex items-center gap-2 font-display text-base">
            <QrCode className="h-4 w-4 text-primary" />
            Meus QR Codes
          </DialogTitle>
          <DialogDescription className="text-xs">
            Acesse os estabelecimentos da sua carteira.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Carregando estabelecimentos…
            </div>
          ) : activeItems.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm">Nenhum QR Code disponível</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto">
                  Os QR Codes dos estabelecimentos da sua carteira aparecerão aqui.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {activeItems.map((item) => (
                <QrItem key={item.customer.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QrItem({ item }: { item: WalletItem }) {
  const est = item.establishment as unknown as {
    slug: string;
    name: string;
    logo_url: string | null;
    primary_color: string;
    qr_destination: string | null;
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrUrl = `${origin}/api/public/r/qr/${est.slug}/main`;
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    QRCode.toDataURL(qrUrl, {
      width: 600,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then(setDataUrl)
      .catch(console.error);
  }, [qrUrl]);

  const handleOpen = () => {
    window.location.href = qrUrl;
  };

  return (
    <div className="space-y-4 rounded-3xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-center gap-3">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-muted text-xs font-bold uppercase"
          style={{ color: est.primary_color || undefined }}
        >
          {est.logo_url ? (
            <img src={est.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            est.name.slice(0, 2)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-bold">{est.name}</div>
          <div className="text-[10px] uppercase tracking-widest text-primary font-bold">
            {getFriendlyDestinationName(est.qr_destination)}
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest"
          onClick={handleOpen}
        >
          <ExternalLink className="mr-1.5 h-3 w-3" />
          Abrir
        </Button>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[200px] rounded-2xl border border-border/40 bg-white p-3 shadow-sm">
        {dataUrl ? (
          <img src={dataUrl} alt={`QR Code ${est.name}`} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
            Gerando QR…
          </div>
        )}
      </div>
    </div>
  );
}
