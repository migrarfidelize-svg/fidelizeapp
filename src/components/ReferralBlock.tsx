import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Loader2, Share2, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyReferralByToken, trackReferralEvent } from "@/lib/retention.functions";

/**
 * Voucher block: apply an incoming referral code (once per customer) and
 * share your own referral code with friends.
 */
export function ReferralBlock({
  token,
  cardId,
  ownCode,
  alreadyReferred,
}: {
  token: string;
  cardId?: string;
  ownCode: string | null;
  alreadyReferred: boolean;
}) {
  const apply = useServerFn(applyReferralByToken);
  const track = useServerFn(trackReferralEvent);
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  function logShare() {
    if (!ownCode) return;
    track({ data: { code: ownCode, kind: "share" } }).catch(() => {});
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = sessionStorage.getItem("fidelize_referral_code");
      if (saved) setCode(saved);
    } catch {
      /* noop */
    }
  }, []);

  async function submit() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const res = await apply({ data: { token, code: code.trim().toUpperCase() } });
      toast.success(
        `Indicação de ${res.referrer} aplicada! Você e ${res.referrer} ganharam ${res.bonus} carimbo(s).`,
      );
      try {
        sessionStorage.removeItem("fidelize_referral_code");
      } catch {
        /* noop */
      }
      qc.invalidateQueries({ queryKey: ["card", token] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código inválido.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!ownCode) return;
    const url = `${window.location.origin}/r/${ownCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copiado!");
      logShare();
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  async function shareNative() {
    if (!ownCode) return;
    const url = `${window.location.origin}/r/${ownCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Cartão fidelidade",
          text: `Use meu código de indicação e ganhe um carimbo-bônus:`,
          url,
        });
        logShare();
      } catch {
        /* user cancelled */
      }
    } else {
      copyLink();
    }
  }

  // Silence unused var — cardId is reserved for future granular invalidation.
  void cardId;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gift className="h-4 w-4" /> Indique amigos, ganhe carimbos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!alreadyReferred && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Foi indicado por um amigo? Aplique o código abaixo:
            </p>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={20}
                placeholder="Ex.: FID-A1B2"
                className="uppercase font-mono"
              />
              <Button onClick={submit} disabled={busy || code.length < 4}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
              </Button>
            </div>
          </div>
        )}

        {ownCode && (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Seu código</span>
              <span className="font-mono font-bold">{ownCode}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={copyLink}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="ml-1 text-xs">Copiar link</span>
              </Button>
              <Button size="sm" className="flex-1" onClick={shareNative}>
                <Share2 className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">Compartilhar</span>
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Quando um amigo usar seu código, vocês dois ganham carimbos-bônus automaticamente.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
