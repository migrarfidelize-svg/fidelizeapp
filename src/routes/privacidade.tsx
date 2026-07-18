import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Política de Privacidade — Fidelize" }] }),
  component: () => (
    <div className="min-h-screen">
      <header className="border-b"><div className="mx-auto max-w-4xl p-4"><Link to="/"><Logo /></Link></div></header>
      <main className="mx-auto max-w-3xl p-8 space-y-4 text-sm text-muted-foreground">
        <h1 className="font-display text-3xl font-bold text-foreground">Política de Privacidade</h1>
        <p>Coletamos apenas os dados necessários para operar o serviço, em conformidade com a LGPD. Você pode solicitar exclusão ou exportação a qualquer momento. Não vendemos seus dados a terceiros. Esta é uma versão inicial; a versão completa será publicada em breve.</p>
      </main>
    </div>
  ),
});
