import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { Mails as HeroIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getEmailSettings,
  saveEmailSettings,
  sendTestEmail,
  revealEmailApiKey,
  listEmailLogs,
} from "@/lib/email.functions";
import { getAdminStatus } from "@/lib/admin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Eye, EyeOff, Save, Send, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/emails")({
  head: () => ({ meta: [{ title: "E-mail (Resend) — Fidelize" }] }),
  component: EmailsPage,
});

function fmt(dt: string) {
  try { return new Date(dt).toLocaleString("pt-BR"); } catch { return dt; }
}

function EmailsPage() {
  const qc = useQueryClient();
  const getStatus = useServerFn(getAdminStatus);
  const getSettings = useServerFn(getEmailSettings);
  const save = useServerFn(saveEmailSettings);
  const test = useServerFn(sendTestEmail);
  const reveal = useServerFn(revealEmailApiKey);
  const listLogs = useServerFn(listEmailLogs);

  const { data: admin, isLoading: adminLoading } = useQuery({
    queryKey: ["admin-status"], queryFn: () => getStatus(),
  });

  const enabled = !!admin?.isAdmin;
  const { data: settings, isLoading } = useQuery({
    queryKey: ["email-settings"], queryFn: () => getSettings(), enabled,
  });
  const { data: logsData } = useQuery({
    queryKey: ["email-logs"], queryFn: () => listLogs({ data: {} }), enabled, refetchInterval: 15_000,
  });

  const [apiKey, setApiKey] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const configured = settings?.configured === true;

  useEffect(() => {
    if (settings?.configured) {
      setSenderEmail(settings.sender_email);
      setSenderName(settings.sender_name);
      setReplyTo(settings.reply_to ?? "");
    }
  }, [settings]);

  if (adminLoading) return <div className="text-muted-foreground">Verificando permissões…</div>;
  if (!admin?.isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 rounded-xl border bg-card text-center space-y-2">
        <h2 className="text-lg font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">Somente Super Administradores podem configurar o provedor de e-mail da plataforma.</p>
      </div>
    );
  }

  async function onToggleReveal() {
    if (showKey) { setShowKey(false); setApiKey(""); return; }
    try {
      const res = await reveal();
      setApiKey(res.api_key ?? "");
      setShowKey(true);
    } catch (e: any) { toast.error(e.message); }
  }

  async function onSave() {
    if (!senderEmail || !senderName) return toast.error("Preencha o remetente e o nome.");
    setSaving(true);
    try {
      await save({ data: {
        sender_email: senderEmail,
        sender_name: senderName,
        reply_to: replyTo || null,
        resend_api_key: apiKey || undefined,
      } });
      toast.success("Configuração salva");
      setApiKey(""); setShowKey(false);
      qc.invalidateQueries({ queryKey: ["email-settings"] });
    } catch (e: any) { toast.error(e.message ?? "Falha ao salvar"); }
    finally { setSaving(false); }
  }

  async function onTest() {
    if (!testTo) return toast.error("Informe o e-mail de destino do teste.");
    setTesting(true);
    try {
      const res = await test({ data: { to: testTo } });
      toast.success(`E-mail enviado (${res.duration_ms}ms)`);
      qc.invalidateQueries({ queryKey: ["email-logs"] });
    } catch (e: any) { toast.error(e.message ?? "Falha no envio"); }
    finally { setTesting(false); }
  }

  const masked = settings?.configured ? settings.api_key_masked : "—";

  return (
    <div className="space-y-6">
      <PageHero
        icon={HeroIcon}
        eyebrow={"Super Admin · E-mail"}
        title={"E-mails transacionais"}
        subtitle={"Logs de envio Resend, taxas de entrega e reprocessamento."}
      />
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
          <Mail className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Plataforma</div>
          <h1 className="font-display text-2xl font-bold">Configuração de E-mail (Resend)</h1>
          <p className="text-sm text-muted-foreground">Provedor global usado por todas as empresas da plataforma.</p>
        </div>
        <div className="ml-auto">
          {configured
            ? <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Ativa</Badge>
            : <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3.5 w-3.5" />Não configurada</Badge>}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Credenciais</CardTitle>
          <CardDescription>A API Key é armazenada apenas no backend. Deixe em branco ao salvar para manter a chave atual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>API Key do Resend</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  placeholder={configured ? masked : "re_xxxxxxxxxxxxxxxxx"}
                  value={showKey ? apiKey : (apiKey || "")}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10 font-mono text-sm"
                />
                <button type="button" onClick={onToggleReveal}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showKey ? "Ocultar" : "Revelar"}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {configured && !apiKey && (
              <p className="text-xs text-muted-foreground">Chave atual: <span className="font-mono">{masked}</span>. Digite uma nova para substituir.</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome do Remetente</Label>
              <Input placeholder="Fidelize" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail Remetente</Label>
              <Input type="email" placeholder="no-reply@seudominio.com" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Reply-To (opcional)</Label>
            <Input type="email" placeholder="suporte@seudominio.com" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={onSave} disabled={saving || isLoading} className="gap-2 gradient-brand text-primary-foreground">
              <Save className="h-4 w-4" />{saving ? "Salvando…" : "Salvar Configuração"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Testar Envio</CardTitle>
          <CardDescription>Dispara um e-mail real com a configuração salva e registra o resultado nos logs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[240px] space-y-1.5">
              <Label>Enviar para</Label>
              <Input type="email" placeholder="voce@empresa.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            </div>
            <Button onClick={onTest} disabled={testing || !configured} className="gap-2">
              <Send className="h-4 w-4" />{testing ? "Enviando…" : "Testar Envio"}
            </Button>
          </div>
          {!configured && (
            <p className="text-xs text-amber-600">Salve a configuração antes de testar.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Logs recentes</CardTitle>
              <CardDescription>Últimos 50 envios processados pela plataforma.</CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />{logsData?.logs.length ?? 0}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {(!logsData?.logs || logsData.logs.length === 0) ? (
            <p className="text-sm text-muted-foreground">Nenhum envio registrado ainda.</p>
          ) : (
            <div className="divide-y">
              {logsData.logs.map((l: any) => (
                <div key={l.id} className="py-3 flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{l.subject}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      para <span className="font-mono">{l.to_email}</span>
                      {l.template && <> · template <span className="font-mono">{l.template}</span></>}
                      {l.resend_id && <> · id <span className="font-mono">{l.resend_id}</span></>}
                    </div>
                    {l.error && <div className="text-xs text-destructive mt-1 break-all">{l.error}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <StatusBadge status={l.status} />
                    <div className="text-[11px] text-muted-foreground mt-1">{fmt(l.created_at)} · {l.duration_ms ?? 0}ms</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Toda comunicação por e-mail da plataforma — recuperação de senha, convites, notificações, cobranças — utiliza esta configuração.
        Nenhuma empresa vê ou altera essas credenciais.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sent") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Enviado</Badge>;
  if (status === "test") return <Badge className="bg-sky-500/10 text-sky-600 border-sky-500/20">Teste</Badge>;
  return <Badge variant="destructive">Falhou</Badge>;
}
