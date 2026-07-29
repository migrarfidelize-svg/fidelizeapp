import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sparkles, Loader2, CheckCircle2, XCircle, Pencil, Wand2, AlertTriangle, RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  analyzeShowcase, getLatestAnalysis, updateFindingState, applyItemDescription,
} from "@/lib/ai-menu.functions";
import type { ShowcaseKind } from "@/lib/showcase";

type Priority = "low" | "medium" | "high" | "critical";
type Finding = {
  key: string;
  type: string;
  priority: Priority;
  title: string;
  target_type: "item" | "category" | "menu";
  target_id: string | null;
  target_label: string;
  problem: string;
  recommendation: string;
  suggested_payload: string | null;
};

const PRIORITY_STYLE: Record<Priority, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high:     "bg-orange-500/15 text-orange-500 border-orange-500/30",
  medium:   "bg-amber-500/15 text-amber-600 border-amber-500/30",
  low:      "bg-muted text-muted-foreground border-border",
};

const SCORE_LABELS: Record<string, string> = {
  images: "Imagens",
  descriptions: "Descrições",
  organization: "Organização",
  product_info: "Informações",
  conversion: "Conversão",
  combos: "Combos",
  experience: "Experiência",
};

function scoreColor(v: number) {
  if (v >= 80) return "text-emerald-500";
  if (v >= 60) return "text-amber-500";
  if (v >= 40) return "text-orange-500";
  return "text-destructive";
}

export function AnalyzeShowcasePanel({
  establishmentId,
  kind,
}: {
  establishmentId: string;
  kind: ShowcaseKind;
}) {
  const qc = useQueryClient();
  const surface = kind;
  const isCatalog = kind === "catalog";

  const analyzeFn = useServerFn(analyzeShowcase);
  const latestFn = useServerFn(getLatestAnalysis);
  const stateFn = useServerFn(updateFindingState);
  const applyDescFn = useServerFn(applyItemDescription);

  const latest = useQuery({
    queryKey: ["ai-analysis-latest", establishmentId, surface],
    queryFn: () => latestFn({ data: { establishment_id: establishmentId, surface } }),
    enabled: !!establishmentId,
    staleTime: 30_000,
  });

  const analyze = useMutation({
    mutationFn: () => analyzeFn({ data: { establishment_id: establishmentId, surface } }),
    onSuccess: () => {
      toast.success("Análise concluída");
      qc.invalidateQueries({ queryKey: ["ai-analysis-latest", establishmentId, surface] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const analysis: any = latest.data;
  const analysisId: string | undefined = analysis?.id;
  const findings: Finding[] = (analysis?.findings_json as Finding[]) ?? [];
  const findingStates: Record<string, string> = analysis?.finding_states ?? {};
  const scores: Record<string, number> = analysis?.scores_json ?? {};
  const overall: number = analysis?.overall_score ?? 0;

  const openFindings = findings.filter(f => !findingStates[f.key] || findingStates[f.key] === "open");
  const resolved = findings.length - openFindings.length;

  const [editing, setEditing] = useState<{ finding: Finding; text: string } | null>(null);

  const setState = useMutation({
    mutationFn: (p: { finding_key: string; status: "applied" | "ignored" | "edited"; payload?: unknown }) =>
      stateFn({ data: { analysis_id: analysisId!, finding_key: p.finding_key, status: p.status, applied_payload: p.payload } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-analysis-latest", establishmentId, surface] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const applyFinding = useMutation({
    mutationFn: async (p: { finding: Finding; text: string; edited: boolean }) => {
      if (p.finding.target_type === "item" && p.finding.target_id) {
        await applyDescFn({ data: { item_id: p.finding.target_id, description: p.text } });
      }
      await stateFn({
        data: {
          analysis_id: analysisId!,
          finding_key: p.finding.key,
          status: p.edited ? "edited" : "applied",
          applied_payload: p.text,
        },
      });
    },
    onSuccess: () => {
      toast.success("Sugestão aplicada");
      qc.invalidateQueries({ queryKey: ["ai-analysis-latest", establishmentId, surface] });
      qc.invalidateQueries({ queryKey: ["menu-items"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            Analisar {isCatalog ? "catálogo" : "cardápio"} com IA
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Diagnóstico completo com nota geral, categorias avaliadas e sugestões acionáveis (aplicar, editar antes de aplicar ou ignorar).
          </p>
        </div>
        <Button onClick={() => analyze.mutate()} disabled={analyze.isPending}>
          {analyze.isPending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando...</>
            : analysis
              ? <><RefreshCw className="mr-2 h-4 w-4" /> Reanalisar</>
              : <><Sparkles className="mr-2 h-4 w-4" /> Analisar agora</>}
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {latest.isLoading ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !analysis ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            Nenhuma análise ainda. Clique em <b>Analisar agora</b> para receber uma avaliação completa da sua vitrine.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-muted/30 px-6 py-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Nota geral</div>
                <div className={`metric-number text-4xl font-bold ${scoreColor(overall)}`}>{overall}</div>
                <div className="text-xs text-muted-foreground">de 100</div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {Object.entries(SCORE_LABELS).map(([k, label]) => {
                  const v = Number(scores?.[k] ?? 0);
                  return (
                    <div key={k} className="rounded-xl border border-border/60 bg-card/40 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
                      <div className={`text-lg font-semibold ${scoreColor(v)}`}>{v}<span className="text-xs text-muted-foreground">/100</span></div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="outline" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {openFindings.length} em aberto
              </Badge>
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {resolved} resolvidos
              </Badge>
              <span className="text-xs text-muted-foreground">
                Última análise: {analysis?.created_at ? new Date(analysis.created_at).toLocaleString("pt-BR") : "—"}
              </span>
            </div>

            {findings.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-600">
                Nenhum problema identificado. Excelente!
              </div>
            ) : (
              <div className="space-y-3">
                {findings.map((f) => {
                  const status = findingStates[f.key] ?? "open";
                  const done = status !== "open";
                  const canApplyText = f.target_type === "item" && !!f.target_id && !!f.suggested_payload;
                  return (
                    <div
                      key={f.key}
                      className={`rounded-2xl border p-4 transition ${done ? "border-border/40 bg-muted/20 opacity-70" : "border-border/60 bg-card/40"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={PRIORITY_STYLE[f.priority]}>
                              {f.priority}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">{f.target_type}</Badge>
                            <span className="text-xs text-muted-foreground truncate">{f.target_label}</span>
                            {done && (
                              <Badge variant="outline" className="gap-1 text-[10px]">
                                {status === "ignored"
                                  ? <><XCircle className="h-3 w-3" /> ignorado</>
                                  : <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> {status}</>}
                              </Badge>
                            )}
                          </div>
                          <h4 className="mt-2 text-sm font-semibold">{f.title}</h4>
                          <p className="mt-1 text-sm text-muted-foreground">{f.problem}</p>
                          <p className="mt-2 text-sm"><b>Recomendação:</b> {f.recommendation}</p>
                          {f.suggested_payload && (
                            <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-2 text-sm">
                              <div className="text-[10px] uppercase tracking-wider text-primary">Sugestão</div>
                              <div className="mt-1 whitespace-pre-wrap">{f.suggested_payload}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {!done && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => canApplyText
                              ? applyFinding.mutate({ finding: f, text: f.suggested_payload!, edited: false })
                              : setState.mutate({ finding_key: f.key, status: "applied" })}
                            disabled={applyFinding.isPending || setState.isPending}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Aplicar
                          </Button>
                          {canApplyText && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditing({ finding: f, text: f.suggested_payload ?? "" })}
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Editar antes de aplicar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setState.mutate({ finding_key: f.key, status: "ignored" })}
                            disabled={setState.isPending}
                          >
                            <XCircle className="mr-2 h-4 w-4" /> Ignorar
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar sugestão antes de aplicar</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">{editing.finding.target_label}</div>
              <Textarea
                value={editing.text}
                onChange={(e) => setEditing({ ...editing, text: e.target.value.slice(0, 240) })}
                rows={5}
                maxLength={240}
              />
              <p className="text-right text-[11px] text-muted-foreground">{editing.text.length}/240</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              onClick={() => editing && applyFinding.mutate({ finding: editing.finding, text: editing.text, edited: true })}
              disabled={!editing?.text.trim() || applyFinding.isPending}
            >
              {applyFinding.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Aplicar edição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
