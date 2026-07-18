import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import {
  getEstablishmentFull, updateEstablishmentProfile, updateSettingsSection,
  listTeam, inviteTeamMember, revokeInvite, resendInvite, updateMember, removeMember,
  setMyPin, removeMyPin, changePassword,
  listTemplates, saveTemplate,
  listDataRequests, createDataRequest, processDataRequest,
  listAuditLogs, archiveEstablishment, restoreEstablishment, deleteEstablishment,
  exportEstablishmentData,
} from "@/lib/settings.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Building2, Palette, Shield, Bell, Users, ScrollText, AlertTriangle, Lock, CreditCard, Wrench, Copy, RefreshCcw, Trash2, Download, KeyRound,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/app/config")({
  head: () => ({ meta: [{ title: "Configurações — Fidelize" }] }),
  component: ConfigPage,
});

function ConfigPage() {
  const getEsts = useServerFn(getMyEstablishments);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as { id: string; name: string; slug: string } | undefined;
  if (!est) return <div className="text-muted-foreground">Carregando estabelecimento…</div>;
  return <ConfigInner establishmentId={est.id} />;
}

function ConfigInner({ establishmentId }: { establishmentId: string }) {
  const getFull = useServerFn(getEstablishmentFull);
  const { data, isLoading } = useQuery({
    queryKey: ["est-full", establishmentId],
    queryFn: () => getFull({ data: { establishment_id: establishmentId } }),
  });
  if (isLoading || !data) return <div className="text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Ajustes</div>
        <h1 className="font-display text-3xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie sua empresa, equipe, segurança, notificações e mais.</p>
      </div>

      <Tabs defaultValue="perfil" className="space-y-4">
        <div className="overflow-x-auto -mx-2 px-2">
          <TabsList className="inline-flex flex-nowrap">
            <TabsTrigger value="perfil"><Building2 className="h-4 w-4 mr-1" />Empresa</TabsTrigger>
            <TabsTrigger value="cartao"><CreditCard className="h-4 w-4 mr-1" />Cartão</TabsTrigger>
            <TabsTrigger value="equipe"><Users className="h-4 w-4 mr-1" />Equipe</TabsTrigger>
            <TabsTrigger value="seguranca"><Lock className="h-4 w-4 mr-1" />Segurança</TabsTrigger>
            <TabsTrigger value="privacidade"><Shield className="h-4 w-4 mr-1" />Privacidade</TabsTrigger>
            <TabsTrigger value="notificacoes"><Bell className="h-4 w-4 mr-1" />Notificações</TabsTrigger>
            <TabsTrigger value="aparencia"><Palette className="h-4 w-4 mr-1" />Aparência</TabsTrigger>
            <TabsTrigger value="plano"><Wrench className="h-4 w-4 mr-1" />Plano</TabsTrigger>
            <TabsTrigger value="auditoria"><ScrollText className="h-4 w-4 mr-1" />Auditoria</TabsTrigger>
            <TabsTrigger value="perigo"><AlertTriangle className="h-4 w-4 mr-1" />Perigo</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="perfil"><PerfilTab establishmentId={establishmentId} est={data.establishment as any} /></TabsContent>
        <TabsContent value="cartao"><CartaoTab establishmentId={establishmentId} settings={data.settings as any} /></TabsContent>
        <TabsContent value="equipe"><EquipeTab establishmentId={establishmentId} /></TabsContent>
        <TabsContent value="seguranca"><SegurancaTab establishmentId={establishmentId} settings={data.settings as any} /></TabsContent>
        <TabsContent value="privacidade"><PrivacidadeTab establishmentId={establishmentId} settings={data.settings as any} /></TabsContent>
        <TabsContent value="notificacoes"><NotificacoesTab establishmentId={establishmentId} settings={data.settings as any} /></TabsContent>
        <TabsContent value="aparencia"><AparenciaTab establishmentId={establishmentId} est={data.establishment as any} settings={data.settings as any} /></TabsContent>
        <TabsContent value="plano"><PlanoTab subscription={data.subscription as any} est={data.establishment as any} /></TabsContent>
        <TabsContent value="auditoria"><AuditoriaTab establishmentId={establishmentId} /></TabsContent>
        <TabsContent value="perigo"><PerigoTab establishmentId={establishmentId} est={data.establishment as any} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// EMPRESA
// ============================================================
function PerfilTab({ establishmentId, est }: { establishmentId: string; est: any }) {
  const qc = useQueryClient();
  const update = useServerFn(updateEstablishmentProfile);
  const [form, setForm] = useState({
    name: est.name ?? "", slug: est.slug ?? "", description: est.description ?? "",
    segment: est.segment ?? "", cnpj: est.cnpj ?? "", razao_social: est.razao_social ?? "",
    phone: est.phone ?? "", whatsapp: est.whatsapp ?? "", email: est.email ?? "",
    website: est.website ?? "", instagram: est.instagram ?? "", facebook: est.facebook ?? "", tiktok: est.tiktok ?? "",
    google_maps_url: est.google_maps_url ?? "",
    address: est.address ?? "", city: est.city ?? "", state: est.state ?? "", cep: est.cep ?? "",
    business_hours: est.business_hours ?? "", timezone: est.timezone ?? "America/Sao_Paulo",
    average_ticket: est.average_ticket ?? null,
  });
  const [saving, setSaving] = useState(false);
  async function onSave() {
    setSaving(true);
    try {
      await update({ data: { establishment_id: establishmentId, ...form, average_ticket: form.average_ticket ? Number(form.average_ticket) : null } });
      toast.success("Dados salvos");
      qc.invalidateQueries({ queryKey: ["est-full", establishmentId] });
      qc.invalidateQueries({ queryKey: ["memberships"] });
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }
  const F = (k: keyof typeof form, label: string, opts: { placeholder?: string; type?: string; area?: boolean } = {}) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {opts.area
        ? <Textarea value={(form as any)[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={opts.placeholder} rows={3} />
        : <Input type={opts.type ?? "text"} value={(form as any)[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={opts.placeholder} />}
    </div>
  );
  return (
    <Card>
      <CardHeader><CardTitle>Perfil da empresa</CardTitle><CardDescription>Dados exibidos na página pública e usados nos materiais.</CardDescription></CardHeader>
      <CardContent className="space-y-6">
        <section className="grid md:grid-cols-2 gap-4">
          {F("name", "Nome fantasia*")}
          {F("slug", "Link da página (slug)*", { placeholder: "minha-empresa" })}
          {F("segment", "Segmento", { placeholder: "cafeteria, barbearia..." })}
          {F("razao_social", "Razão social")}
          {F("cnpj", "CNPJ")}
          {F("average_ticket", "Ticket médio (R$)", { type: "number" })}
        </section>
        <Separator />
        <section className="grid md:grid-cols-2 gap-4">
          {F("phone", "Telefone")}
          {F("whatsapp", "WhatsApp")}
          {F("email", "E-mail público", { type: "email" })}
          {F("website", "Site")}
          {F("instagram", "Instagram (sem @)")}
          {F("facebook", "Facebook")}
          {F("tiktok", "TikTok")}
          {F("google_maps_url", "Google Maps (URL)")}
        </section>
        <Separator />
        <section className="grid md:grid-cols-4 gap-4">
          <div className="md:col-span-2">{F("address", "Endereço")}</div>
          {F("city", "Cidade")}
          {F("state", "UF")}
          {F("cep", "CEP")}
          <div className="md:col-span-3">{F("timezone", "Fuso horário")}</div>
        </section>
        <Separator />
        {F("description", "Descrição pública", { area: true, placeholder: "Fale sobre sua empresa" })}
        {F("business_hours", "Horário de funcionamento", { area: true, placeholder: "Seg-Sex 08h-18h" })}
        <div className="flex justify-end"><Button onClick={onSave} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button></div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// CARTÃO
// ============================================================
function CartaoTab({ establishmentId, settings }: { establishmentId: string; settings: any }) {
  const qc = useQueryClient();
  const save = useServerFn(updateSettingsSection);
  const [f, setF] = useState({
    program_name: settings?.card?.program_name ?? "Programa Fidelidade",
    default_stamps_required: settings?.card?.default_stamps_required ?? 10,
    default_reward: settings?.card?.default_reward ?? "Brinde especial",
    stamp_validity_days: settings?.card?.stamp_validity_days ?? 180,
    back_text: settings?.card?.back_text ?? "",
    post_reward_message: settings?.card?.post_reward_message ?? "",
  });
  const [saving, setSaving] = useState(false);
  async function onSave() {
    setSaving(true);
    try {
      await save({ data: { establishment_id: establishmentId, section: "card", patch: f } });
      toast.success("Configurações do cartão salvas");
      qc.invalidateQueries({ queryKey: ["est-full", establishmentId] });
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }
  return (
    <Card>
      <CardHeader><CardTitle>Configurações do cartão fidelidade</CardTitle><CardDescription>Padrões aplicados a novos programas. Cada campanha pode substituir.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Nome do programa</Label><Input value={f.program_name} onChange={e => setF({ ...f, program_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Carimbos necessários</Label><Input type="number" min={1} max={30} value={f.default_stamps_required} onChange={e => setF({ ...f, default_stamps_required: Number(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Recompensa padrão</Label><Input value={f.default_reward} onChange={e => setF({ ...f, default_reward: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Validade dos carimbos (dias)</Label><Input type="number" min={0} value={f.stamp_validity_days} onChange={e => setF({ ...f, stamp_validity_days: Number(e.target.value) })} /></div>
        </div>
        <div className="space-y-1.5"><Label>Texto do verso do cartão</Label><Textarea rows={3} value={f.back_text} onChange={e => setF({ ...f, back_text: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Mensagem pós-resgate</Label><Textarea rows={2} value={f.post_reward_message} onChange={e => setF({ ...f, post_reward_message: e.target.value })} /></div>
        <div className="flex justify-end"><Button onClick={onSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// EQUIPE
// ============================================================
function EquipeTab({ establishmentId }: { establishmentId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listTeam);
  const invite = useServerFn(inviteTeamMember);
  const revoke = useServerFn(revokeInvite);
  const upd = useServerFn(updateMember);
  const rem = useServerFn(removeMember);
  const { data } = useQuery({ queryKey: ["team", establishmentId], queryFn: () => list({ data: { establishment_id: establishmentId } }) });
  const [email, setEmail] = useState(""); const [role, setRole] = useState<"staff" | "manager">("staff");
  const [lastLink, setLastLink] = useState<string | null>(null);

  async function onInvite() {
    if (!email) return;
    try {
      const res = await invite({ data: { establishment_id: establishmentId, email, role } });
      const url = `${window.location.origin}/invite/${res.token}`;
      setLastLink(url);
      toast.success("Convite criado. Envie o link ao funcionário.");
      setEmail(""); qc.invalidateQueries({ queryKey: ["team", establishmentId] });
    } catch (e: any) { toast.error(e.message); }
  }
  async function onRevoke(id: string) { await revoke({ data: { establishment_id: establishmentId, invite_id: id } }); qc.invalidateQueries({ queryKey: ["team", establishmentId] }); }
  async function onRoleChange(memberId: string, r: "staff" | "manager" | "owner") {
    try { await upd({ data: { establishment_id: establishmentId, member_id: memberId, role: r } }); qc.invalidateQueries({ queryKey: ["team", establishmentId] }); toast.success("Função atualizada"); }
    catch (e: any) { toast.error(e.message); }
  }
  async function onToggleActive(memberId: string, active: boolean) {
    await upd({ data: { establishment_id: establishmentId, member_id: memberId, active } });
    qc.invalidateQueries({ queryKey: ["team", establishmentId] });
  }
  async function onRemove(memberId: string) {
    if (!confirm("Remover este funcionário?")) return;
    try { await rem({ data: { establishment_id: establishmentId, member_id: memberId } }); qc.invalidateQueries({ queryKey: ["team", establishmentId] }); toast.success("Removido"); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Convidar funcionário</CardTitle><CardDescription>Envie o link gerado pelo WhatsApp ou e-mail.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-[1fr_180px_auto] gap-3">
            <Input placeholder="funcionario@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} />
            <Select value={role} onValueChange={(v: any) => setRole(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Atendente (carimba)</SelectItem>
                <SelectItem value="manager">Gerente (edita)</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={onInvite}>Gerar convite</Button>
          </div>
          {lastLink && (
            <div className="rounded-lg border p-3 flex items-center gap-2 bg-muted/40">
              <Input readOnly value={lastLink} className="font-mono text-xs" />
              <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(lastLink); toast.success("Copiado"); }}><Copy className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Convites pendentes</CardTitle></CardHeader>
        <CardContent>
          {!data?.invites?.length && <div className="text-sm text-muted-foreground">Nenhum convite pendente.</div>}
          <div className="space-y-2">
            {data?.invites?.map((i: any) => (
              <div key={i.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">{i.email}</div>
                  <div className="text-xs text-muted-foreground">Função: {i.role} · expira em {new Date(i.expires_at).toLocaleDateString("pt-BR")}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => onRevoke(i.id)}>Revogar</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Membros da equipe</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data?.members?.map((m: any) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="font-medium">{m.profile?.full_name ?? m.invited_email ?? "Membro"} {m.has_pin && <Badge variant="secondary" className="ml-2">PIN</Badge>}</div>
                <div className="text-xs text-muted-foreground">Desde {new Date(m.created_at).toLocaleDateString("pt-BR")}</div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={m.role} onValueChange={(v: any) => onRoleChange(m.id, v)} disabled={m.role === "owner"}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Atendente</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="owner">Proprietário</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2"><Switch checked={m.active} onCheckedChange={(v) => onToggleActive(m.id, v)} /><span className="text-xs">Ativo</span></div>
                {m.role !== "owner" && <Button size="icon" variant="ghost" onClick={() => onRemove(m.id)}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// SEGURANÇA
// ============================================================
function SegurancaTab({ establishmentId, settings }: { establishmentId: string; settings: any }) {
  const qc = useQueryClient();
  const saveSec = useServerFn(updateSettingsSection);
  const setPin = useServerFn(setMyPin);
  const rmPin = useServerFn(removeMyPin);
  const chpwd = useServerFn(changePassword);
  const [pin, setPin_] = useState(""); const [pin2, setPin2] = useState("");
  const [pwd, setPwd] = useState(""); const [pwd2, setPwd2] = useState("");
  const [requirePin, setRequirePin] = useState<boolean>(!!settings?.security?.require_pin_to_stamp);

  async function onTogglePin(v: boolean) {
    setRequirePin(v);
    await saveSec({ data: { establishment_id: establishmentId, section: "security", patch: { require_pin_to_stamp: v } } });
    toast.success(v ? "PIN passará a ser obrigatório para carimbar" : "PIN opcional");
    qc.invalidateQueries({ queryKey: ["est-full", establishmentId] });
  }
  async function onSetPin() {
    if (pin.length < 4 || pin !== pin2) return toast.error("PINs não conferem (4 a 6 dígitos)");
    try { await setPin({ data: { establishment_id: establishmentId, pin } }); toast.success("PIN definido"); setPin_(""); setPin2(""); }
    catch (e: any) { toast.error(e.message); }
  }
  async function onRemovePin() { await rmPin({ data: { establishment_id: establishmentId } }); toast.success("PIN removido"); }
  async function onChangePwd() {
    if (pwd.length < 8 || pwd !== pwd2) return toast.error("Senha inválida (mín. 8, iguais)");
    try { await chpwd({ data: { new_password: pwd } }); toast.success("Senha alterada"); setPwd(""); setPwd2(""); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>PIN para carimbar</CardTitle><CardDescription>Impede que funcionários carimbem sem autenticação rápida.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div><div className="font-medium">Exigir PIN em todos os carimbos</div><div className="text-xs text-muted-foreground">Aplica a toda a equipe.</div></div>
            <Switch checked={requirePin} onCheckedChange={onTogglePin} />
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Novo PIN (4-6 dígitos)</Label><Input inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin_(e.target.value.replace(/\D/g,""))} /></div>
            <div className="space-y-1.5"><Label>Confirmar PIN</Label><Input inputMode="numeric" maxLength={6} value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g,""))} /></div>
            <div className="flex items-end gap-2"><Button onClick={onSetPin}><KeyRound className="h-4 w-4 mr-1" />Definir meu PIN</Button><Button variant="ghost" onClick={onRemovePin}>Remover</Button></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Alterar senha</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Nova senha</Label><Input type="password" value={pwd} onChange={e => setPwd(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Confirmar</Label><Input type="password" value={pwd2} onChange={e => setPwd2(e.target.value)} /></div>
            <div className="flex items-end"><Button onClick={onChangePwd}>Alterar senha</Button></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// PRIVACIDADE / LGPD
// ============================================================
function PrivacidadeTab({ establishmentId, settings }: { establishmentId: string; settings: any }) {
  const qc = useQueryClient();
  const save = useServerFn(updateSettingsSection);
  const list = useServerFn(listDataRequests);
  const create = useServerFn(createDataRequest);
  const process = useServerFn(processDataRequest);
  const [f, setF] = useState({
    require_consent: settings?.privacy?.require_consent ?? true,
    default_marketing_opt_in: settings?.privacy?.default_marketing_opt_in ?? false,
    retention_days: settings?.privacy?.retention_days ?? 730,
    policy_text: settings?.privacy?.policy_text ?? "",
  });
  const { data } = useQuery({ queryKey: ["data-requests", establishmentId], queryFn: () => list({ data: { establishment_id: establishmentId } }) });
  const [phone, setPhone] = useState(""); const [kind, setKind] = useState<"export"|"delete">("export"); const [reason, setReason] = useState("");

  async function onSavePolicy() {
    await save({ data: { establishment_id: establishmentId, section: "privacy", patch: f } });
    toast.success("Política salva"); qc.invalidateQueries({ queryKey: ["est-full", establishmentId] });
  }
  async function onRequest() {
    if (!phone) return toast.error("Informe o telefone do cliente");
    try { await create({ data: { establishment_id: establishmentId, customer_phone: phone.replace(/\D/g,""), kind, reason } });
      toast.success("Solicitação registrada"); setPhone(""); setReason("");
      qc.invalidateQueries({ queryKey: ["data-requests", establishmentId] });
    } catch (e: any) { toast.error(e.message); }
  }
  async function onProcess(id: string, k: string) {
    if (k === "delete" && !confirm("Anonimizar dados deste cliente? Não é reversível.")) return;
    try {
      const res = await process({ data: { establishment_id: establishmentId, request_id: id } });
      if ((res as any).payload) {
        const blob = new Blob([JSON.stringify((res as any).payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `export-${id}.json`; a.click(); URL.revokeObjectURL(url);
      }
      toast.success("Processado"); qc.invalidateQueries({ queryKey: ["data-requests", establishmentId] });
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Consentimento & retenção</CardTitle><CardDescription>Aplica-se ao cadastro de clientes na página pública.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div><div className="font-medium">Exigir aceite da política</div><div className="text-xs text-muted-foreground">Cliente precisa marcar checkbox no cadastro.</div></div>
            <Switch checked={f.require_consent} onCheckedChange={v => setF({ ...f, require_consent: v })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div><div className="font-medium">Opt-in marketing marcado por padrão</div><div className="text-xs text-muted-foreground">Recomendado: manter desmarcado (LGPD).</div></div>
            <Switch checked={f.default_marketing_opt_in} onCheckedChange={v => setF({ ...f, default_marketing_opt_in: v })} />
          </div>
          <div className="grid md:grid-cols-[220px_1fr] gap-4 items-start">
            <div className="space-y-1.5"><Label>Retenção (dias)</Label><Input type="number" min={30} value={f.retention_days} onChange={e => setF({ ...f, retention_days: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Texto da política de privacidade</Label><Textarea rows={5} value={f.policy_text} onChange={e => setF({ ...f, policy_text: e.target.value })} placeholder="Explique como usa e protege os dados dos clientes." /></div>
          </div>
          <div className="flex justify-end"><Button onClick={onSavePolicy}>Salvar</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Solicitações LGPD</CardTitle><CardDescription>Registre pedidos de exportação ou exclusão de dados.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-[1fr_180px_1fr_auto] gap-3">
            <Input placeholder="Telefone do cliente (só números)" value={phone} onChange={e => setPhone(e.target.value)} />
            <Select value={kind} onValueChange={(v: any) => setKind(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="export">Exportar dados</SelectItem>
                <SelectItem value="delete">Excluir/anonimizar</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Motivo (opcional)" value={reason} onChange={e => setReason(e.target.value)} />
            <Button onClick={onRequest}>Registrar</Button>
          </div>
          <div className="space-y-2">
            {data?.requests?.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium capitalize">{r.kind === "export" ? "Exportar" : "Excluir"} · {r.customer_phone}</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")} · <Badge variant={r.status === "done" ? "secondary" : "outline"}>{r.status}</Badge></div>
                </div>
                {r.status === "pending" && <Button size="sm" onClick={() => onProcess(r.id, r.kind)}>Processar</Button>}
              </div>
            ))}
            {!data?.requests?.length && <div className="text-sm text-muted-foreground">Nenhuma solicitação.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// NOTIFICAÇÕES
// ============================================================
function NotificacoesTab({ establishmentId, settings }: { establishmentId: string; settings: any }) {
  const qc = useQueryClient();
  const saveSec = useServerFn(updateSettingsSection);
  const list = useServerFn(listTemplates);
  const save = useServerFn(saveTemplate);
  const { data } = useQuery({ queryKey: ["templates", establishmentId], queryFn: () => list({ data: { establishment_id: establishmentId } }) });
  const [prefs, setPrefs] = useState({
    channels: settings?.notifications?.channels ?? { email: true, whatsapp: false },
    events: settings?.notifications?.events ?? { new_stamp: true, reward_ready: true, birthday: false, inactive_customer: false },
    inactive_days: settings?.notifications?.inactive_days ?? 60,
  });
  async function onSavePrefs() {
    await saveSec({ data: { establishment_id: establishmentId, section: "notifications", patch: prefs } });
    toast.success("Preferências salvas"); qc.invalidateQueries({ queryKey: ["est-full", establishmentId] });
  }
  const evLabel: Record<string, string> = { new_stamp: "Novo carimbo", reward_ready: "Recompensa pronta", birthday: "Aniversário do cliente", inactive_customer: "Cliente inativo" };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Canais & eventos</CardTitle><CardDescription>Escolha por qual canal e quais eventos disparam notificação.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-lg border p-3"><span>E-mail</span><Switch checked={prefs.channels.email} onCheckedChange={v => setPrefs({ ...prefs, channels: { ...prefs.channels, email: v } })} /></div>
            <div className="flex items-center justify-between rounded-lg border p-3"><span>WhatsApp (em breve)</span><Switch checked={prefs.channels.whatsapp} onCheckedChange={v => setPrefs({ ...prefs, channels: { ...prefs.channels, whatsapp: v } })} /></div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {Object.entries(evLabel).map(([k, l]) => (
              <div key={k} className="flex items-center justify-between rounded-lg border p-3">
                <span>{l}</span>
                <Switch checked={(prefs.events as any)[k]} onCheckedChange={v => setPrefs({ ...prefs, events: { ...prefs.events, [k]: v } })} />
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-[220px_1fr] gap-4">
            <div className="space-y-1.5"><Label>Cliente inativo após (dias)</Label><Input type="number" min={7} value={prefs.inactive_days} onChange={e => setPrefs({ ...prefs, inactive_days: Number(e.target.value) })} /></div>
          </div>
          <div className="flex justify-end"><Button onClick={onSavePrefs}>Salvar preferências</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Templates</CardTitle><CardDescription>Use {"{{nome}}"}, {"{{empresa}}"}, {"{{restantes}}"}.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {(data?.templates ?? []).map((t: any) => (
            <TemplateEditor key={`${t.event}:${t.channel}`} tpl={t} establishmentId={establishmentId} save={save} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function TemplateEditor({ tpl, establishmentId, save }: { tpl: any; establishmentId: string; save: any }) {
  const qc = useQueryClient();
  const [subject, setSubject] = useState(tpl.subject ?? "");
  const [body, setBody] = useState(tpl.body ?? "");
  const [active, setActive] = useState(tpl.active);
  async function onSave() {
    try { await save({ data: { establishment_id: establishmentId, event: tpl.event, channel: tpl.channel, subject, body, active } });
      toast.success("Template salvo"); qc.invalidateQueries({ queryKey: ["templates", establishmentId] });
    } catch (e: any) { toast.error(e.message); }
  }
  const evLabel: Record<string, string> = { new_stamp: "Novo carimbo", reward_ready: "Recompensa pronta", birthday: "Aniversário", inactive_customer: "Cliente inativo" };
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-medium">{evLabel[tpl.event]} <span className="text-xs text-muted-foreground">· {tpl.channel}</span></div>
        <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} /><span className="text-xs">Ativo</span></div>
      </div>
      <Input placeholder="Assunto" value={subject} onChange={e => setSubject(e.target.value)} />
      <Textarea rows={3} value={body} onChange={e => setBody(e.target.value)} />
      <div className="flex justify-end"><Button size="sm" onClick={onSave}>Salvar</Button></div>
    </div>
  );
}

// ============================================================
// APARÊNCIA
// ============================================================
function AparenciaTab({ establishmentId, est, settings }: { establishmentId: string; est: any; settings: any }) {
  const qc = useQueryClient();
  const updateEst = useServerFn(updateEstablishmentProfile);
  const saveSec = useServerFn(updateSettingsSection);
  const [primary, setPrimary] = useState(est.primary_color ?? "#5B21B6");
  const [accent, setAccent] = useState(est.accent_color ?? "#F97066");
  const [logo, setLogo] = useState(est.logo_url ?? "");
  const [cover, setCover] = useState(est.cover_url ?? "");
  const [ap, setAp] = useState({
    card_shape: settings?.appearance?.card_shape ?? "rounded",
    logo_shape: settings?.appearance?.logo_shape ?? "circle",
    stamp_icon: settings?.appearance?.stamp_icon ?? "star",
    font: settings?.appearance?.font ?? "inter",
  });

  async function onSave() {
    try {
      await updateEst({ data: {
        establishment_id: establishmentId, name: est.name, slug: est.slug,
        logo_url: logo, cover_url: cover,
        description: est.description, segment: est.segment, cnpj: est.cnpj, razao_social: est.razao_social,
        phone: est.phone, whatsapp: est.whatsapp, email: est.email, website: est.website,
        instagram: est.instagram, facebook: est.facebook, tiktok: est.tiktok, google_maps_url: est.google_maps_url,
        address: est.address, city: est.city, state: est.state, cep: est.cep,
        business_hours: est.business_hours, timezone: est.timezone,
      }});
      // Direct primary/accent write via settings — actually stored in establishments; use RPC via profile again
      // Colors live in establishments table too:
      const { supabase } = await import("@/integrations/supabase/client");
      await (supabase.from("establishments") as any).update({ primary_color: primary, accent_color: accent }).eq("id", establishmentId);
      await saveSec({ data: { establishment_id: establishmentId, section: "appearance", patch: ap } });
      toast.success("Aparência atualizada");
      qc.invalidateQueries({ queryKey: ["est-full", establishmentId] });
      qc.invalidateQueries({ queryKey: ["memberships"] });
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Aparência & identidade visual</CardTitle><CardDescription>Aplicado na página pública, cartão e materiais.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Cor primária</Label>
            <div className="flex gap-2"><Input type="color" value={primary} onChange={e => setPrimary(e.target.value)} className="w-16 h-10 p-1" /><Input value={primary} onChange={e => setPrimary(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Cor de destaque</Label>
            <div className="flex gap-2"><Input type="color" value={accent} onChange={e => setAccent(e.target.value)} className="w-16 h-10 p-1" /><Input value={accent} onChange={e => setAccent(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>URL do logo</Label><Input value={logo} onChange={e => setLogo(e.target.value)} placeholder="https://..." /></div>
          <div className="space-y-1.5"><Label>URL da capa</Label><Input value={cover} onChange={e => setCover(e.target.value)} placeholder="https://..." /></div>
          <div className="space-y-1.5"><Label>Formato do logo</Label>
            <Select value={ap.logo_shape} onValueChange={v => setAp({ ...ap, logo_shape: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="circle">Redondo</SelectItem><SelectItem value="rounded">Arredondado</SelectItem><SelectItem value="square">Quadrado</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Formato do cartão</Label>
            <Select value={ap.card_shape} onValueChange={v => setAp({ ...ap, card_shape: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="rounded">Arredondado</SelectItem><SelectItem value="square">Quadrado</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Ícone de carimbo</Label>
            <Select value={ap.stamp_icon} onValueChange={v => setAp({ ...ap, stamp_icon: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="star">Estrela</SelectItem><SelectItem value="heart">Coração</SelectItem><SelectItem value="check">Check</SelectItem><SelectItem value="coffee">Café</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Fonte</Label>
            <Select value={ap.font} onValueChange={v => setAp({ ...ap, font: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="inter">Inter</SelectItem><SelectItem value="poppins">Poppins</SelectItem><SelectItem value="playfair">Playfair</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end"><Button onClick={onSave}>Salvar</Button></div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// PLANO
// ============================================================
function PlanoTab({ subscription, est }: { subscription: any; est: any }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Plano atual</CardTitle><CardDescription>Faturamento e provedores serão ativados na próxima fase.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">Plano</div><div className="text-2xl font-bold capitalize">{subscription?.tier ?? est.plan}</div></div>
            <div className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">Status</div><div className="text-2xl font-bold capitalize">{subscription?.status ?? "active"}</div></div>
            <div className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">Provedor</div><div className="text-2xl font-bold">{subscription?.provider ?? "—"}</div></div>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            Em breve: escolha entre <strong>Asaas</strong>, <strong>Mercado Pago</strong> e <strong>PagHiper</strong>, com cupons, limites por plano e cobrança recorrente. A arquitetura já está pronta.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// AUDITORIA
// ============================================================
function AuditoriaTab({ establishmentId }: { establishmentId: string }) {
  const list = useServerFn(listAuditLogs);
  const { data } = useQuery({ queryKey: ["audit", establishmentId], queryFn: () => list({ data: { establishment_id: establishmentId, limit: 100 } }) });
  return (
    <Card>
      <CardHeader><CardTitle>Registro de alterações</CardTitle><CardDescription>Últimas 100 ações realizadas nesta empresa.</CardDescription></CardHeader>
      <CardContent>
        <div className="space-y-1 text-sm">
          {(data?.logs ?? []).map((l: any) => (
            <div key={l.id} className="flex items-center justify-between border-b py-2">
              <div><div className="font-mono text-xs">{l.action}</div><div className="text-xs text-muted-foreground">{l.entity_type} {l.entity_id ?? ""}</div></div>
              <div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</div>
            </div>
          ))}
          {!data?.logs?.length && <div className="text-muted-foreground">Sem registros.</div>}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// PERIGO
// ============================================================
function PerigoTab({ establishmentId, est }: { establishmentId: string; est: any }) {
  const qc = useQueryClient();
  const archive = useServerFn(archiveEstablishment);
  const restore = useServerFn(restoreEstablishment);
  const del = useServerFn(deleteEstablishment);
  const exportAll = useServerFn(exportEstablishmentData);
  const [confirmSlug, setConfirmSlug] = useState("");

  async function onArchive() {
    if (!window.confirm("Arquivar? Página pública sairá do ar.")) return;
    await archive({ data: { establishment_id: establishmentId } });
    toast.success("Empresa arquivada"); qc.invalidateQueries({ queryKey: ["est-full", establishmentId] });
  }
  async function onRestore() {
    await restore({ data: { establishment_id: establishmentId } });
    toast.success("Empresa reativada"); qc.invalidateQueries({ queryKey: ["est-full", establishmentId] });
  }
  async function onExport() {
    const res = await exportAll({ data: { establishment_id: establishmentId } });
    const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${est.slug}-export.json`; a.click(); URL.revokeObjectURL(url);
    toast.success("Exportação concluída");
  }
  async function onDelete() {
    try { await del({ data: { establishment_id: establishmentId, confirm_slug: confirmSlug } });
      toast.success("Empresa excluída"); window.location.href = "/";
    } catch (e: any) { toast.error(e.message); }
  }


  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Exportar tudo</CardTitle></CardHeader>
        <CardContent><Button onClick={onExport}><Download className="h-4 w-4 mr-1" />Baixar JSON completo</Button></CardContent>
      </Card>
      <Card className="border-warning/50">
        <CardHeader><CardTitle>Arquivar empresa</CardTitle><CardDescription>Tira a página pública do ar. Pode ser revertido.</CardDescription></CardHeader>
        <CardContent className="flex gap-2">
          {est.active ? <Button variant="outline" onClick={onArchive}><RefreshCcw className="h-4 w-4 mr-1" />Arquivar</Button>
            : <Button variant="outline" onClick={onRestore}><RefreshCcw className="h-4 w-4 mr-1" />Reativar</Button>}
        </CardContent>
      </Card>
      <Card className="border-destructive/50">
        <CardHeader><CardTitle className="text-destructive">Excluir permanentemente</CardTitle><CardDescription>Todos os clientes, carimbos e recompensas serão apagados. Ação irreversível.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          <Label>Digite o slug <span className="font-mono bg-muted px-1 rounded">{est.slug}</span> para confirmar</Label>
          <Input value={confirmSlug} onChange={e => setConfirmSlug(e.target.value)} />
          <Dialog>
            <DialogTrigger asChild><Button variant="destructive" disabled={confirmSlug !== est.slug}><Trash2 className="h-4 w-4 mr-1" />Excluir</Button></DialogTrigger>

            <DialogContent>
              <DialogHeader><DialogTitle>Excluir empresa</DialogTitle><DialogDescription>Última confirmação. Após confirmar não há como voltar.</DialogDescription></DialogHeader>
              <DialogFooter><Button variant="destructive" onClick={onDelete}>Excluir agora</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
