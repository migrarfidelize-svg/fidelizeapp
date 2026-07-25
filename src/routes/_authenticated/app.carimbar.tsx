import { createFileRoute } from "@tanstack/react-router";
import { QUICK_SEARCH_KEY } from "@/components/merchant/QuickSearch";
import { PageHero } from "@/components/PageHero";
import { Zap as HeroIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyEstablishments, addStamp, undoLastStamp, getCardByToken, redeemReward, listCustomers } from "@/lib/loyalty.functions";
import { consumeRedeemToken } from "@/lib/redeem.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Stamp as StampIcon, Undo2, Gift, User, QrCode, Loader2, CheckCircle2, Copy, ExternalLink, Download } from "lucide-react";
import { formatPhone } from "@/lib/format";
import { QrScanner } from "@/components/QrScanner";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";

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
  const listAll = useServerFn(listCustomers);
  const addStampFn = useServerFn(addStamp);
  const undoFn = useServerFn(undoLastStamp);
  const getCard = useServerFn(getCardByToken);
  const redeem = useServerFn(redeemReward);
  const consumeRedeem = useServerFn(consumeRedeemToken);

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

  // Termo vindo da busca rápida global (⌘K) — preenche e busca automaticamente.
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem(QUICK_SEARCH_KEY);
      if (pending) {
        sessionStorage.removeItem(QUICK_SEARCH_KEY);
        setQ(pending);
        setSearchTerm(pending);
      }
    } catch { /* noop */ }
  }, []);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Card / dialog state
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scanError, setScanError] = useState<string>("");

  // Per-customer QR modal
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrCustomer, setQrCustomer] = useState<{ name: string; code: string; phone: string | null } | null>(null);
  const [qrUrl, setQrUrl] = useState<string>("");

  const { data: listData, isFetching: listFetching } = useQuery({
    enabled: !!est,
    queryKey: ["carimbar-customers", est?.id, searchTerm, page],
    queryFn: () => listAll({ data: { establishment_id: est!.id, query: searchTerm, page, page_size: pageSize } }),
  });
  const results = listData?.customers ?? [];
  const total = listData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function doSearch() {
    setPage(1);
    setSearchTerm(q.trim());
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
    const raw = text.trim();

    // QR de resgate temporário emitido pela /carteira do cliente.
    if (raw.startsWith("RDM1.")) {
      setScanBusy(true);
      setScanError("");
      try {
        const r = await consumeRedeem({ data: { token: raw } });
        toast.success(`🎁 ${r.reward} entregue${r.customerName ? ` para ${r.customerName}` : ""}!`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Não foi possível resgatar.";
        setScanError(msg);
        toast.error(msg);
      } finally { setScanBusy(false); }
      return;
    }

    const token = extractToken(raw);
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
      <PageHero
        icon={HeroIcon}
        eyebrow={"Operação · Fidelização"}
        liveLabel={"Ao vivo"}
        title={"Carimbar cliente"}
        subtitle={"Registre visitas por leitura de QR ou busca em segundos."}
      />

      <Tabs defaultValue="scan" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md bg-[color:color-mix(in_oklab,var(--muted)_60%,transparent)] border border-border/60">
          <TabsTrigger
            value="scan"
            className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:border data-[state=active]:border-primary/40 data-[state=active]:shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_25%,transparent),0_6px_18px_-8px_color-mix(in_oklab,var(--primary)_45%,transparent)] font-medium transition-all"
          >
            <QrCode className="h-4 w-4 mr-2" /> Escanear
          </TabsTrigger>
          <TabsTrigger
            value="search"
            className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:border data-[state=active]:border-primary/40 data-[state=active]:shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_25%,transparent),0_6px_18px_-8px_color-mix(in_oklab,var(--primary)_45%,transparent)] font-medium transition-all"
          >
            <Search className="h-4 w-4 mr-2" /> Pesquisar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="mt-4">
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-[color:color-mix(in_oklab,var(--card)_55%,transparent)] p-6 sm:p-8 backdrop-blur-sm">
            {/* ambient background */}
            <span aria-hidden className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[80%] rounded-full bg-primary/20 blur-3xl opacity-60" />
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

            <div className="relative grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] items-center">
              <div>
                <QrScanner onDetected={onQrDetected} paused={confirmOpen} />
                {scanBusy && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" /> Identificando cliente…
                  </div>
                )}
                {scanError && !confirmOpen && (
                  <div className="mt-3 text-center text-sm text-destructive">{scanError}</div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-primary/80">Modo scanner</div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold mt-1 leading-tight">
                    Mira ativa. <span className="text-primary">Aproxime o QR.</span>
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    Detecção automática em tempo real. Confirme os dados no diálogo antes de finalizar o carimbo.
                  </p>
                </div>

                <ol className="space-y-2.5 text-sm">
                  {[
                    { n: "01", t: "Peça o cartão fidelidade do cliente" },
                    { n: "02", t: "Centralize o QR dentro da mira" },
                    { n: "03", t: "Revise os dados e confirme o carimbo" },
                  ].map((s) => (
                    <li key={s.n} className="flex items-center gap-3 rounded-xl border border-primary/25 bg-[color:color-mix(in_oklab,var(--primary)_6%,var(--card))] px-3 py-2.5">
                      <span className="inline-flex items-center justify-center h-6 min-w-[1.75rem] rounded-md bg-primary/15 text-primary font-mono text-[11px] font-semibold tracking-widest">{s.n}</span>
                      <span className="text-foreground font-medium">{s.t}</span>
                    </li>
                  ))}
                </ol>

                <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-primary shrink-0" />
                  Sem câmera? Use <strong className="text-foreground">Pesquisar</strong> ou <strong className="text-foreground">Enviar imagem</strong>.
                </div>
              </div>
            </div>
          </div>
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
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <div>
                  {listFetching ? "Carregando…" : `${total} cliente${total === 1 ? "" : "s"}${searchTerm ? ` para "${searchTerm}"` : ""}`}
                </div>
                {searchTerm && (
                  <button onClick={() => { setQ(""); setSearchTerm(""); setPage(1); }} className="hover:text-foreground underline">Limpar filtro</button>
                )}
              </div>
              {results.length > 0 ? (
                <div className="mt-2 divide-y">
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
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openCustomerQr(c)} title="Ver QR Code do cliente">
                          <QrCode className="h-4 w-4 mr-1" /> Ver QR
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => loadByCustomerCode(c.code)}>
                          <User className="h-4 w-4 mr-1" /> Abrir cartão
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                !listFetching && (
                  <div className="mt-6 text-center text-sm text-muted-foreground py-8">
                    {searchTerm ? "Nenhum cliente encontrado para essa busca." : "Nenhum cliente cadastrado ainda."}
                  </div>
                )
              )}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || listFetching}>Anterior</Button>
                  <div className="text-xs text-muted-foreground">Página {page} de {totalPages}</div>
                  <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || listFetching}>Próxima</Button>
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

      {/* Per-customer QR dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code do cliente</DialogTitle>
            <DialogDescription>
              Cada cliente tem seu próprio QR. Ao ler, ele abre a carteira digital do próprio cliente.
            </DialogDescription>
          </DialogHeader>
          {qrCustomer && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary font-semibold">
                  {initialsOf(qrCustomer.name)}
                </div>
                <div>
                  <div className="font-display text-lg font-bold">{qrCustomer.name}</div>
                  <div className="text-xs text-muted-foreground">{formatPhone(qrCustomer.phone ?? "")} · código {qrCustomer.code}</div>
                </div>
              </div>

              <div className="rounded-2xl border p-4 grid place-items-center bg-white">
                {qrLoading || !qrDataUrl ? (
                  <div className="h-64 w-64 grid place-items-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <img src={qrDataUrl} alt={`QR de ${qrCustomer.name}`} className="h-64 w-64" />
                )}
              </div>

              <div className="rounded-xl bg-muted/50 p-3 text-xs">
                <div className="text-muted-foreground mb-1">Link do cliente</div>
                <div className="font-mono break-all">{qrUrl || "—"}</div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(qrUrl); toast.success("Link copiado"); }} disabled={!qrUrl}>
              <Copy className="h-4 w-4 mr-1" /> Copiar link
            </Button>
            <Button variant="outline" onClick={() => qrUrl && window.open(qrUrl, "_blank", "noopener,noreferrer")} disabled={!qrUrl}>
              <ExternalLink className="h-4 w-4 mr-1" /> Abrir
            </Button>
            <Button
              onClick={() => {
                if (!qrDataUrl || !qrCustomer) return;
                const a = document.createElement("a");
                a.href = qrDataUrl;
                a.download = `qr-${qrCustomer.code}.png`;
                a.click();
              }}
              disabled={!qrDataUrl}
              className="gradient-brand text-primary-foreground"
            >
              <Download className="h-4 w-4 mr-1" /> Baixar PNG
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Helpers scoped after render
  async function loadByCustomerCode(code: string) {
    try {
      const { getCustomerTokenByCode } = await import("@/lib/loyalty.functions");
      const token = await getCustomerTokenByCode({ data: { establishment_id: est!.id, code } });
      if (!token) { toast.error("Cliente não encontrado"); return; }
      await loadByToken(token);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao abrir cartão");
    }
  }

  async function openCustomerQr(c: { name: string; code: string; phone: string | null }) {
    setQrCustomer(c);
    setQrDataUrl("");
    setQrUrl("");
    setQrOpen(true);
    setQrLoading(true);
    try {
      const { getCustomerTokenByCode } = await import("@/lib/loyalty.functions");
      const token = await getCustomerTokenByCode({ data: { establishment_id: est!.id, code: c.code } });
      if (!token) { toast.error("Cliente não encontrado"); setQrOpen(false); return; }
      const url = `${window.location.origin}/c/${token}`;
      setQrUrl(url);
      const dataUrl = await QRCode.toDataURL(url, {
        width: 1024,
        margin: 1,
        errorCorrectionLevel: "H",
        color: { dark: "#000000", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar QR");
      setQrOpen(false);
    } finally {
      setQrLoading(false);
    }
  }
}
