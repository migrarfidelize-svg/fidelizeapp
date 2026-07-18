import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { myTickets } from "@/lib/helpdesk.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Ticket } from "lucide-react";

export const Route = createFileRoute("/suporte/meus")({
  head: () => ({ meta: [{ title: "Meus chamados" }] }),
  component: MyTickets,
});

const statusLabel: Record<string, string> = {
  open: "Aberto", pending: "Aguardando você", on_hold: "Em análise", solved: "Resolvido", closed: "Fechado"
};
const statusColor: Record<string, string> = {
  open: "bg-blue-100 text-blue-800", pending: "bg-yellow-100 text-yellow-900",
  on_hold: "bg-purple-100 text-purple-900", solved: "bg-green-100 text-green-800", closed: "bg-gray-100 text-gray-800"
};

function MyTickets() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | undefined>(undefined);
  const fetchTickets = useServerFn(myTickets);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user)); }, []);
  const { data, isLoading } = useQuery({ queryKey: ["my-tickets"], queryFn: () => fetchTickets(), enabled: authed === true });

  if (authed === undefined) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (authed === false) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="max-w-sm text-center">
          <Ticket className="h-12 w-12 mx-auto text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold">Meus chamados</h1>
          <p className="mt-2 text-sm text-muted-foreground">Entre com sua conta para ver seus chamados.</p>
          <Link to="/auth"><Button className="mt-4">Entrar</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-4">
          <button onClick={() => navigate({ to: "/" })} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Início</button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold">Meus chamados</h1>
        {isLoading ? <div className="mt-8 text-center text-muted-foreground">Carregando…</div> : (
          !data?.length ? (
            <div className="mt-8 text-center p-8 rounded-2xl border bg-card">
              <p className="text-muted-foreground">Você ainda não tem chamados.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-2">
              {data.map(t => (
                <Link key={t.id} to="/suporte/chamado/$id" params={{ id: t.id }} className="block p-4 rounded-xl border bg-card hover:border-primary transition">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.subject}</div>
                      <div className="text-xs text-muted-foreground">#{t.number} · atualizado {new Date(t.updated_at).toLocaleString("pt-BR")}</div>
                    </div>
                    <Badge className={statusColor[t.status] ?? ""} variant="secondary">{statusLabel[t.status] ?? t.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}
