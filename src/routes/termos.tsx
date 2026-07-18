import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/termos")({
  head: () => ({ meta: [{ title: "Termos de Uso — Fidelize" }] }),
  component: () => (
    <div className="min-h-screen">
      <header className="border-b"><div className="mx-auto max-w-4xl p-4"><Link to="/"><Logo /></Link></div></header>
      <main className="mx-auto max-w-3xl p-8 space-y-4 text-sm text-muted-foreground">
        <h1 className="font-display text-3xl font-bold text-foreground">Termos de Uso</h1>
        <p>Bem-vindo ao Fidelize. Ao utilizar nossa plataforma, você concorda com estes termos. Você é responsável por seu conteúdo e uso adequado. Reservamo-nos o direito de suspender contas que violem estas regras. Este é um resumo inicial; a versão completa será publicada em breve.</p>
      </main>
    </div>
  ),
});
