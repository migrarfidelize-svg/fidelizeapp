import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { inviteTeamMember } from "@/lib/settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Copy, Send, Mail, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Fidelize" }] }),
  component: EquipePage,
});

function EquipePage() {
  const getEsts = useServerFn(getMyEstablishments);
  const invite = useServerFn(inviteTeamMember);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as { id: string; name: string } | undefined;

  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onInvite() {
    if (!est) return;
    const e = email.trim().toLowerCase();
    if (!e || !/^\S+@\S+\.\S+$/.test(e)) return toast.error("Informe um e-mail válido");
    setLoading(true);
    try {
      const res = await invite({ data: { establishment_id: est.id, email: e, role: "staff" } });
      const url = `${window.location.origin}/invite/${res.token}`;
      setIssuedLink(url);
      setEmail("");
      toast.success("Convite gerado");
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

  if (!est) return <div className="text-muted-foreground">Carregando…</div>;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Colaboradores</div>
        <h1 className="font-display text-2xl font-bold">Adicionar atendente</h1>
        <p className="text-sm text-muted-foreground">Envie um convite para um novo atendente operar o cartão fidelidade de {est.name}.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" />Novo atendente</CardTitle>
          <CardDescription>O atendente poderá carimbar clientes após aceitar o convite.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>E-mail do atendente</Label>
            <Input type="email" placeholder="atendente@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Mensagem (opcional)</Label>
            <Textarea rows={2} placeholder="Olá! Aceite o convite para começar a operar o cartão fidelidade." value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button onClick={onInvite} disabled={loading} className="gap-2 gradient-brand text-primary-foreground">
            <UserPlus className="h-4 w-4" />{loading ? "Gerando…" : "Gerar convite"}
          </Button>

          {issuedLink && (
            <div className="rounded-xl border bg-emerald-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Link pronto para envio
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={issuedLink} className="font-mono text-xs" />
                <Button size="icon" variant="secondary" onClick={() => copyLink(issuedLink)}><Copy className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="gap-1">
                  <a href={`https://wa.me/?text=${encodeURIComponent((note ? note + "\n\n" : "") + issuedLink)}`} target="_blank" rel="noreferrer">
                    <Send className="h-3.5 w-3.5" />Enviar por WhatsApp
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline" className="gap-1">
                  <a href={`mailto:?subject=${encodeURIComponent("Convite para a equipe")}&body=${encodeURIComponent((note ? note + "\n\n" : "") + issuedLink)}`}>
                    <Mail className="h-3.5 w-3.5" />Enviar por e-mail
                  </a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Para gerenciar membros existentes, funções e permissões, acesse o painel do administrador.</p>
    </div>
  );
}
