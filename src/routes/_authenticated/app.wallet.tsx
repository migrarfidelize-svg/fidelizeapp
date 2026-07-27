import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wallet, Loader2, RefreshCw, Smartphone, Apple, CheckCircle2, AlertTriangle } from "lucide-react";

import { getMyEstablishments } from "@/lib/loyalty.functions";
import { getWalletSettings, saveWalletSettings, resyncWalletPasses } from "@/lib/wallet-config.functions";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/app/wallet")({
  head: () => ({
    meta: [
      { title: "Carteira Digital — Fidelize" },
      { name: "description", content: "Personalize o cartão fidelidade que seus clientes salvam no Google Wallet e no Apple Wallet." },
      { property: "og:title", content: "Carteira Digital — Fidelize" },
      { property: "og:description", content: "Cores, textos e campos do cartão na carteira do celular do cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

type FieldKey = "customer" | "code" | "stamps" | "points" | "tier" | "reward" | "expiry" | "contact";

const FIELD_LABELS: Record<FieldKey, string> = {
  customer: "Nome do cliente",
  code: "Código do cliente",
  stamps: "Carimbos",
  points: "Pontos / visitas",
  tier: "Nível (bronze, prata…)",
  reward: "Recompensa atual",
  expiry: "Validade da recompensa",
  contact: "Contato do estabelecimento",
};

function WalletPage() {
  const qc = useQueryClient();
  const fetchEsts = useServerFn(getMyEstablishments);
  const fetchSettings = useServerFn(getWalletSettings);
  const save = useServerFn(saveWalletSettings);
  const resync = useServerFn(resyncWalletPasses);

  const ests = useQuery({ queryKey: ["my-establishments"], queryFn: () => fetchEsts() });
  const est = ests.data?.[0]?.establishment as { id: string; name?: string | null } | undefined;
  const estId = est?.id;

  const cfg = useQuery({
    queryKey: ["wallet-settings", estId],
    queryFn: () => fetchSettings({ data: { establishment_id: estId! } }),
    enabled: !!estId,
  });

  const [googleEnabled, setGoogleEnabled] = useState(true);
  const [appleEnabled, setAppleEnabled] = useState(true);
  const [logoUrl, setLogoUrl] = useState("");
  const [heroUrl, setHeroUrl] = useState("");
  const [bg, setBg] = useState("#5B21B6");
  const [fg, setFg] = useState("#FFFFFF");
  const [label, setLabel] = useState("#E9D5FF");
  const [frontText, setFrontText] = useState("");
  const [backText, setBackText] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [showQr, setShowQr] = useState(true);
  const [showBarcode, setShowBarcode] = useState(false);
  const [validity, setValidity] = useState<string>("");
  const [fields, setFields] = useState<Record<FieldKey, boolean>>({
    customer: true, code: true, stamps: true, points: true,
    tier: true, reward: true, expiry: true, contact: true,
  });

  useEffect(() => {
    const s = cfg.data?.settings as Record<string, unknown> | null | undefined;
    if (!cfg.data) return;
    if (s) {
      setGoogleEnabled(!!s.google_enabled);
      setAppleEnabled(!!s.apple_enabled);
      setLogoUrl((s.logo_url as string) ?? "");
      setHeroUrl((s.hero_image_url as string) ?? "");
      setBg((s.background_color as string) ?? "#5B21B6");
      setFg((s.foreground_color as string) ?? "#FFFFFF");
      setLabel((s.label_color as string) ?? "#E9D5FF");
      setFrontText((s.front_text as string) ?? "");
      setBackText((s.back_text as string) ?? "");
      setCustomMessage((s.custom_message as string) ?? "");
      setShowQr(s.show_qr !== false);
      setShowBarcode(!!s.show_barcode);
      setValidity(s.validity_days == null ? "" : String(s.validity_days));
      if (s.fields) setFields({ ...fields, ...(s.fields as Record<FieldKey, boolean>) });
    } else {
      setBg(cfg.data.defaults.primary_color || "#5B21B6");
      setLogoUrl(cfg.data.defaults.logo_url ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.data]);

  const saving = useMutation({
    mutationFn: () =>
      save({
        data: {
          establishment_id: estId!,
          google_enabled: googleEnabled,
          apple_enabled: appleEnabled,
          logo_url: logoUrl || null,
          hero_image_url: heroUrl || null,
          background_color: bg,
          foreground_color: fg,
          label_color: label,
          front_text: frontText || null,
          back_text: backText || null,
          custom_message: customMessage || null,
          show_qr: showQr,
          show_barcode: showBarcode,
          barcode_format: "QR_CODE" as const,
          fields,
          validity_days: validity === "" ? null : Number(validity),
        },
      }),
    onSuccess: () => {
      toast.success("Carteira digital atualizada!");
      qc.invalidateQueries({ queryKey: ["wallet-settings", estId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  const resyncing = useMutation({
    mutationFn: () => resync({ data: { establishment_id: estId!, origin: window.location.origin } }),
    onSuccess: (r) => toast.success(`${r.total} cartão(ões) reenviado(s) para as carteiras.`),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao ressincronizar"),
  });

  const ready = cfg.data?.serverReady;

  return (
    <div className="space-y-6">
      <PageHero
        icon={Wallet}
        title="Carteira digital"
        subtitle="Personalize o cartão que seus clientes salvam no Google Wallet e no Apple Wallet. Carimbos e nível são atualizados automaticamente."
      />

      {cfg.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {cfg.data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Cartões ativos</CardTitle></CardHeader>
              <CardContent><div className="metric-number">{cfg.data.activePasses}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Smartphone className="h-4 w-4" /> Google Wallet</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {ready?.google
                  ? <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" /> Pronto</span>
                  : <span className="flex items-center gap-1 text-muted-foreground"><AlertTriangle className="h-4 w-4" /> Aguardando credenciais</span>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Apple className="h-4 w-4" /> Apple Wallet</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {ready?.apple
                  ? <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" /> Pronto</span>
                  : <span className="flex items-center gap-1 text-muted-foreground"><AlertTriangle className="h-4 w-4" /> Aguardando certificado</span>}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Disponibilidade</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="g">Oferecer Google Wallet</Label>
                    <Switch id="g" checked={googleEnabled} onCheckedChange={setGoogleEnabled} />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="a">Oferecer Apple Wallet</Label>
                    <Switch id="a" checked={appleEnabled} onCheckedChange={setAppleEnabled} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Marca e cores</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div><Label>Fundo</Label><Input type="color" value={bg} onChange={(e) => setBg(e.target.value)} /></div>
                    <div><Label>Texto</Label><Input type="color" value={fg} onChange={(e) => setFg(e.target.value)} /></div>
                    <div><Label>Rótulos</Label><Input type="color" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
                  </div>
                  <div>
                    <Label htmlFor="logo">URL do logo (quadrado)</Label>
                    <Input id="logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
                  </div>
                  <div>
                    <Label htmlFor="hero">URL da imagem de capa (opcional)</Label>
                    <Input id="hero" value={heroUrl} onChange={(e) => setHeroUrl(e.target.value)} placeholder="https://…" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Textos</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="ft">Frase na frente do cartão</Label>
                    <Input id="ft" maxLength={120} value={frontText} onChange={(e) => setFrontText(e.target.value)} placeholder="Seu cartão fidelidade" />
                  </div>
                  <div>
                    <Label htmlFor="cm">Mensagem promocional</Label>
                    <Input id="cm" maxLength={500} value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} placeholder="Complete e ganhe um brinde!" />
                  </div>
                  <div>
                    <Label htmlFor="bt">Regras / verso do cartão</Label>
                    <Textarea id="bt" maxLength={1000} rows={4} value={backText} onChange={(e) => setBackText(e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Campos exibidos</CardTitle></CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(FIELD_LABELS) as FieldKey[]).map((k) => (
                    <div key={k} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
                      <Label htmlFor={`f-${k}`} className="text-sm">{FIELD_LABELS[k]}</Label>
                      <Switch id={`f-${k}`} checked={fields[k]} onCheckedChange={(v) => setFields({ ...fields, [k]: v })} />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Código e validade</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="qr">Mostrar QR Code no cartão</Label>
                    <Switch id="qr" checked={showQr} onCheckedChange={setShowQr} />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="bc">Mostrar código de barras</Label>
                    <Switch id="bc" checked={showBarcode} onCheckedChange={setShowBarcode} />
                  </div>
                  <div>
                    <Label htmlFor="vd">Validade do cartão (dias, vazio = sem validade)</Label>
                    <Input id="vd" type="number" min={0} max={3650} value={validity} onChange={(e) => setValidity(e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => saving.mutate()} disabled={saving.isPending || !estId}>
                  {saving.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar alterações
                </Button>
                <Button variant="outline" onClick={() => resyncing.mutate()} disabled={resyncing.isPending || !estId}>
                  {resyncing.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Atualizar cartões já salvos
                </Button>
              </div>
            </div>

            {/* Prévia */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border p-4">
                <p className="mb-3 text-xs font-medium text-muted-foreground">Prévia do cartão</p>
                <div className="rounded-2xl p-4 shadow-lg" style={{ background: bg, color: fg }}>
                  <div className="flex items-center gap-3">
                    {logoUrl
                      ? <img src={logoUrl} alt="Logo do estabelecimento" className="h-10 w-10 rounded-lg object-cover" loading="lazy" />
                      : <div className="h-10 w-10 rounded-lg bg-white/20" />}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{est?.name ?? "Seu negócio"}</div>
                      <div className="truncate text-[11px]" style={{ color: label }}>
                        {frontText || "Cartão fidelidade"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    {fields.stamps && (
                      <div><div className="text-[10px] uppercase" style={{ color: label }}>Carimbos</div><div className="font-semibold">7 / 10</div></div>
                    )}
                    {fields.tier && (
                      <div><div className="text-[10px] uppercase" style={{ color: label }}>Nível</div><div className="font-semibold">Ouro</div></div>
                    )}
                    {fields.points && (
                      <div><div className="text-[10px] uppercase" style={{ color: label }}>Visitas</div><div className="font-semibold">23</div></div>
                    )}
                    {fields.code && (
                      <div><div className="text-[10px] uppercase" style={{ color: label }}>Código</div><div className="font-semibold">FD-8241</div></div>
                    )}
                  </div>
                  {customMessage && <p className="mt-4 text-xs opacity-90">{customMessage}</p>}
                  {showQr && (
                    <div className="mt-4 flex justify-center">
                      <div className="h-24 w-24 rounded-lg bg-white p-1">
                        <div className="h-full w-full rounded bg-[repeating-linear-gradient(45deg,#000_0_4px,#fff_4px_8px)]" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
