import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { exportMyData, deleteMyAccount } from "@/lib/lgpd.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, ShieldCheck, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lgpd")({
  head: () => ({ meta: [{ title: "Meus Dados (LGPD) — Fidelize" }] }),
  component: LgpdPage,
});

function LgpdPage() {
  const exportFn = useServerFn(exportMyData);
  const deleteFn = useServerFn(deleteMyAccount);
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleExport() {
    setDownloading(true);
    try {
      const { json } = await exportFn();
      const blob = new Blob([JSON.stringify(JSON.parse(json), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fidelize-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado.");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao exportar.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteFn({ data: { confirmation } });
      await supabase.auth.signOut();
      toast.success("Sua conta foi excluída.");
      navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao excluir conta.");
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Privacidade</div>
        <h1 className="font-display text-3xl font-bold mt-1 flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-primary" /> Meus Dados
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Exerça seus direitos previstos na Lei Geral de Proteção de Dados (Lei 13.709/2018).
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Download className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h2 className="font-display font-semibold">Exportar meus dados</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Baixe um arquivo JSON com todos os dados vinculados à sua conta: perfil, papéis, vínculos com estabelecimentos e
                convites. Direito de acesso e portabilidade (LGPD art. 18, II e V).
              </p>
              <Button onClick={handleExport} disabled={downloading} className="mt-3">
                {downloading ? "Preparando…" : "Baixar meus dados (JSON)"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <h2 className="font-display font-semibold text-destructive">Excluir minha conta</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Ação irreversível. Remove seu perfil, papéis, vínculos com estabelecimentos e sua conta de acesso. Dados de
                estabelecimentos que você criou <strong>não</strong> são removidos — eles pertencem à empresa; transfira ou peça
                exclusão junto ao proprietário quando aplicável. Registros fiscais podem ser retidos por obrigação legal.
              </p>

              <Alert className="mt-4 bg-destructive/5 border-destructive/30">
                <AlertDescription className="text-xs">
                  Para confirmar, digite exatamente: <code className="font-mono font-semibold">EXCLUIR MINHA CONTA</code>
                </AlertDescription>
              </Alert>

              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <Input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="EXCLUIR MINHA CONTA"
                  className="font-mono"
                />
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting || confirmation !== "EXCLUIR MINHA CONTA"}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {deleting ? "Excluindo…" : "Excluir permanentemente"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Precisa de algo que não está aqui (correção, anonimização parcial, oposição a tratamento específico)? Escreva para
        <strong> dpo@fidelize.app</strong> — respondemos em até 15 dias úteis.
      </p>
    </div>
  );
}
