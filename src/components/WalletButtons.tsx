import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, Apple, Loader2, Share2, Smartphone, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getWalletCapabilities, getGoogleWalletLink } from "@/lib/wallet.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/**
 * Botões "Adicionar ao Google Wallet" / "Adicionar ao Apple Wallet".
 * Mostra apenas o botão compatível com o aparelho; no desktop mostra os dois.
 */
export function WalletButtons({ token }: { token: string }) {
  const capsFn = useServerFn(getWalletCapabilities);
  const googleFn = useServerFn(getGoogleWalletLink);
  const [busy, setBusy] = useState<"apple" | "google" | null>(null);
  const [help, setHelp] = useState<"ios" | "android" | null>(null);
  const [done, setDone] = useState<"apple" | "google" | null>(null);

  const { data: caps } = useQuery({
    queryKey: ["wallet-caps", token],
    queryFn: () => capsFn({ data: { token } }),
    staleTime: 60_000,
  });

  const platform = detectPlatform();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const showApple = platform === "ios" || platform === "desktop";
  const showGoogle = platform === "android" || platform === "desktop";

  async function handleApple() {
    if (!caps?.apple) { setHelp("ios"); return; }
    setBusy("apple");
    try {
      window.location.href = `/api/public/wallet/apple/${token}`;
      setDone("apple");
    } finally {
      setTimeout(() => setBusy(null), 1500);
    }
  }

  async function handleGoogle() {
    if (!caps?.google) { setHelp("android"); return; }
    setBusy("google");
    try {
      const r = await googleFn({ data: { token, origin } });
      if (r.configured && r.saveUrl) {
        window.open(r.saveUrl, "_blank", "noopener");
        setDone("google");
        toast.success("Abrindo o Google Wallet…");
      } else {
        setHelp("android");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o cartão");
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    const url = `${origin}/c/${token}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Meu cartão fidelidade", url }); return; } catch { /* cancelado */ }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  }

  return (
    <section className="mt-6 rounded-3xl border bg-card/70 p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Wallet className="h-4 w-4" /> Carteira digital
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Salve o cartão no celular. Carimbos, pontos e nível são atualizados automaticamente.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {showGoogle && (
          <Button onClick={handleGoogle} disabled={busy === "google"} className="justify-start">
            {busy === "google" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}
            Adicionar ao Google Wallet
          </Button>
        )}
        {showApple && (
          <Button onClick={handleApple} disabled={busy === "apple"} variant={showGoogle ? "outline" : "default"} className="justify-start">
            {busy === "apple" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Apple className="mr-2 h-4 w-4" />}
            Adicionar ao Apple Wallet
          </Button>
        )}
        <Button variant="outline" onClick={handleShare} className="justify-start sm:col-span-2">
          <Share2 className="mr-2 h-4 w-4" /> Compartilhar meu cartão
        </Button>
      </div>

      {done && (
        <p className="mt-3 flex items-center gap-2 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Cartão enviado para a carteira. Ele será atualizado sozinho a cada carimbo.
        </p>
      )}

      <Dialog open={!!help} onOpenChange={(o) => !o && setHelp(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Carteira ainda não disponível</DialogTitle>
            <DialogDescription>
              {help === "ios"
                ? "O Apple Wallet ainda não foi liberado para este estabelecimento. Enquanto isso, salve o cartão na tela de início:"
                : "O Google Wallet ainda não foi liberado para este estabelecimento. Enquanto isso, instale o cartão como aplicativo:"}
            </DialogDescription>
          </DialogHeader>
          {help === "ios" ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Toque no botão <b>Compartilhar</b> do Safari.</li>
              <li>Escolha <b>Adicionar à Tela de Início</b>.</li>
              <li>Confirme. O cartão abre em tela cheia, mesmo offline.</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Abra o menu do Chrome (⋮).</li>
              <li>Escolha <b>Instalar aplicativo</b>.</li>
              <li>Confirme. O QR fica sempre à mão.</li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
