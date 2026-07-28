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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
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

const FEATURE_GROUPS: { group: string; items: { key: string; label: string }[] }[] = [
  {
    group: "Vitrines digitais",
    items: [
      { key: "digital_menu", label: "Cardápio digital (vitrine + QR)" },
      { key: "digital_catalog", label: "Catálogo digital" },
      { key: "qr_generator", label: "Gerador de QR Code / material impresso" },
      { key: "qrcode", label: "QR Code" },
    ],
  },
  {
    group: "Fidelidade",
    items: [
      { key: "loyalty_card", label: "Cartão fidelidade digital" },
      { key: "loyalty_cards", label: "Cartões de fidelidade digitais" },
      { key: "stamps", label: "Carimbos" },
      { key: "rewards", label: "Recompensas" },
      { key: "custom_stamp_icons", label: "Ícones de carimbo personalizados" },
    ],
  },
  {
    group: "Clientes & CRM",
    items: [
      { key: "customers", label: "Clientes ilimitados" },
      { key: "customer_crm", label: "CRM de clientes" },
      { key: "customer_segments", label: "Segmentação avançada" },
      { key: "customer_import", label: "Importação de clientes (CSV)" },
      { key: "customer_export", label: "Exportação de clientes" },
    ],
  },
  {
    group: "Campanhas & Comunicação",
    items: [
      { key: "campaigns", label: "Campanhas ilimitadas" },
      { key: "auto_campaigns", label: "Campanhas automáticas" },
      { key: "push_notifications", label: "Notificações push" },
      { key: "email_notifications", label: "Notificações por e-mail" },
      { key: "email_marketing", label: "E-mail marketing" },
      { key: "whatsapp_notifications", label: "Notificações via WhatsApp" },
    ],
  },
  {
    group: "Avaliações",
    items: [
      { key: "public_reviews", label: "Avaliações públicas (QR + página)" },
      { key: "reviews", label: "Avaliações de atendimento" },
      { key: "reviews_public_page", label: "Página pública de avaliações" },
      { key: "reviews_nps", label: "NPS" },
      { key: "reviews_categories", label: "Categorias de avaliação" },
      { key: "reviews_reply", label: "Responder avaliações" },
      { key: "reviews_google", label: "Redirecionar para Google Reviews" },
      { key: "reviews_export", label: "Exportar avaliações" },
    ],
  },
  {
    group: "Relatórios & Dados",
    items: [
      { key: "dashboard", label: "Dashboard básico" },
      { key: "dashboard_realtime", label: "Dashboard em tempo real" },
      { key: "reports", label: "Relatórios" },
      { key: "advanced_reports", label: "Relatórios avançados" },
      { key: "export", label: "Exportação de dados" },
      { key: "csv_pdf_export", label: "Exportação CSV / PDF" },
      { key: "history", label: "Histórico completo" },
      { key: "audit", label: "Auditoria" },
    ],
  },
  {
    group: "Marca & Personalização",
    items: [
      { key: "branding", label: "Personalização da identidade visual" },
      { key: "custom_branding", label: "Marca e cores personalizadas" },
      { key: "remove_branding", label: "Remover marca Fidelize" },
      { key: "custom_domain", label: "Domínio personalizado" },
    ],
  },
  {
    group: "Equipe & Unidades",
    items: [
      { key: "employees", label: "Funcionários ilimitados" },
      { key: "custom_permissions", label: "Permissões personalizadas" },
      { key: "multi_units", label: "Múltiplas unidades" },
      { key: "multi_unit", label: "Multi-unidades / filiais" },
    ],
  },
  {
    group: "Integrações & API",
    items: [
      { key: "api", label: "Acesso à API" },
      { key: "webhooks", label: "Webhooks" },
      { key: "integrations", label: "Integrações" },
    ],
  },
  {
    group: "Suporte",
    items: [
      { key: "support_email", label: "Suporte por e-mail" },
      { key: "support_ticket", label: "Suporte por ticket" },
      { key: "support_priority", label: "Suporte prioritário" },
      { key: "priority_support", label: "Suporte prioritário (legado)" },
      { key: "support_dedicated", label: "Gerente de conta dedicado" },
      { key: "knowledge_base", label: "Base de conhecimento" },
    ],
  },
];

const FEATURES = FEATURE_GROUPS.flatMap((g) => g.items);

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
              <SelectContent className="max-h-[320px]">
                {FEATURE_GROUPS.map((g) => (
                  <SelectGroup key={g.group}>
                    <SelectLabel>{g.group}</SelectLabel>
                    {g.items.map((f) => (
                      <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                    ))}
                  </SelectGroup>
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
