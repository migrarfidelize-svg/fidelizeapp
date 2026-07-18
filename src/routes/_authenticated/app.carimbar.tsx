import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyEstablishments, searchCustomer, addStamp, undoLastStamp, getCardByToken, redeemReward, listCustomers } from "@/lib/loyalty.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Stamp as StampIcon, Undo2, Gift, User, QrCode, Loader2, CheckCircle2 } from "lucide-react";
import { formatPhone } from "@/lib/format";
import { QrScanner } from "@/components/QrScanner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/carimbar")({
  head: () => ({ meta: [{ title: "Carimbar cliente — Fidelize" }] }),
  component: Carimbar,
});

type CardData = Awaited<ReturnType<typeof getCardByToken>>;

function initialsOf(name: string) {
  const p = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] ?? "") + (p[p.length - 1][0] ?? "")).toUpperCase();
}

function extractToken(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // Full URL with /c/<token>
  const m = s.match(/\/c\/([A-Za-z0-9_-]{20,80})/);
  if (m) return m[1];
  // Bare token
  if (/^[A-Za-z0-9_-]{20,80}$/.test(s)) return s;
  return null;
}

function Carimbar() {
  const getEsts = useServerFn(getMyEstablishments);
  const search = useServerFn(searchCustomer);
  const listAll = useServerFn(listCustomers);
  const addStampFn = useServerFn(addStamp);
  const undoFn = useServerFn(undoLastStamp);
  const getCard = useServerFn(getCardByToken);
  const redeem = useServerFn(redeemReward);

  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as { id: string; name: string } | undefined;

  const [staffName, setStaffName] = useState<string>("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const meta = (u?.user_metadata ?? {}) as { full_name?: string; name?: string };
      setStaffName(meta.full_name || meta.name || u?.email || "");
    });
  }, []);

  // Search state
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchCustomer>>>([]);

  // Card / dialog state
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scanError, setScanError] = useState<string>("");

  async function doSearch() {
    if (!est || q.trim().length < 1) return;
    try {
      const r = await search({ data: { establishment_id: est.id, query: q } });
      setResults(r);
      if (r.length === 0) toast.info("Nenhum cliente encontrado");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function loadByToken(token: string, opts?: { openDialog?: boolean }) {
    setBusy(true);
    setScanError("");
    try {
      const d = await getCard({ data: { token } });
      if (!d) { setScanError("Cliente não encontrado."); toast.error("Cliente não encontrado"); return null; }
      if (est && d.customer.establishment_id !== est.id) {
        setScanError("Este cartão pertence a outra empresa.");
        toast.error("Cartão de outra empresa");
        return null;
      }
      setSelectedToken(token);
      setCardData(d);
      if (opts?.openDialog) setConfirmOpen(true);
      return d;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao buscar cartão";
      setScanError(msg);
      toast.error(msg);
      return null;
    } finally { setBusy(false); }
  }

  async function onQrDetected(text: string) {
    if (scanBusy || confirmOpen) return;
    const token = extractToken(text);
    if (!token) { setScanError("QR Code inválido. Peça o cartão fidelidade do cliente."); return; }
    setScanBusy(true);
    try { await loadByToken(token, { openDialog: true }); }
    finally { setScanBusy(false); }
  }

  async function stampWithPinRetry(cardId: string) {
    try {
      return await addStampFn({ data: { card_id: cardId } });
    } catch (err: any) {
      if (/PIN/.test(err?.message ?? "")) {
        const pin = window.prompt("Digite seu PIN de carimbo (4-6 dígitos):") ?? "";
        if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN inválido");
        return await addStampFn({ data: { card_id: cardId, pin } });
      }
      throw err;
    }
  }

  async function handleStamp(cardId: string, opts?: { source?: string }) {
    setBusy(true);
    try {
      const r = await stampWithPinRetry(cardId);
      toast.success(r.completed ? "🎉 Recompensa desbloqueada!" : `Carimbo adicionado (${r.stamps}/${r.required})`);
      if (selectedToken) await loadByToken(selectedToken);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); void opts; }
  }

  async function confirmStampFromScan() {
    if (!cardData) return;
    const primary = cardData.cards[0];
    if (!primary) { toast.error("Cliente sem cartão ativo"); return; }
    setBusy(true);
    try {
      const r = await stampWithPinRetry(primary.id);
      toast.success(r.completed ? "🎉 Recompensa desbloqueada!" : `Carimbo adicionado (${r.stamps}/${r.required})`);
      setConfirmOpen(false);
      setCardData(null);
      setSelectedToken(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  async function handleUndo(cardId: string) {
    setBusy(true);
    try {
      await undoFn({ data: { card_id: cardId } });
      toast.success("Carimbo desfeito");
      if (selectedToken) await loadByToken(selectedToken);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  async function handleRedeem(rewardId: string) {
    setBusy(true);
    try {
      await redeem({ data: { reward_id: rewardId } });
      toast.success("Recompensa entregue!");
      if (selectedToken) await loadByToken(selectedToken);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  // Confirmation dialog data
  const dialogCard = cardData?.cards[0];
  const dialogCampaign = dialogCard?.campaigns as { name: string; stamps_required: number; reward_title: string } | undefined;
  const missing = dialogCard && dialogCampaign ? Math.max(0, dialogCampaign.stamps_required - dialogCard.stamps - 1) : 0;
  const willComplete = dialogCard && dialogCampaign ? dialogCard.stamps + 1 >= dialogCampaign.stamps_required : false;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Ação</div>
        <h1 className="font-display text-3xl font-bold">Carimbar cliente</h1>
        <p className="text-sm text-muted-foreground mt-1">Escaneie o QR Code do cartão ou pesquise o cliente.</p>
      </div>

      <Tabs defaultValue="scan" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="scan"><QrCode className="h-4 w-4 mr-2" /> Escanear</TabsTrigger>
          <TabsTrigger value="search"><Search className="h-4 w-4 mr-2" /> Pesquisar</TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="mt-4">
          <Card>
            <CardContent className="p-5">
              <QrScanner onDetected={onQrDetected} paused={confirmOpen} />
              {scanBusy && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Identificando cliente…
                </div>
              )}
              {scanError && !confirmOpen && (
                <div className="mt-3 text-center text-sm text-destructive">{scanError}</div>
              )}
              <div className="mt-4 text-center text-xs text-muted-foreground">
                Se a câmera não funcionar, use a aba <strong>Pesquisar</strong> ou envie uma imagem do QR.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="mt-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()} placeholder="Nome, telefone, e-mail ou código" className="pl-9" />
                </div>
                <Button onClick={doSearch}>Buscar</Button>
              </div>
              {results.length > 0 && (
                <div className="mt-4 divide-y">
                  {results.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary font-semibold text-xs">
                          {initialsOf(c.name)}
                        </div>
                        <div>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{formatPhone(c.phone)} · código {c.code}</div>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={async () => {
                        // Look up token by code via search endpoint? We'll query via getCardByToken can't accept code. Use customer code endpoint: fallback — use registerOrLogin flow not applicable. Best: fetch access_token via a targeted server call. Reuse: since the search returns id but not token, do a fresh RPC via getCardByToken by fetching from search that includes access. Simpler: prompt to use the code as token isn't safe; instead use search results id -> read customer row via admin server fn. Existing addStamp needs card_id; simpler path here: fetch by code using getCardByToken alternative. We'll trigger loadByCustomerId.
                        // Fallback: reuse code prompt if not available.
                        await loadByCustomerCode(c.code);
                      }}>
                        <User className="h-4 w-4 mr-1" /> Abrir cartão
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {cardData && (
                <div className="mt-6 border-t pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-display text-xl font-bold">{cardData.customer.name}</div>
                      <div className="text-xs text-muted-foreground">{formatPhone(cardData.customer.phone)}</div>
                    </div>
                    <button onClick={() => { setCardData(null); setSelectedToken(null); }} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
                  </div>
                  {cardData.cards.map((card) => {
                    const campaign = card.campaigns as { name: string; stamps_required: number; reward_title: string };
                    const pendingRewards = cardData.rewards.filter((r) => r.card_id === card.id && !r.redeemed_at);
                    return (
                      <div key={card.id} className="rounded-2xl border p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{campaign.name}</div>
                            <div className="text-xs text-muted-foreground">{card.stamps} de {campaign.stamps_required} carimbos · ciclo {card.cycle}</div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleUndo(card.id)} disabled={busy}><Undo2 className="h-4 w-4 mr-1" />Desfazer</Button>
                            <Button size="sm" onClick={() => handleStamp(card.id)} disabled={busy} className="gradient-brand text-primary-foreground"><StampIcon className="h-4 w-4 mr-1" />Carimbar</Button>
                          </div>
                        </div>
                        {pendingRewards.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {pendingRewards.map((r) => (
                              <div key={r.id} className="flex items-center justify-between rounded-xl bg-success/10 border border-success/30 p-3">
                                <div className="flex items-center gap-2 text-sm"><Gift className="h-4 w-4 text-success" /> Recompensa: <strong>{campaign.reward_title}</strong></div>
                                <Button size="sm" variant="outline" onClick={() => handleRedeem(r.id)} disabled={busy}>Entregar</Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation dialog for QR scan */}
      <Dialog open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); if (!o) { setCardData(null); setSelectedToken(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar carimbo</DialogTitle>
            <DialogDescription>Revise os dados antes de adicionar o carimbo.</DialogDescription>
          </DialogHeader>
          {cardData && dialogCard && dialogCampaign && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary font-display font-bold text-lg">
                  {initialsOf(cardData.customer.name)}
                </div>
                <div>
                  <div className="font-display text-lg font-bold">{cardData.customer.name}</div>
                  <div className="text-xs text-muted-foreground">{formatPhone(cardData.customer.phone)} · código {cardData.customer.code}</div>
                </div>
              </div>

              <div className="rounded-2xl border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Campanha</span>
                  <span className="font-medium">{dialogCampaign.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Carimbos atuais</span>
                  <span className="font-medium">{dialogCard.stamps} / {dialogCampaign.stamps_required}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Após este carimbo</span>
                  <span className="font-medium">
                    {willComplete ? "🎉 Recompensa liberada!" : `Faltam ${missing} para o prêmio`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Recompensa</span>
                  <span className="font-medium">{dialogCampaign.reward_title}</span>
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Unidade</span><span>{est?.name ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Funcionário</span><span>{staffName || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Origem</span><span>Leitura de QR Code</span></div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={confirmStampFromScan} disabled={busy} className="gradient-brand text-primary-foreground">
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Confirmar carimbo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Helpers scoped after render
  async function loadByCustomerCode(code: string) {
    // We need the access_token — use a server call. Fastest: query directly via a small server fn.
    // Fallback path: reuse searchCustomer + a token lookup via getCustomerToken (defined server-side).
    try {
      const { getCustomerTokenByCode } = await import("@/lib/loyalty.functions");
      const token = await getCustomerTokenByCode({ data: { establishment_id: est!.id, code } });
      if (!token) { toast.error("Cliente não encontrado"); return; }
      await loadByToken(token);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao abrir cartão");
    }
  }
}
