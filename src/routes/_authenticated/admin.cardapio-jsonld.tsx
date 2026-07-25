import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  adminListMenusForJsonLd,
  adminGetMenuJsonLd,
} from "@/lib/menu-jsonld.functions";
import {
  validateMenuJsonLd,
  summarizeFindings,
  type Finding,
} from "@/lib/menu-jsonld-validate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, ExternalLink, Copy, RefreshCw, CheckCircle2, AlertTriangle,
  XCircle, Info, ClipboardCheck, FileJson, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/cardapio-jsonld")({
  component: JsonLdAuditPage,
});

function JsonLdAuditPage() {
  const listFn = useServerFn(adminListMenusForJsonLd);
  const getFn = useServerFn(adminGetMenuJsonLd);
  const [q, setQ] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const listQ = useQuery({ queryKey: ["admin-menu-jsonld-list"], queryFn: () => listFn() });

  const detailQ = useQuery({
    queryKey: ["admin-menu-jsonld-detail", selectedSlug],
    queryFn: () => getFn({ data: { slug: selectedSlug! } }),
    enabled: !!selectedSlug,
  });

  const findings: Finding[] = useMemo(
    () => (detailQ.data ? validateMenuJsonLd(detailQ.data.jsonLd) : []),
    [detailQ.data],
  );
  const summary = useMemo(() => summarizeFindings(findings), [findings]);

  const filtered = useMemo(() => {
    const rows = listQ.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r: any) =>
      r.establishment_name.toLowerCase().includes(term) || r.slug.toLowerCase().includes(term),
    );
  }, [listQ.data, q]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-primary">
          <FileJson className="h-5 w-5" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">SEO / Structured Data</span>
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Validador de JSON-LD dos cardápios</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Inspecione e valide o structured data <code className="text-xs">Restaurant / Menu</code> renderizado em cada
          <code className="text-xs"> /cardapio/&lt;slug&gt;</code>. Cobre os erros mais comuns do Google Rich Results
          Test (preço, moeda, imagem absoluta, seções vazias, endereço, tamanho do payload).
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* List */}
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou slug…" className="pl-8" />
              </div>
              <Button size="icon" variant="ghost" onClick={() => listQ.refetch()} aria-label="Atualizar">
                <RefreshCw className={`h-4 w-4 ${listQ.isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <div className="text-[11px] text-muted-foreground px-1">
              {listQ.isLoading ? "Carregando…" : `${filtered.length} cardápio(s)`}
            </div>
            <div className="max-h-[70vh] overflow-y-auto -mx-1 pr-1 space-y-1">
              {filtered.map((m: any) => {
                const active = selectedSlug === m.slug;
                return (
                  <button
                    key={m.menu_id}
                    onClick={() => setSelectedSlug(m.slug)}
                    className={[
                      "w-full text-left rounded-lg border px-3 py-2.5 transition-all",
                      active
                        ? "border-primary/60 bg-primary-soft"
                        : "border-border/60 hover:bg-muted/50",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm font-medium truncate">{m.establishment_name}</span>
                      <StatusBadge status={m.status} />
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-2">
                      <span>/cardapio/{m.slug}</span>
                      <span>·</span>
                      <span>{m.categories} cat.</span>
                      <span>·</span>
                      <span>{m.items} itens</span>
                    </div>
                  </button>
                );
              })}
              {!listQ.isLoading && !filtered.length && (
                <div className="text-xs text-muted-foreground text-center py-8">Nenhum cardápio encontrado.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detail */}
        <div className="space-y-4">
          {!selectedSlug && (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                <Sparkles className="h-6 w-6 mx-auto mb-2 text-primary" />
                Selecione um cardápio à esquerda para inspecionar o JSON-LD e as validações.
              </CardContent>
            </Card>
          )}

          {selectedSlug && detailQ.isLoading && (
            <Card><CardContent className="p-8 text-sm text-muted-foreground">Carregando JSON-LD…</CardContent></Card>
          )}

          {selectedSlug && detailQ.error && (
            <Card><CardContent className="p-6 text-sm text-destructive">Erro: {(detailQ.error as Error).message}</CardContent></Card>
          )}

          {detailQ.data && (
            <>
              <Card>
                <CardContent className="p-4 md:p-5 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[220px]">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Cardápio</div>
                    <div className="font-semibold">{detailQ.data.meta.establishment_name}</div>
                    <div className="text-[11px] text-muted-foreground">/cardapio/{detailQ.data.meta.slug}</div>
                  </div>
                  <SummaryBadge label="Erros" value={summary.errors} tone="error" />
                  <SummaryBadge label="Avisos" value={summary.warnings} tone="warning" />
                  <SummaryBadge label="Info" value={summary.infos} tone="info" />
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${summary.valid ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600"}`}>
                    {summary.valid ? "Rich Result válido" : "Falha crítica"}
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <a href={detailQ.data.meta.public_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium underline">
                      Abrir <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(detailQ.data.meta.public_url)}`}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline"
                    >
                      Testar no Google <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ClipboardCheck className="h-4 w-4 text-primary" /> Diagnóstico
                    </div>
                    <span className="text-[11px] text-muted-foreground">{findings.length} verificação(ões)</span>
                  </div>
                  <div className="divide-y">
                    {findings.length === 0 && (
                      <div className="p-6 text-sm text-emerald-600 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" /> Nenhum problema detectado — Rich Result pronto para envio.
                      </div>
                    )}
                    {findings.map((f, i) => (
                      <FindingRow key={i} f={f} />
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <FileJson className="h-4 w-4 text-primary" /> JSON-LD renderizado
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(detailQ.data.jsonLd, null, 2));
                        toast.success("JSON-LD copiado.");
                      }}>
                        <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
                      </Button>
                    </div>
                  </div>
                  <pre className="text-[11px] leading-relaxed p-4 overflow-auto max-h-[520px] bg-muted/30 font-mono">
{JSON.stringify(detailQ.data.jsonLd, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    published: { label: "publicado", cls: "bg-emerald-500/15 text-emerald-600" },
    draft: { label: "rascunho", cls: "bg-amber-500/15 text-amber-600" },
    paused: { label: "pausado", cls: "bg-slate-500/15 text-slate-500" },
    no_menu: { label: "sem menu", cls: "bg-red-500/15 text-red-600" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-foreground" };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${m.cls}`}>{m.label}</span>;
}

function SummaryBadge({ label, value, tone }: { label: string; value: number; tone: "error" | "warning" | "info" }) {
  const cls =
    tone === "error" ? "bg-red-500/15 text-red-600" :
    tone === "warning" ? "bg-amber-500/15 text-amber-600" :
    "bg-sky-500/15 text-sky-600";
  return (
    <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${cls} flex items-center gap-2`}>
      <span>{value}</span>
      <span className="opacity-70 uppercase tracking-wider text-[10px]">{label}</span>
    </div>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const Icon = f.severity === "error" ? XCircle : f.severity === "warning" ? AlertTriangle : Info;
  const cls =
    f.severity === "error" ? "text-red-600" :
    f.severity === "warning" ? "text-amber-600" : "text-sky-600";
  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <Icon className={`h-4 w-4 mt-0.5 ${cls}`} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{f.message}</span>
          <Badge variant="outline" className="text-[10px]">{f.code}</Badge>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">{f.path}</div>
        {f.hint && <div className="text-[11px] text-muted-foreground mt-1">💡 {f.hint}</div>}
      </div>
    </div>
  );
}
