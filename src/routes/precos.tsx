import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/precos")({
  head: () => ({ meta: [{ title: "Preços — Fidelize" }, { name: "description", content: "Planos simples e transparentes para todos os tamanhos de negócio." }] }),
  component: () => (
    <div className="min-h-screen">
      <header className="border-b"><div className="mx-auto max-w-6xl p-4 flex justify-between items-center"><Link to="/"><Logo /></Link><Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Voltar</Link></div></header>
      <main className="mx-auto max-w-4xl p-8 prose prose-neutral">
        <h1 className="font-display text-4xl font-bold">Preços</h1>
        <p className="text-muted-foreground">Veja os detalhes completos na página inicial, seção "Planos simples e transparentes".</p>
        <Link to="/" className="text-primary font-medium">Ir para a seção de preços →</Link>
      </main>
    </div>
  ),
});
