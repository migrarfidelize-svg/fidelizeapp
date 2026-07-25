import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  UtensilsCrossed, LayoutList, FolderTree, Video, Eye,
  Copy, ExternalLink, CheckCircle2, Circle, Sparkles, QrCode,
} from "lucide-react";

import { getMyEstablishments } from "@/lib/loyalty.functions";
import { getMyMenuOverview, setMenuStatus } from "@/lib/menu.functions";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/cardapio/")({
  head: () => ({
    meta: [
      { title: "Cardápio Virtual — Fidelize" },
      { name: "description", content: "Crie um cardápio digital moderno em Stories ou Lista para o seu restaurante." },
    ],
  }),
  component: CardapioOverview,
});

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  draft:     { label: "Rascunho",  tone: "bg-muted text-muted-foreground" },
  published: { label: "Publicado", tone: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  paused:    { label: "Pausado",   tone: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
};

function CardapioOverview() {
  const qc = useQueryClient();
  const fetchEsts = useServerFn(getMyEstablishments);
  const fetchOverview = useServerFn(getMyMenuOverview);
  const mutateStatus = useServerFn(setMenuStatus);

  const ests = useQuery({ queryKey: ["my-establishments"], queryFn: () => fetchEsts() });
  const est = ests.data?.[0]?.establishment;
  const estId = est?.id;

  const overview = useQuery({
    queryKey: ["menu-overview", estId],
    queryFn: () => fetchOverview({ data: { establishment_id: estId! } }),
    enabled: !!estId,
  });

  const statusMut = useMutation({
    mutationFn: (status: "draft" | "published" | "paused") =>
      mutateStatus({ data: { establishment_id: estId!, status } }),
    onSuccess: () => {
      toast.success("Status do cardápio atualizado");
      qc.invalidateQueries({ queryKey: ["menu-overview", estId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const menu = overview.data?.menu;
  const counts = overview.data?.counts;
  const status = menu?.status ?? "draft";
  const publicUrl = est?.slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/cardapio/${est.slug}` : "";

  const checklist = useMemo(() => [
    { key: "info",   label: "Informações do restaurante",     done: !!(menu?.display_name || est?.name) },
    { key: "brand",  label: "Identidade visual configurada",  done: !!(menu?.logo_url || menu?.cover_url) },
    { key: "cat",    label: "Primeira categoria criada",      done: (counts?.categories ?? 0) > 0 },
    { key: "item",   label: "Primeiro prato criado",          done: (counts?.items ?? 0) > 0 },
    { key: "media",  label: "Imagem ou vídeo enviado",        done: (counts?.videos ?? 0) > 0 || (counts?.items ?? 0) > 0 },
    { key: "qr",     label: "QR Code do cardápio gerado",     done: !!publicUrl && status === "published" },
    { key: "pub",    label: "Cardápio publicado",             done: status === "published" },
  ], [menu, counts, status, publicUrl, est?.name]);

  const done = checklist.filter(c => c.done).length;
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHero
        icon={UtensilsCrossed}
        eyebrow="Novo módulo"
        title="Cardápio Virtual"
        subtitle="Monte um cardápio digital em Stories ou Lista, com vídeos verticais, QR Code próprio e analytics dedicado — 100% integrado ao seu ecossistema Fidelize."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard icon={FolderTree} label="Categorias"     value={counts?.categories ?? 0} />
        <MetricCard icon={LayoutList} label="Pratos"         value={counts?.items ?? 0} />
        <MetricCard icon={Video}      label="Com vídeo"      value={counts?.videos ?? 0} />
        <MetricCard icon={Eye}        label="Acessos (7d)"   value={counts?.recent7d ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                Status do cardápio
                <Badge variant="outline" className={STATUS_LABEL[status]?.tone}>
                  {STATUS_LABEL[status]?.label ?? status}
                </Badge>
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Só cardápios <b>publicados</b> ficam visíveis para o consumidor. Você pode pausar a qualquer momento sem apagar nada.
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
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StepCard title="Categorias" description="Organize seu cardápio por seções com imagem de capa." icon={FolderTree} to="/app/cardapio/categorias" />
          <StepCard title="Pratos" description="Cadastre pratos com foto ou vídeo vertical estilo Stories." icon={LayoutList} to="/app/cardapio/pratos" />
          <StepCard title="QR Code do Cardápio" description="Gere QR próprio para mesa, balcão ou suporte de guardanapo." icon={QrCode} to="/app/qr" />
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Personalização visual, modo Stories e QR próprio chegam nas próximas atualizações.
      </p>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-6">
        <div className="card-icon">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="metric-number mt-1 text-2xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StepCard({ icon: Icon, title, description, to, disabled }: { icon: any; title: string; description: string; to: string; disabled?: boolean }) {
  const inner = (
    <div className={`flex h-full flex-col gap-2 rounded-2xl border border-border/60 p-4 transition ${disabled ? "opacity-60" : "hover:border-primary/60 hover:bg-primary/5"}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
        {disabled && <Badge variant="outline" className="ml-auto text-[10px]">em breve</Badge>}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
  if (disabled) return inner;
  return <Link to={to as any}>{inner}</Link>;
}
