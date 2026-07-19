import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, Apple, Smartphone, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { getWalletCapabilities, getPassJson, getGoogleWalletLink } from "@/lib/wallet.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function WalletButtons({ token }: { token: string }) {
  const capsFn = useServerFn(getWalletCapabilities);
  const passFn = useServerFn(getPassJson);
  const googleFn = useServerFn(getGoogleWalletLink);
  const [help, setHelp] = useState<"ios" | "android" | null>(null);

  const { data: caps } = useQuery({
    queryKey: ["wallet-caps", token],
    queryFn: () => capsFn({ data: { token } }),
    staleTime: 60_000,
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  async function handleApple() {
    if (!caps?.apple) {
      // Fall back to downloading the pass.json + guide.
      try {
        const pass = await passFn({ data: { token, origin } });
        const blob = new Blob([JSON.stringify(pass, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fidelize-${token.slice(0, 8)}.pass.json`;
        a.click();
        URL.revokeObjectURL(url);
        setHelp("ios");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao gerar cartão");
      }
      return;
    }
    // Signed .pkpass endpoint
    window.location.href = `/api/public/wallet/apple/${token}`;
  }

  async function handleGoogle() {
    try {
      const r = await googleFn({ data: { token, origin } });
      if (r.configured && r.saveUrl) {
        window.open(r.saveUrl, "_blank", "noopener");
      } else {
        setHelp("android");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar link");
    }
  }

  async function handleShare() {
    const url = `${origin}/c/${token}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Meu cartão fidelidade", url }); return; } catch { /* cancelled */ }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  }

  return (
    <section className="mt-6 rounded-3xl border bg-card/70 p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Wallet className="h-4 w-4" /> Adicionar ao celular
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Guarde o cartão na sua carteira digital ou tela inicial para acessar sem precisar do link.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {(isIOS || !isAndroid) && (
          <Button variant="outline" onClick={handleApple} className="justify-start">
            <Apple className="mr-2 h-4 w-4" />
            {caps?.apple ? "Adicionar ao Apple Wallet" : "Baixar cartão (iOS)"}
          </Button>
        )}
        {(isAndroid || !isIOS) && (
          <Button variant="outline" onClick={handleGoogle} className="justify-start">
            <Smartphone className="mr-2 h-4 w-4" />
            {caps?.google ? "Salvar na Google Wallet" : "Instalar como app (Android)"}
          </Button>
        )}
        <Button variant="outline" onClick={handleShare} className="justify-start sm:col-span-2">
          <Share2 className="mr-2 h-4 w-4" /> Compartilhar meu cartão
        </Button>
      </div>

      <Dialog open={!!help} onOpenChange={(o) => !o && setHelp(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-4 w-4" /> Como salvar no celular
            </DialogTitle>
            <DialogDescription>
              {help === "ios"
                ? "Cartão gerado! Para adicionar ao Apple Wallet oficial, o estabelecimento precisa finalizar a configuração da Apple. Enquanto isso, salve o cartão como atalho:"
                : "Para Google Wallet, o estabelecimento precisa finalizar a configuração do Google. Enquanto isso, instale como aplicativo:"}
            </DialogDescription>
          </DialogHeader>
          {help === "ios" ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Toque no botão <b>Compartilhar</b> do Safari.</li>
              <li>Escolha <b>Adicionar à Tela de Início</b>.</li>
              <li>Confirme. O cartão vira um ícone e abre em tela cheia, offline.</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Abra o menu do Chrome (⋮).</li>
              <li>Escolha <b>Instalar aplicativo</b> ou <b>Adicionar à tela inicial</b>.</li>
              <li>Confirme. O cartão vira um app com QR sempre disponível.</li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
