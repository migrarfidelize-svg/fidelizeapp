import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListEstablishments } from "@/lib/admin.functions";
import {
  adminListFeatureOverrides,
  adminSetFeatureOverride,
  adminRemoveFeatureOverride,
} from "@/lib/feature-overrides.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { KeyRound, Trash2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/liberacoes")({
  component: FeatureOverridesPage,
  head: () => ({
    meta: [
      { title: "Liberações de recursos | Fidelize Admin" },
      { name: "description", content: "Libere recursos como o cardápio digital para empresas específicas, mesmo fora do plano." },
      { property: "og:title", content: "Liberações de recursos | Fidelize Admin" },
      { property: "og:description", content: "Controle manual de acesso a recursos por empresa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const FEATURES = [
  { key: "digital_menu", label: "Cardápio digital (acesso à área)" },
  { key: "public_reviews", label: "Avaliações públicas" },
  { key: "auto_campaigns", label: "Campanhas automáticas" },
  { key: "advanced_reports", label: "Relatórios avançados" },
];

function FeatureOverridesPage() {
  const qc = useQueryClient();
  const listEsts = useServerFn(adminListEstablishments);
  const listOverrides = useServerFn(adminListFeatureOverrides);
  const setOverride = useServerFn(adminSetFeatureOverride);
  const removeOverride = useServerFn(adminRemoveFeatureOverride);

  const [estId, setEstId] = useState("");
  const [featureKey, setFeatureKey] = useState("digital_menu");
  const [note, setNote] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: ests } = useQuery({
    queryKey: ["admin", "establishments", "overrides"],
    queryFn: () => listEsts({ data: {} }),
  });
  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin", "feature-overrides"],
    queryFn: () => listOverrides({ data: {} }),
  });

  const save = useMutation({
    mutationFn: (payload: any) => setOverride({ data: payload }),
    onSuccess: () => {
      toast.success("Liberação salva.");
      setNote(""); setExpiresAt("");
      qc.invalidateQueries({ queryKey: ["admin", "feature-overrides"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  const del = useMutation({
    mutationFn: (id: string) => removeOverride({ data: { id } }),
    onSuccess: () => {
      toast.success("Liberação removida.");
      qc.invalidateQueries({ queryKey: ["admin", "feature-overrides"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover."),
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <KeyRound className="h-6 w-6 text-primary" /> Liberações de recursos
        </h1>
        <p className="text-sm text-muted-foreground">
          Conceda acesso a um recurso para uma empresa específica mesmo que o plano dela não inclua.
          A <strong>publicação do cardápio</strong> continua exigindo upgrade de plano.
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-base">Nova liberação</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select value={estId} onValueChange={setEstId}>
              <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
              <SelectContent>
                {(ests ?? []).map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.name} · {e.plan}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Recurso</Label>
            <Select value={featureKey} onValueChange={setFeatureKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FEATURES.map((f) => (
                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: cortesia comercial / teste" />
          </div>
          <div className="space-y-2">
            <Label>Expira em (opcional)</Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button
              disabled={!estId || save.isPending}
              onClick={() => save.mutate({
                establishment_id: estId,
                feature_key: featureKey,
                enabled: true,
                note: note || null,
                expires_at: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
              })}
            >
              <ShieldCheck className="h-4 w-4 mr-2" /> Liberar acesso
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Liberações ativas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && !(rows ?? []).length && (
            <p className="text-sm text-muted-foreground">Nenhuma liberação manual cadastrada.</p>
          )}
          {(rows ?? []).map((r: any) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="flex-1 min-w-[200px]">
                <p className="font-medium">{r.establishments?.name ?? r.establishment_id}</p>
                <p className="text-xs text-muted-foreground">
                  {FEATURES.find((f) => f.key === r.feature_key)?.label ?? r.feature_key}
                  {r.expires_at ? ` · expira em ${new Date(r.expires_at).toLocaleDateString("pt-BR")}` : ""}
                  {r.note ? ` · ${r.note}` : ""}
                </p>
              </div>
              <Badge variant="outline">plano: {r.establishments?.plan ?? "—"}</Badge>
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!r.enabled}
                  onCheckedChange={(v) => save.mutate({
                    establishment_id: r.establishment_id,
                    feature_key: r.feature_key,
                    enabled: v,
                    note: r.note,
                    expires_at: r.expires_at,
                  })}
                />
                <Button variant="ghost" size="icon" onClick={() => del.mutate(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
