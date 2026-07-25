import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { UserCog as HeroIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { inviteTeamMember } from "@/lib/settings.functions";
import {
  listEstablishmentMembers,
  getMemberPermissions,
  updateMemberPermissions,
  resetMemberPermissions,
} from "@/lib/permissions.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  UserPlus, Copy, Send, Mail, CheckCircle2, Settings2, RotateCcw, Shield,
} from "lucide-react";
import { LoadingSkeleton } from "@/components/states";
import {
  PERMISSION_CATALOG, GROUP_LABELS, defaultPreset,
  type PermissionAction, type MemberRole, type PermissionEntry,
} from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/app/equipe")({
  head: () => ({ meta: [{ title: "Equipe & permissões — Fidelize" }] }),
  component: EquipePage,
});

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Dono",
  manager: "Gerente",
  staff: "Atendente",
};

function EquipePage() {
  const qc = useQueryClient();
  const getEsts = useServerFn(getMyEstablishments);
  const invite = useServerFn(inviteTeamMember);
  const listMembers = useServerFn(listEstablishmentMembers);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as { id: string; name: string } | undefined;

  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ["est-members", est?.id],
    queryFn: () => listMembers({ data: { establishment_id: est!.id } }),
    enabled: !!est?.id,
  });

  async function onInvite() {
    if (!est) return;
    const e = email.trim().toLowerCase();
    if (!e || !/^\S+@\S+\.\S+$/.test(e)) return toast.error("Informe um e-mail válido");
    setLoading(true);
    try {
      const res = await invite({ data: { establishment_id: est.id, email: e, role: "staff" } });
      setIssuedLink(`${window.location.origin}/invite/${res.token}`);
      setEmail("");
      toast.success("Convite gerado");
      qc.invalidateQueries({ queryKey: ["est-members", est.id] });
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao gerar convite");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(url: string) {
    try { await navigator.clipboard.writeText(url); toast.success("Link copiado"); }
    catch { toast.error("Não foi possível copiar"); }
  }

  if (!est) return <LoadingSkeleton variant="table" rows={5} />;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHero
        icon={HeroIcon}
        eyebrow={"Equipe · Acessos"}
        title={"Equipe & permissões"}
        subtitle={"Convide atendentes, defina papéis e ajuste finamente o que cada pessoa pode acessar."}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" />Adicionar atendente</CardTitle>
          <CardDescription>Envie um convite. O atendente entra com as permissões padrão do papel escolhido.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label>E-mail do atendente</Label>
              <Input type="email" placeholder="atendente@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={onInvite} disabled={loading} className="gap-2 gradient-brand text-primary-foreground">
                <UserPlus className="h-4 w-4" />{loading ? "Gerando…" : "Gerar convite"}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Mensagem (opcional)</Label>
            <Textarea rows={2} placeholder="Olá! Aceite o convite para começar a operar o cartão fidelidade." value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {issuedLink && (
            <div className="rounded-xl border bg-emerald-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Link pronto para envio
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={issuedLink} className="font-mono text-xs" />
                <Button size="icon" variant="secondary" aria-label="Copiar link" onClick={() => copyLink(issuedLink)}><Copy className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="gap-1">
                  <a href={`https://wa.me/?text=${encodeURIComponent((note ? note + "\n\n" : "") + issuedLink)}`} target="_blank" rel="noreferrer">
                    <Send className="h-3.5 w-3.5" />WhatsApp
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline" className="gap-1">
                  <a href={`mailto:?subject=${encodeURIComponent("Convite para a equipe")}&body=${encodeURIComponent((note ? note + "\n\n" : "") + issuedLink)}`}>
                    <Mail className="h-3.5 w-3.5" />E-mail
                  </a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" />Membros da equipe</CardTitle>
          <CardDescription>Clique em "Permissões" para liberar ou bloquear áreas específicas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {membersQuery.isLoading && <LoadingSkeleton variant="table" rows={3} />}
          {membersQuery.data?.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between rounded-xl border bg-card/50 px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{m.display_name || m.invited_email || "Sem nome"}</span>
                  <Badge variant="secondary" className="text-[10px] uppercase">{ROLE_LABELS[m.role as MemberRole]}</Badge>
                  {!m.active && <Badge variant="outline" className="text-[10px]">Pendente</Badge>}
                  {m.override_count > 0 && (
                    <Badge className="text-[10px] bg-primary/15 text-primary hover:bg-primary/15">{m.override_count} ajuste(s)</Badge>
                  )}
                </div>
                {m.invited_email && m.display_name && (
                  <div className="text-xs text-muted-foreground truncate">{m.invited_email}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {m.role !== "owner" && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditingMemberId(m.id)}>
                    <Settings2 className="h-3.5 w-3.5" /> Permissões
                  </Button>
                )}
              </div>
            </div>
          ))}
          {membersQuery.data && membersQuery.data.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum membro além do dono.</p>
          )}
        </CardContent>
      </Card>

      {editingMemberId && est && (
        <PermissionsDrawer
          establishmentId={est.id}
          memberId={editingMemberId}
          onClose={() => setEditingMemberId(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["est-members", est.id] })}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Drawer de edição de permissões
// ------------------------------------------------------------------
function PermissionsDrawer({
  establishmentId, memberId, onClose, onSaved,
}: {
  establishmentId: string; memberId: string; onClose: () => void; onSaved: () => void;
}) {
  const getFn = useServerFn(getMemberPermissions);
  const saveFn = useServerFn(updateMemberPermissions);
  const resetFn = useServerFn(resetMemberPermissions);

  const q = useQuery({
    queryKey: ["member-perms", memberId],
    queryFn: () => getFn({ data: { establishment_id: establishmentId, member_id: memberId } }),
  });

  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Inicializa quando os dados chegam
  useMemo(() => {
    if (q.data?.overrides) setOverrides({ ...q.data.overrides });
  }, [q.data]);

  const role = (q.data?.member?.role ?? "staff") as MemberRole;

  const groups = useMemo(() => {
    const map = new Map<string, PermissionEntry[]>();
    for (const p of PERMISSION_CATALOG) {
      if (p.ownerOnly) continue; // não editável
      const arr = map.get(p.group) ?? [];
      arr.push(p);
      map.set(p.group, arr);
    }
    return Array.from(map.entries());
  }, []);

  function currentValue(action: PermissionAction): boolean {
    if (action in overrides) return overrides[action];
    return defaultPreset(role, action);
  }

  function toggle(action: PermissionAction) {
    setOverrides((prev) => {
      const next = { ...prev };
      const def = defaultPreset(role, action);
      const desired = action in prev ? !prev[action] : !def;
      if (desired === def) delete next[action]; // volta ao padrão → não persiste override
      else next[action] = desired;
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await saveFn({ data: { establishment_id: establishmentId, member_id: memberId, overrides } });
      toast.success("Permissões atualizadas");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar");
    } finally { setSaving(false); }
  }

  async function reset() {
    setSaving(true);
    try {
      await resetFn({ data: { establishment_id: establishmentId, member_id: memberId } });
      setOverrides({});
      toast.success("Permissões restauradas ao padrão");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao restaurar");
    } finally { setSaving(false); }
  }

  const name = q.data?.member?.display_name || q.data?.member?.invited_email || "Membro";

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Permissões · {name}</SheetTitle>
          <SheetDescription>
            Papel atual: <strong>{ROLE_LABELS[role]}</strong>. Ligue/desligue ações específicas —
            o que ficar em cinza segue o padrão do papel.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {q.isLoading && <LoadingSkeleton variant="table" rows={6} />}
          {q.data && groups.map(([group, entries]) => (
            <div key={group} className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {GROUP_LABELS[group as PermissionEntry["group"]]}
              </div>
              <div className="space-y-1.5">
                {entries.map((p) => {
                  const val = currentValue(p.action);
                  const isOverride = p.action in overrides;
                  const def = defaultPreset(role, p.action);
                  return (
                    <label key={p.action} className={[
                      "flex items-start justify-between gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      isOverride ? "border-primary/40 bg-primary/5" : "bg-card/40",
                    ].join(" ")}>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{p.label}</div>
                        <div className="text-xs text-muted-foreground">{p.description}</div>
                        <div className="text-[10px] text-muted-foreground/70 mt-1">
                          Padrão do {ROLE_LABELS[role]}: {def ? "permitido" : "bloqueado"}
                          {isOverride && " · ajuste personalizado"}
                        </div>
                      </div>
                      <Switch checked={val} onCheckedChange={() => toggle(p.action)} />
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <SheetFooter className="mt-6 flex-row justify-between gap-2 sm:justify-between">
          <Button variant="ghost" onClick={reset} disabled={saving} className="gap-1.5">
            <RotateCcw className="h-4 w-4" /> Restaurar padrão
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gradient-brand text-primary-foreground">
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
