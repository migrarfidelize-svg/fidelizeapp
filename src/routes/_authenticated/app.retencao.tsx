import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { HeartHandshake as HeroIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Cake, TimerReset, Trophy, Share2 } from "lucide-react";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import {
  getRetentionSettings,
  saveRetentionSettings,
  listReferralStats,
} from "@/lib/retention.functions";

export const Route = createFileRoute("/_authenticated/app/retencao")({
  component: RetencaoPage,
});

function RetencaoPage() {
  const getEsts = useServerFn(getMyEstablishments);
  const getFn = useServerFn(getRetentionSettings);
  const saveFn = useServerFn(saveRetentionSettings);
  const statsFn = useServerFn(listReferralStats);

  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const activeEst = memberships?.[0]?.establishment as { id: string; name: string } | undefined;

  const { data: settings, refetch } = useQuery({
    queryKey: ["retention_settings", activeEst?.id],
    queryFn: () => getFn({ data: { establishment_id: activeEst!.id } }),
    enabled: !!activeEst?.id,
  });

  const { data: stats } = useQuery({
    queryKey: ["referral_stats", activeEst?.id],
    queryFn: () => statsFn({ data: { establishment_id: activeEst!.id } }),
    enabled: !!activeEst?.id,
  });

  type RetForm = {
    establishment_id: string;
    birthday_enabled: boolean;
    birthday_message: string;
    birthday_coupon_percent: number;
    reengagement_enabled: boolean;
    reengagement_days: number;
    reengagement_message: string;
    tiers_enabled: boolean;
    tier_thresholds: { bronze: number; prata: number; ouro: number; diamante: number };
    referral_enabled: boolean;
    referral_bonus_stamps: number;
  };
  const [form, setForm] = useState<RetForm | null>(null);
  useEffect(() => {
    if (settings) {
      const s = settings as unknown as RetForm;
      setForm({
        ...s,
        tier_thresholds: (s.tier_thresholds ?? {
          bronze: 0, prata: 10, ouro: 25, diamante: 50,
        }) as RetForm["tier_thresholds"],
      });
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form || !activeEst) return;
      await saveFn({
        data: {
          establishment_id: activeEst.id,
          birthday_enabled: !!form.birthday_enabled,
          birthday_message: form.birthday_message,
          birthday_coupon_percent: form.birthday_coupon_percent ?? 0,
          reengagement_enabled: !!form.reengagement_enabled,
          reengagement_days: form.reengagement_days ?? 30,
          reengagement_message: form.reengagement_message,
          tiers_enabled: !!form.tiers_enabled,
          tier_thresholds: (form.tier_thresholds ?? {
            bronze: 0,
            prata: 10,
            ouro: 25,
            diamante: 50,
          }) as { bronze: number; prata: number; ouro: number; diamante: number },
          referral_enabled: !!form.referral_enabled,
          referral_bonus_stamps: form.referral_bonus_stamps ?? 1,
        },
      });
    },
    onSuccess: () => {
      toast.success("Configurações salvas.");
      refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  if (!activeEst || !form) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const th = form.tier_thresholds as unknown as {
    bronze: number;
    prata: number;
    ouro: number;
    diamante: number;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <PageHero
        icon={HeroIcon}
        eyebrow={"Retenção · Automação"}
        title={"Régua de retenção"}
        subtitle={"Aniversário, reengajamento, níveis Bronze/Prata/Ouro e indicações."}
      />
      <header>
        <h1 className="text-2xl font-bold">Retenção automática</h1>
        <p className="text-sm text-muted-foreground">
          Automatize aniversários, reengajamento de clientes inativos, níveis de fidelidade e
          programa de indicação.
        </p>
      </header>

      {/* Aniversário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cake className="h-4 w-4" /> Aniversariantes
          </CardTitle>
          <CardDescription>
            Enviamos push (e e-mail, se disponível) no dia do aniversário do cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Ativar disparo automático</Label>
            <Switch
              checked={form.birthday_enabled}
              onCheckedChange={(v) => setForm({ ...form, birthday_enabled: v })}
            />
          </div>
          <div className="space-y-1">
            <Label>Mensagem</Label>
            <Textarea
              value={form.birthday_message}
              onChange={(e) => setForm({ ...form, birthday_message: e.target.value })}
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="space-y-1 max-w-xs">
            <Label>Cupom de desconto (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={form.birthday_coupon_percent ?? 0}
              onChange={(e) =>
                setForm({ ...form, birthday_coupon_percent: Number(e.target.value) || 0 })
              }
            />
            <p className="text-xs text-muted-foreground">0 desativa o cupom.</p>
          </div>
        </CardContent>
      </Card>

      {/* Reengajamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TimerReset className="h-4 w-4" /> Reengajamento de inativos
          </CardTitle>
          <CardDescription>
            Envio único quando o cliente fica sem visitar por N dias.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Ativar</Label>
            <Switch
              checked={form.reengagement_enabled}
              onCheckedChange={(v) => setForm({ ...form, reengagement_enabled: v })}
            />
          </div>
          <div className="space-y-1 max-w-xs">
            <Label>Dias sem visitar</Label>
            <Input
              type="number"
              min={7}
              max={365}
              value={form.reengagement_days ?? 30}
              onChange={(e) =>
                setForm({ ...form, reengagement_days: Number(e.target.value) || 30 })
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Mensagem</Label>
            <Textarea
              value={form.reengagement_message}
              onChange={(e) => setForm({ ...form, reengagement_message: e.target.value })}
              rows={3}
              maxLength={500}
            />
          </div>
        </CardContent>
      </Card>

      {/* Níveis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Níveis (Bronze → Diamante)
          </CardTitle>
          <CardDescription>
            O nível é calculado automaticamente com base no total de visitas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Ativar níveis</Label>
            <Switch
              checked={form.tiers_enabled}
              onCheckedChange={(v) => setForm({ ...form, tiers_enabled: v })}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["bronze", "prata", "ouro", "diamante"] as const).map((k) => (
              <div key={k} className="space-y-1">
                <Label className="capitalize">{k}</Label>
                <Input
                  type="number"
                  min={0}
                  value={th[k]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tier_thresholds: {
                        ...th,
                        [k]: Number(e.target.value) || 0,
                      } as unknown as typeof form.tier_thresholds,
                    })
                  }
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Visitas mínimas para atingir cada nível.
          </p>
        </CardContent>
      </Card>

      {/* Indicação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Programa de indicação
          </CardTitle>
          <CardDescription>
            Cada cliente recebe um código único; ao ser usado por outro cliente, ambos ganham
            carimbos-bônus.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Ativar</Label>
            <Switch
              checked={form.referral_enabled}
              onCheckedChange={(v) => setForm({ ...form, referral_enabled: v })}
            />
          </div>
          <div className="space-y-1 max-w-xs">
            <Label>Carimbos-bônus por indicação</Label>
            <Input
              type="number"
              min={0}
              max={5}
              value={form.referral_bonus_stamps ?? 1}
              onChange={(e) =>
                setForm({ ...form, referral_bonus_stamps: Number(e.target.value) || 0 })
              }
            />
          </div>
          {stats && (
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Clientes indicados</span>
                <strong>
                  {stats.totalReferred} / {stats.totalCustomers}
                </strong>
              </div>
              {stats.top.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold mb-2 text-muted-foreground">
                    Top indicadores
                  </p>
                  <ul className="space-y-1 text-sm">
                    {stats.top.map((t) => (
                      <li key={t.id} className="flex justify-between">
                        <span>{t.name}</span>
                        <span className="font-mono">{t.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span className="ml-2">Salvar configurações</span>
        </Button>
      </div>
    </div>
  );
}
