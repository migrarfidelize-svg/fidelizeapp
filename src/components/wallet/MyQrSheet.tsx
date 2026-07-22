import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { QrCode, Gift, Sparkles, Timer, RefreshCw, CheckCircle2, ChevronDown, Maximize2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getMyWallet, getMyRewards } from "@/lib/my-wallet.functions";
import { issueRedeemToken } from "@/lib/redeem.functions";

type WalletItem = Awaited<ReturnType<typeof getMyWallet>>[number];

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

/**
 * Sheet do "Meu QR" acionado pelo FAB central da /carteira.
 * Modos:
 *  - identity: mostra o QR do cliente (link /c/<token>) para carimbar
 *  - redeem: gera QR temporário assinado (60s) para retirar recompensa pronta
 */
export function MyQrSheet({ open, onOpenChange }: Props) {
  const { data: wallet } = useQuery({
    enabled: open,
    queryKey: ["my-wallet"],
    queryFn: () => getMyWallet(),
    staleTime: 15_000,
  });
  const { data: rewards } = useQuery({
    enabled: open,
    queryKey: ["my-rewards"],
    queryFn: () => getMyRewards(),
    staleTime: 15_000,
  });

  const items = wallet ?? [];
  const readyRewards = (rewards ?? []).filter((r) => r.ready);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [mode, setMode] = useState<"identity" | "redeem">("identity");
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) { setMode("identity"); setSelectedIdx(0); setPickerOpen(false); }
  }, [open]);

  const active = items[selectedIdx];
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="border-b border-border/60 bg-background/70 px-5 py-3 backdrop-blur">
          <DialogTitle className="flex items-center gap-2 font-display text-base">
            <QrCode className="h-4 w-4 text-primary" />
            {mode === "redeem" ? "Resgatar recompensa" : "Meu QR"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {mode === "redeem"
              ? "Mostre este código ao atendente. Válido por 60 segundos."
              : "Peça ao atendente para escanear e receber seu carimbo."}
          </DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Você ainda não tem cartões. Escaneie o QR de um estabelecimento para começar.
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Toggle Cartão / Resgate */}
            {readyRewards.length > 0 && (
              <div className="grid grid-cols-2 rounded-full border border-border/60 bg-muted/30 p-1 text-xs font-semibold">
                <button
                  onClick={() => setMode("identity")}
                  className={"rounded-full py-1.5 transition-all " + (mode === "identity" ? "bg-background shadow-sm" : "text-muted-foreground")}
                >
                  Cartão
                </button>
                <button
                  onClick={() => setMode("redeem")}
                  className={"inline-flex items-center justify-center gap-1 rounded-full py-1.5 transition-all " + (mode === "redeem" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}
                >
                  <Sparkles className="h-3 w-3" /> Resgatar ({readyRewards.length})
                </button>
              </div>
            )}

            {mode === "identity" && active && (
              <IdentityQR
                item={active}
                origin={origin}
                canSwitch={items.length > 1}
                onOpenPicker={() => setPickerOpen(true)}
              />
            )}

            {mode === "redeem" && (
              <RedeemFlow rewards={readyRewards} />
            )}
          </div>
        )}

        {/* Picker de estabelecimento */}
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm">Escolha o cartão</DialogTitle>
            </DialogHeader>
            <ul className="max-h-72 space-y-1 overflow-auto">
              {items.map((it, idx) => {
                const est = it.establishment as { name: string; logo_url: string | null; primary_color: string };
                return (
                  <li key={it.customer.id}>
                    <button
                      onClick={() => { setSelectedIdx(idx); setPickerOpen(false); }}
                      className={"flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors " +
                        (idx === selectedIdx ? "border-primary/50 bg-primary/5" : "border-border/50 hover:border-primary/30")}
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border/60 bg-muted text-xs font-bold uppercase" style={{ color: est.primary_color || undefined }}>
                        {est.logo_url ? <img src={est.logo_url} alt="" className="h-full w-full object-cover" /> : est.name.slice(0, 2)}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{est.name}</span>
                      {idx === selectedIdx && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function IdentityQR({ item, origin, canSwitch, onOpenPicker }: {
  item: WalletItem; origin: string; canSwitch: boolean; onOpenPicker: () => void;
}) {
  const est = item.establishment as { name: string; logo_url: string | null; primary_color: string };
  const token = item.customer.token;
  const url = `${origin}/c/${token}`;
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    QRCode.toDataURL(url, { width: 640, margin: 1, errorCorrectionLevel: "M" }).then(setDataUrl).catch(() => {});
  }, [url]);

  return (
    <div className="space-y-4">
      <button
        onClick={onOpenPicker}
        disabled={!canSwitch}
        className={"flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-3 text-left " + (canSwitch ? "hover:border-primary/40" : "")}
      >
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-muted text-sm font-bold uppercase" style={{ color: est.primary_color || undefined }}>
          {est.logo_url ? <img src={est.logo_url} alt="" className="h-full w-full object-cover" /> : est.name.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Cartão de</div>
          <div className="truncate font-display text-sm font-semibold">{est.name}</div>
        </div>
        {canSwitch && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      <div className="relative mx-auto grid aspect-square w-full max-w-[280px] place-items-center rounded-3xl border border-border/60 bg-white p-5 shadow-lg">
        {dataUrl ? (
          <img src={dataUrl} alt="Meu QR" className="h-full w-full" />
        ) : (
          <div className="text-xs text-muted-foreground">Gerando…</div>
        )}
        <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-primary/20" />
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Código: <span className="font-mono font-semibold text-foreground">{item.customer.code}</span>
      </p>
    </div>
  );
}

type RewardItem = Awaited<ReturnType<typeof getMyRewards>>[number];

function RedeemFlow({ rewards }: { rewards: RewardItem[] }) {
  const issue = useServerFn(issueRedeemToken);
  const [selectedId, setSelectedId] = useState<string>(rewards[0]?.cardId ?? "");
  const selected = useMemo(() => rewards.find((r) => r.cardId === selectedId) ?? rewards[0], [rewards, selectedId]);

  const [, setToken] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Gera token quando muda a recompensa selecionada
  useEffect(() => {
    if (!selected) return;
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.cardId]);

  async function generate() {
    if (!selected?.rewardId) {
      toast.error("Recompensa não disponível para resgate agora.");
      return;
    }
    setBusy(true);
    try {
      const r = await issue({ data: { reward_id: selected.rewardId } });
      setToken(r.token);
      setExpiresAt(r.expiresAt);
      const url = await QRCode.toDataURL(r.token, { width: 640, margin: 1, errorCorrectionLevel: "M" });
      setDataUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o resgate");
    } finally { setBusy(false); }
  }

  const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const expired = expiresAt > 0 && remaining <= 0;

  if (!selected) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        <Gift className="mb-2 h-6 w-6" />
        Nenhuma recompensa pronta para resgate.
      </div>
    );
  }

  const est = selected.establishment as { name: string; logo_url: string | null; primary_color: string };

  return (
    <div className="space-y-3">
      {rewards.length > 1 && (
        <select
          value={selected.cardId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
        >
          {rewards.map((r) => (
            <option key={r.cardId} value={r.cardId}>
              {(r.establishment as { name: string }).name} — {r.reward}
            </option>
          ))}
        </select>
      )}

      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-background text-xs font-bold uppercase" style={{ color: est.primary_color || undefined }}>
            {est.logo_url ? <img src={est.logo_url} alt="" className="h-full w-full object-cover" /> : est.name.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">{est.name}</div>
            <div className="flex items-center gap-1 truncate font-display text-sm font-semibold">
              <Gift className="h-4 w-4 text-primary" /> {selected.reward}
            </div>
          </div>
        </div>
      </div>

      <div className="relative mx-auto grid aspect-square w-full max-w-[260px] place-items-center rounded-3xl border border-border/60 bg-white p-5 shadow-lg">
        {busy && <div className="text-xs text-muted-foreground">Gerando…</div>}
        {!busy && dataUrl && !expired && <img src={dataUrl} alt="QR de resgate" className="h-full w-full" />}
        {!busy && expired && (
          <div className="flex flex-col items-center gap-2 text-sm">
            <Timer className="h-6 w-6 text-muted-foreground" />
            <span className="text-muted-foreground">Código expirado</span>
          </div>
        )}
        {!busy && dataUrl && !expired && (
          <div className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-primary/40 animate-pulse" />
        )}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Timer className="h-3.5 w-3.5" /> {expired ? "Expirado" : `Expira em ${remaining}s`}
        </span>
        <Button size="sm" variant="ghost" onClick={generate} disabled={busy}>
          <RefreshCw className={"mr-1 h-3.5 w-3.5 " + (busy ? "animate-spin" : "")} /> Gerar novo
        </Button>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Mostre ao atendente. Após a leitura, sua recompensa é entregue automaticamente.
      </p>
    </div>
  );
}
