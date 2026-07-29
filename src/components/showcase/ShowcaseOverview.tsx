import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  UtensilsCrossed, LayoutList, FolderTree, Video, Eye, Store,
  Copy, ExternalLink, CheckCircle2, Circle, Sparkles, QrCode, Palette, ArrowRight, Wand2,
} from "lucide-react";

import { getMyEstablishments } from "@/lib/loyalty.functions";
import { getMyMenuOverview, setMenuStatus } from "@/lib/menu.functions";
import { PageHero } from "@/components/PageHero";
import { ConfigureQrButton } from "@/components/merchant/ConfigureQrButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { showcase, type ShowcaseKind } from "@/lib/showcase";
import { AiImportDialog } from "@/components/showcase/AiImportDialog";
import { AnalyzeShowcasePanel } from "@/components/showcase/AnalyzeShowcasePanel";
import { useMyFeature } from "@/hooks/useMyFeature";

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  draft:     { label: "Rascunho",  tone: "bg-muted text-muted-foreground" },
  published: { label: "Publicado", tone: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  paused:    { label: "Pausado",   tone: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
};

/** Visão geral compartilhada pelo Cardápio Virtual e pelo Catálogo Digital. */
export function ShowcaseOverview({ kind }: { kind: ShowcaseKind }) {
  const L = showcase(kind);
  const isCatalog = kind === "catalog";
  const qc = useQueryClient();
  const fetchEsts = useServerFn(getMyEstablishments);
  const fetchOverview = useServerFn(getMyMenuOverview);
  const mutateStatus = useServerFn(setMenuStatus);

  const ests = useQuery({ queryKey: ["my-establishments"], queryFn: () => fetchEsts() });
  const est = ests.data?.[0]?.establishment;
  const estId = est?.id;

  const overview = useQuery({
    queryKey: ["menu-overview", estId, kind],
    queryFn: () => fetchOverview({ data: { establishment_id: estId!, kind } }),
    enabled: !!estId,
  });

  const statusMut = useMutation({
    mutationFn: (status: "draft" | "published" | "paused") =>
      mutateStatus({ data: { establishment_id: estId!, status, kind } }),
    onSuccess: () => {
      toast.success(`Status do ${isCatalog ? "catálogo" : "cardápio"} atualizado`);
      qc.invalidateQueries({ queryKey: ["menu-overview", estId, kind] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const menu = overview.data?.menu;
  const counts = overview.data?.counts;
  const status = menu?.status ?? "draft";
  const publicUrl = est?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${L.publicBase}/${est.slug}`
    : "";

  const checklist = useMemo(() => [
    { key: "info",   label: isCatalog ? "Informações da loja" : "Informações do restaurante", done: !!(menu?.display_name || est?.name) },
    { key: "brand",  label: "Identidade visual configurada",  done: !!(menu?.logo_url || menu?.cover_url || (menu?.theme && Object.keys(menu.theme as object).length > 0)) },
    { key: "cat",    label: `Primeira ${L.category.toLowerCase()} criada`, done: (counts?.categories ?? 0) > 0 },
    { key: "item",   label: `Primeiro ${L.itemLower} criado`,  done: (counts?.items ?? 0) > 0 },
    { key: "media",  label: "Imagem enviada",                  done: (counts?.videos ?? 0) > 0 || (counts?.items ?? 0) > 0 },
    { key: "qr",     label: "QR Code gerado",                  done: !!publicUrl && status === "published" },
    { key: "pub",    label: `${isCatalog ? "Catálogo" : "Cardápio"} publicado`, done: status === "published" },
  ], [menu, counts, status, publicUrl, est?.name, isCatalog, L]);

  const done = checklist.filter(c => c.done).length;
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const [importOpen, setImportOpen] = useState(false);
  const aiFeature = useMyFeature(estId, isCatalog ? "catalog.ai" : "menu.ai");

  return (
    <div className="space-y-6">
      <PageHero
        icon={isCatalog ? Store : UtensilsCrossed}
        eyebrow="Vitrine digital"
        title={L.module}
        subtitle={isCatalog
          ? "Monte um catálogo digital para sua loja com fotos, coleções, preço, SKU e link de compra — QR Code próprio e analytics dedicado, 100% integrado ao Fidelize."
          : "Monte um cardápio digital em Stories ou Lista, com vídeos verticais, QR Code próprio e analytics dedicado — 100% integrado ao seu ecossistema Fidelize."}
      />

      <div className="flex flex-wrap gap-2">
        <ConfigureQrButton dest={isCatalog ? "catalog" : "menu"} />
        {aiFeature.allowed && estId && (
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Wand2 className="mr-2 h-4 w-4" />
            Importar {isCatalog ? "catálogo" : "cardápio"} com IA
          </Button>
        )}
      </div>

      {estId && (
        <AiImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          establishmentId={estId}
          kind={kind}
          onImported={() => qc.invalidateQueries({ queryKey: ["menu-overview", estId, kind] })}
        />
      )}


      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard icon={FolderTree} label={L.categories} value={counts?.categories ?? 0} />
        <MetricCard icon={LayoutList} label={L.items}      value={counts?.items ?? 0} />
        <MetricCard icon={Video}      label="Com vídeo"    value={counts?.videos ?? 0} />
        <MetricCard
          icon={Eye}
          label="Acessos (7d)"
          value={counts?.recent7d ?? 0}
          hint={
            (counts?.recent7d ?? 0) === 0
              ? "Ainda sem acessos: a contagem começa quando alguém abre o link público ou escaneia o QR."
              : "Aberturas da vitrine pública nos últimos 7 dias (link ou QR)."
          }
          linkTo="/app/analytics"
          linkLabel="Ver no Analytics"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                Status {isCatalog ? "do catálogo" : "do cardápio"}
                <Badge variant="outline" className={STATUS_LABEL[status]?.tone}>
                  {STATUS_LABEL[status]?.label ?? status}
                </Badge>
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Só vitrines <b>publicadas</b> ficam visíveis para o consumidor. Você pode pausar a qualquer momento sem apagar nada.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => statusMut.mutate("published")}
                disabled={statusMut.isPending || status === "published"}
              >
                <Sparkles className="mr-2 h-4 w-4" /> Publicar
              </Button>
              <Button
                variant="outline"
                onClick={() => statusMut.mutate("paused")}
                disabled={statusMut.isPending || status !== "published"}
              >
                Pausar
              </Button>
              <Button
                variant="ghost"
                onClick={() => statusMut.mutate("draft")}
                disabled={statusMut.isPending || status === "draft"}
              >
                Voltar para rascunho
              </Button>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Link público</div>
                  <div className="mt-1 truncate font-mono text-sm">
                    {publicUrl || "Configure o slug do estabelecimento primeiro"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={copyLink} disabled={!publicUrl}>
                    <Copy className="mr-2 h-4 w-4" /> {copied ? "Copiado" : "Copiar"}
                  </Button>
                  <Button asChild size="sm" disabled={!publicUrl || status !== "published"}>
                    <a href={publicUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" /> Visualizar
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              Checklist
              <span className="text-sm font-normal text-muted-foreground">{done}/{checklist.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {checklist.map(item => (
              <div key={item.key} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-muted/60">
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                )}
                <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximas etapas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StepCard
            title={L.categories}
            description={isCatalog
              ? "Organize sua loja em coleções com imagem de capa."
              : "Organize seu cardápio por seções com imagem de capa."}
            icon={FolderTree}
            to={L.categoriesPath}
          />
          <StepCard
            title={L.items}
            description={isCatalog
              ? "Cadastre produtos com foto, preço, SKU, marca e link de compra."
              : "Cadastre pratos com foto ou vídeo vertical estilo Stories."}
            icon={LayoutList}
            to={L.itemsPath}
          />
          <StepCard
            title="Aparência da vitrine"
            description="Escolha tema de cores, fundo e layout com prévia ao vivo."
            icon={Palette}
            to={L.appearancePath}
          />
          <StepCard
            title="QR Code"
            description="Gere QR próprio para balcão, vitrine ou material impresso."
            icon={QrCode}
            to="/app/qr"
          />
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Dica: em <b>Aparência da vitrine</b> você troca o tema, o fundo e o layout em segundos.
      </p>
    </div>
  );
}

function MetricCard({
  icon: Icon, label, value, hint, linkTo, linkLabel,
}: { icon: any; label: string; value: number; hint?: string; linkTo?: string; linkLabel?: string }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 py-6">
        <div className="card-icon">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="metric-number mt-1 text-2xl font-bold">{value}</div>
          {hint && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
          {linkTo && (
            <Link
              to={linkTo as any}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {linkLabel ?? "Ver mais"} <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StepCard({ icon: Icon, title, description, to, disabled }: { icon: any; title: string; description: string; to: string; disabled?: boolean }) {
  const inner = (
    <div className={`group flex h-full flex-col gap-2 rounded-2xl border border-border/60 bg-card/40 p-4 transition ${disabled ? "opacity-60" : "cursor-pointer hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/5 hover:shadow-lg"}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
        {disabled
          ? <Badge variant="outline" className="ml-auto text-[10px]">em breve</Badge>
          : <ArrowRight className="ml-auto h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" />}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      {!disabled && (
        <span className="mt-auto pt-2 text-xs font-medium text-primary underline underline-offset-4">
          Abrir
        </span>
      )}
    </div>
  );
  if (disabled) return inner;
  return <Link to={to as any} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl">{inner}</Link>;
}
