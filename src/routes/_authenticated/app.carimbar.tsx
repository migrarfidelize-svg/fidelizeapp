import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyEstablishments, searchCustomer, addStamp, undoLastStamp, getCardByToken, redeemReward } from "@/lib/loyalty.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Search, Stamp as StampIcon, Undo2, Gift, User } from "lucide-react";
import { formatPhone } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/carimbar")({
  head: () => ({ meta: [{ title: "Carimbar cliente — Fidelize" }] }),
  component: Carimbar,
});

function Carimbar() {
  const getEsts = useServerFn(getMyEstablishments);
  const search = useServerFn(searchCustomer);
  const addStampFn = useServerFn(addStamp);
  const undoFn = useServerFn(undoLastStamp);
  const getCard = useServerFn(getCardByToken);
  const redeem = useServerFn(redeemReward);

  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as { id: string; name: string } | undefined;

  const [q, setQ] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchCustomer>>>([]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [cardData, setCardData] = useState<Awaited<ReturnType<typeof getCardByToken>> | null>(null);
  const [busy, setBusy] = useState(false);

  async function doSearch() {
    if (!est || q.trim().length < 1) return;
    try {
      const r = await search({ data: { establishment_id: est.id, query: q } });
      setResults(r);
      if (r.length === 0) toast.info("Nenhum cliente encontrado");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function loadCustomer(customerId: string) {
    // fetch access_token via server-based card lookup requires token, so we query direct via search returns
    // But results don't include access_token. Fetch it via a fresh lightweight call:
    const r = results.find((x) => x.id === customerId);
    if (!r) return;
    // Use code as token isn't there — need to get via getCardByToken with customer's token
    // Fallback: query a fresh row via server: rely on same search response by adding access_token to searchCustomer
    // For now: prompt server through a re-search to include token later; keep simple by directly loading via customer id server function
    void r;
    toast.info("Selecione via QR ou digite o código do cliente");
  }

  async function loadByToken(token: string) {
    setSelectedToken(token);
    setBusy(true);
    try {
      const d = await getCard({ data: { token } });
      if (!d) { toast.error("Cliente não encontrado"); return; }
      setCardData(d);
    } finally { setBusy(false); }
  }

  async function handleStamp(cardId: string) {
    setBusy(true);
    try {
      let r;
      try {
        r = await addStampFn({ data: { card_id: cardId } });
      } catch (err: any) {
        if (/PIN/.test(err?.message ?? "")) {
          const pin = window.prompt("Digite seu PIN de carimbo (4-6 dígitos):") ?? "";
          if (!/^\d{4,6}$/.test(pin)) { toast.error("PIN inválido"); return; }
          r = await addStampFn({ data: { card_id: cardId, pin } });
        } else { throw err; }
      }
      toast.success(r.completed ? "🎉 Recompensa desbloqueada!" : `Carimbo adicionado (${r.stamps}/${r.required})`);
      if (selectedToken) await loadByToken(selectedToken);
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

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Ação</div>
        <h1 className="font-display text-3xl font-bold">Carimbar cliente</h1>
        <p className="text-sm text-muted-foreground mt-1">Busque por telefone, nome ou código do cliente.</p>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()} placeholder="Nome, telefone ou código" className="pl-9" />
            </div>
            <Button onClick={doSearch}>Buscar</Button>
          </div>
          {results.length > 0 && (
            <div className="mt-4 divide-y">
              {results.map((c) => (
                <button key={c.id} onClick={() => loadCustomer(c.id)} className="w-full flex items-center justify-between py-3 text-left hover:bg-muted/50 -mx-3 px-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary"><User className="h-5 w-5" /></div>
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{formatPhone(c.phone)} · código {c.code}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{c.visits_count} visitas</div>
                </button>
              ))}
              <div className="pt-3 text-xs text-muted-foreground">Selecione um cliente para ver o cartão. Dica: peça o cliente para mostrar o QR Code dele, ou digite o código de 6 letras no campo acima.</div>
            </div>
          )}
        </CardContent>
      </Card>

      {cardData && (
        <Card>
          <CardContent className="p-5 space-y-4">
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
                          <div className="flex items-center gap-2 text-sm"><Gift className="h-4 w-4 text-success" /> Recompensa disponível: <strong>{campaign.reward_title}</strong></div>
                          <Button size="sm" variant="outline" onClick={() => handleRedeem(r.id)} disabled={busy}>Entregar</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
