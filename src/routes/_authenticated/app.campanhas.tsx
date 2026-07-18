import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getMyEstablishments,
  getEstablishmentCampaigns,
  createCampaign,
  updateCampaign,
  toggleCampaign,
  deleteCampaign,
} from "@/lib/loyalty.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { StampCard } from "@/components/StampCard";
import { Plus, Pencil, Trash2, Pause, Play, Sparkles, Users, Gift, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/campanhas")({
  head: () => ({ meta: [{ title: "Campanhas — Fidelize" }] }),
  component: CampanhasPage,
});

type CampaignRow = {
  id: string;
  name: string;
  type: string;
  reward_title: string;
  reward_description: string | null;
  rules: string | null;
  stamps_required: number;
  stamp_icon: string;
  stamp_validity_days: number | null;
  reward_validity_days: number | null;
  primary_color: string | null;
  accent_color: string | null;
  active: boolean;
  cards_count: number;
  rewards_unlocked: number;
  rewards_redeemed: number;
};

type FormState = {
  name: string;
  reward_title: string;
  reward_description: string;
  rules: string;
  stamps_required: number;
  stamp_icon: "star" | "heart" | "check" | "coffee";
  stamp_validity_days: string;
  reward_validity_days: string;
  use_custom_colors: boolean;
  primary_color: string;
  accent_color: string;
};

const emptyForm: FormState = {
  name: "",
  reward_title: "",
  reward_description: "",
  rules: "",
  stamps_required: 10,
  stamp_icon: "star",
  stamp_validity_days: "",
  reward_validity_days: "60",
  use_custom_colors: false,
  primary_color: "#5B21B6",
  accent_color: "#F97066",
};

function CampanhasPage() {
  const qc = useQueryClient();
  const getEsts = useServerFn(getMyEstablishments);
  const getCamps = useServerFn(getEstablishmentCampaigns);
  const create = useServerFn(createCampaign);
  const update = useServerFn(updateCampaign);
  const toggle = useServerFn(toggleCampaign);
  const remove = useServerFn(deleteCampaign);

  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as
    | { id: string; name: string; logo_url: string | null; primary_color: string; accent_color: string }
    | undefined;

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns", est?.id],
    queryFn: () => getCamps({ data: { establishment_id: est!.id } }),
    enabled: !!est?.id,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(c: CampaignRow) {
    setEditing(c);
    setForm({
      name: c.name,
      reward_title: c.reward_title,
      reward_description: c.reward_description ?? "",
      rules: c.rules ?? "",
      stamps_required: c.stamps_required,
      stamp_icon: (["star", "heart", "check", "coffee"] as const).includes(c.stamp_icon as never)
        ? (c.stamp_icon as FormState["stamp_icon"]) : "star",
      stamp_validity_days: c.stamp_validity_days?.toString() ?? "",
      reward_validity_days: c.reward_validity_days?.toString() ?? "",
      use_custom_colors: !!(c.primary_color || c.accent_color),
      primary_color: c.primary_color ?? est?.primary_color ?? "#5B21B6",
      accent_color: c.accent_color ?? est?.accent_color ?? "#F97066",
    });
    setOpen(true);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        reward_title: form.reward_title.trim(),
        reward_description: form.reward_description.trim(),
        rules: form.rules.trim(),
        stamps_required: Number(form.stamps_required),
        stamp_icon: form.stamp_icon,
        stamp_validity_days: form.stamp_validity_days ? Number(form.stamp_validity_days) : null,
        reward_validity_days: form.reward_validity_days ? Number(form.reward_validity_days) : null,
      };
      if (editing) {
        await update({ data: { id: editing.id, ...payload } });
      } else {
        await create({ data: { establishment_id: est!.id, ...payload } });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Campanha atualizada" : "Campanha criada");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["campaigns", est?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns", est?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Campanha excluída");
      qc.invalidateQueries({ queryKey: ["campaigns", est?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    const rows = (campaigns ?? []) as CampaignRow[];
    return {
      total: rows.length,
      active: rows.filter(r => r.active).length,
      cards: rows.reduce((a, r) => a + r.cards_count, 0),
      redeemed: rows.reduce((a, r) => a + r.rewards_redeemed, 0),
    };
  }, [campaigns]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Programas</div>
          <h1 className="font-display text-3xl font-bold">Campanhas</h1>
          <p className="text-sm text-muted-foreground mt-1">Crie e gerencie os cartões fidelidade da sua empresa.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" />Nova campanha</Button>
          </DialogTrigger>
          <CampaignDialog
            form={form}
            setForm={setForm}
            editing={editing}
            est={est}
            saving={saveMut.isPending}
            onSubmit={() => saveMut.mutate()}
          />
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard icon={<Sparkles className="h-4 w-4" />} label="Campanhas" value={totals.total} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Ativas" value={totals.active} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Cartões emitidos" value={totals.cards} />
        <StatCard icon={<Gift className="h-4 w-4" />} label="Recompensas resgatadas" value={totals.redeemed} />
      </div>

      {isLoading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Carregando…</CardContent></Card>
      ) : (campaigns?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 grid place-items-center text-primary"><Sparkles className="h-6 w-6" /></div>
            <div className="font-semibold text-lg">Nenhuma campanha ainda</div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">Crie sua primeira campanha para começar a distribuir cartões fidelidade aos seus clientes.</p>
            <Button onClick={openNew} className="gap-2 mt-2"><Plus className="h-4 w-4" />Criar campanha</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(campaigns as CampaignRow[]).map((c) => (
            <Card key={c.id} className={c.active ? "" : "opacity-70"}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{c.name}</CardTitle>
                    <CardDescription className="truncate">{c.reward_title}</CardDescription>
                  </div>
                  <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Ativa" : "Pausada"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {est && (
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <StampCard
                      brandName={est.name}
                      logoUrl={est.logo_url}
                      stamps={0}
                      required={c.stamps_required}
                      reward={c.reward_title}
                      primary={est.primary_color}
                      accent={est.accent_color}
                      icon={c.stamp_icon}
                    />
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <MiniStat label="Cartões" value={c.cards_count} />
                  <MiniStat label="Ganhas" value={c.rewards_unlocked} />
                  <MiniStat label="Resgatadas" value={c.rewards_redeemed} />
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>Carimbos necessários: <span className="font-medium text-foreground">{c.stamps_required}</span></div>
                  <div>Validade da recompensa: <span className="font-medium text-foreground">{c.reward_validity_days ? `${c.reward_validity_days} dias` : "sem prazo"}</span></div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={c.active}
                      onCheckedChange={(v) => toggleMut.mutate({ id: c.id, active: v })}
                    />
                    <span className="text-xs text-muted-foreground">{c.active ? "Ativa" : "Pausada"}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)} className="gap-1"><Pencil className="h-3.5 w-3.5" />Editar</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Se a campanha já tem cartões emitidos, prefira pausá-la.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMut.mutate(c.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleMut.mutate({ id: c.id, active: !c.active })}
                      title={c.active ? "Pausar" : "Ativar"}
                    >
                      {c.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function CampaignDialog({
  form, setForm, editing, est, saving, onSubmit,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  editing: CampaignRow | null;
  est: { name: string; logo_url: string | null; primary_color: string; accent_color: string } | undefined;
  saving: boolean;
  onSubmit: () => void;
}) {
  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editing ? "Editar campanha" : "Nova campanha"}</DialogTitle>
        <DialogDescription>Configure regras, recompensa e visual do cartão fidelidade.</DialogDescription>
      </DialogHeader>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome da campanha</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Cartão do café" />
          </div>
          <div className="space-y-1.5">
            <Label>Recompensa</Label>
            <Input value={form.reward_title} onChange={e => setForm({ ...form, reward_title: e.target.value })} placeholder="Ex.: 1 café grátis" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição da recompensa</Label>
            <Textarea rows={2} value={form.reward_description} onChange={e => setForm({ ...form, reward_description: e.target.value })} placeholder="Detalhes que aparecem para o cliente" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Carimbos necessários</Label>
              <Input type="number" min={2} max={50} value={form.stamps_required}
                onChange={e => setForm({ ...form, stamps_required: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Ícone do carimbo</Label>
              <Select value={form.stamp_icon} onValueChange={(v) => setForm({ ...form, stamp_icon: v as FormState["stamp_icon"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="star">Estrela</SelectItem>
                  <SelectItem value="heart">Coração</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="coffee">Café</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Validade do carimbo (dias)</Label>
              <Input type="number" min={0} placeholder="sem prazo" value={form.stamp_validity_days}
                onChange={e => setForm({ ...form, stamp_validity_days: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Validade da recompensa (dias)</Label>
              <Input type="number" min={0} placeholder="sem prazo" value={form.reward_validity_days}
                onChange={e => setForm({ ...form, reward_validity_days: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Regras e condições</Label>
            <Textarea rows={3} value={form.rules} onChange={e => setForm({ ...form, rules: e.target.value })} placeholder="Ex.: Não cumulativo com outras promoções. Válido em qualquer unidade." />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Prévia</Label>
          <div className="rounded-xl border bg-muted/30 p-4">
            {est && (
              <StampCard
                brandName={est.name}
                logoUrl={est.logo_url}
                stamps={0}
                required={Math.min(50, Math.max(2, Number(form.stamps_required) || 10))}
                reward={form.reward_title || "Sua recompensa"}
                primary={est.primary_color}
                accent={est.accent_color}
                icon={form.stamp_icon}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">Assim seu cartão aparece para o cliente.</p>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onSubmit} disabled={saving}>{saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar campanha"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
