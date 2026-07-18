import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvite } from "@/lib/settings.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Aceitar convite — Fidelize" }, { name: "robots", content: "noindex" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const accept = useServerFn(acceptInvite);
  const [status, setStatus] = useState<"loading" | "need_auth" | "ready" | "accepting" | "done" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) setStatus("need_auth");
      else setStatus("ready");
    });
  }, []);

  async function onAccept() {
    setStatus("accepting");
    try {
      const res = await accept({ data: { token } });
      toast.success("Convite aceito");
      setStatus("done");
      setTimeout(() => navigate({ to: "/app" }), 800);
    } catch (e: any) {
      setError(e.message); setStatus("error");
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4 bg-muted/30">
      <Card className="max-w-md w-full">
        <CardHeader><CardTitle>Convite para equipe</CardTitle><CardDescription>Aceite para entrar no estabelecimento.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {status === "loading" && <div className="text-muted-foreground">Verificando…</div>}
          {status === "need_auth" && (
            <>
              <p className="text-sm">Você precisa entrar na sua conta primeiro.</p>
              <Button onClick={() => navigate({ to: "/auth", search: { redirect: `/invite/${token}` } as any })}>Entrar / Criar conta</Button>
            </>
          )}
          {status === "ready" && <Button onClick={onAccept} className="w-full">Aceitar convite</Button>}
          {status === "accepting" && <div className="text-muted-foreground">Processando…</div>}
          {status === "done" && <div className="text-emerald-600">Pronto! Redirecionando…</div>}
          {status === "error" && (
            <>
              <div className="text-destructive">{error}</div>
              <Button variant="outline" onClick={() => navigate({ to: "/" })}>Voltar</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
