import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getArticle, submitArticleFeedback } from "@/lib/helpdesk.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ThumbsUp, ThumbsDown, MessageCircle, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/suporte/$slug/kb/$article")({
  loader: ({ params }) => getArticle({ data: { slug: params.slug, article_slug: params.article } }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `${loaderData.article.title} — ${loaderData.establishment.name}` },
      { name: "description", content: loaderData.article.excerpt ?? loaderData.article.title },
    ] : [{ title: "Artigo não encontrado" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => <div className="p-8 text-center">Artigo não encontrado</div>,
  errorComponent: ({ error, reset }) => (<div className="p-8 text-center"><p>Erro: {error.message}</p><Button onClick={reset}>Tentar novamente</Button></div>),
  component: ArticlePage,
});

function ArticlePage() {
  const data = Route.useLoaderData();
  const params = Route.useParams();
  const feedback = useServerFn(submitArticleFeedback);
  const [given, setGiven] = useState<null | boolean>(null);

  if (!data) return null;
  const { article, establishment, related } = data;

  async function send(helpful: boolean) {
    setGiven(helpful);
    try { await feedback({ data: { article_id: article.id, helpful } }); } catch { /* ignore */ }
    toast.success(helpful ? "Obrigado pelo feedback!" : "Vamos melhorar este conteúdo.");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/suporte/$slug" params={{ slug: params.slug }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> {establishment.name}</Link>
          <Link to="/suporte/$slug/novo" params={{ slug: params.slug }} search={{ assunto: "" }}><Button size="sm" variant="outline"><MessageCircle className="mr-2 h-3.5 w-3.5" />Abrir chamado</Button></Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{article.title}</h1>
        {article.excerpt && <p className="mt-3 text-lg text-muted-foreground">{article.excerpt}</p>}
        <div className="mt-2 text-xs text-muted-foreground">{article.views + 1} visualizações · Atualizado em {new Date(article.updated_at).toLocaleDateString("pt-BR")}</div>
        <article className="prose prose-neutral dark:prose-invert max-w-none mt-8" dangerouslySetInnerHTML={{ __html: article.body_html }} />

        <div className="mt-10 p-5 rounded-2xl border bg-card">
          <div className="text-sm font-medium mb-3">Esse artigo foi útil?</div>
          {given === null ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => send(true)}><ThumbsUp className="mr-2 h-4 w-4" />Sim</Button>
              <Button variant="outline" size="sm" onClick={() => send(false)}><ThumbsDown className="mr-2 h-4 w-4" />Não</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-primary" /> Obrigado!</div>
          )}
        </div>

        {related.length > 0 && (
          <div className="mt-10">
            <h2 className="font-semibold mb-3">Artigos relacionados</h2>
            <ul className="space-y-2">
              {related.map((r: { id: string; slug: string; title: string }) => (
                <li key={r.id}>
                  <Link to="/suporte/$slug/kb/$article" params={{ slug: params.slug, article: r.slug }} className="text-sm text-primary hover:underline">{r.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
