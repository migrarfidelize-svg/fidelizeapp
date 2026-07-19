import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { toast } from "sonner";
import { getHelpArticle, trackArticleView, submitArticleFeedback } from "@/lib/help.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSkeleton } from "@/components/states";

export const Route = createFileRoute("/ajuda/$category/$article")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.article.replace(/-/g, " ")} — Fidelize Ajuda` },
    ],
  }),
  component: ArticlePage,
  errorComponent: () => <div className="p-8">Erro ao carregar artigo.</div>,
  notFoundComponent: () => <div className="p-8">Artigo não encontrado.</div>,
});

function renderMarkdown(md: string) {
  // Very light markdown: headings, bold, lists, paragraphs, links
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  let inOl = false;
  const flushList = () => {
    if (inList) { out.push("</ul>"); inList = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline">$1</a>');
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (!l.trim()) { flushList(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = l.match(/^###\s+(.*)/))) { flushList(); out.push(`<h3 class="font-semibold mt-6 mb-2">${inline(m[1])}</h3>`); continue; }
    if ((m = l.match(/^##\s+(.*)/))) { flushList(); out.push(`<h2 class="font-display text-xl font-semibold mt-8 mb-3">${inline(m[1])}</h2>`); continue; }
    if ((m = l.match(/^#\s+(.*)/))) { flushList(); out.push(`<h1 class="font-display text-2xl font-bold mt-8 mb-3">${inline(m[1])}</h1>`); continue; }
    if ((m = l.match(/^-\s+(.*)/))) {
      if (!inList) { flushList(); out.push('<ul class="list-disc pl-6 space-y-1">'); inList = true; }
      out.push(`<li>${inline(m[1])}</li>`); continue;
    }
    if ((m = l.match(/^\d+\.\s+(.*)/))) {
      if (!inOl) { flushList(); out.push('<ol class="list-decimal pl-6 space-y-1">'); inOl = true; }
      out.push(`<li>${inline(m[1])}</li>`); continue;
    }
    flushList();
    out.push(`<p class="my-3 leading-relaxed">${inline(l)}</p>`);
  }
  flushList();
  return out.join("\n");
}

function ArticlePage() {
  const { category, article } = Route.useParams();
  const get = useServerFn(getHelpArticle);
  const track = useServerFn(trackArticleView);
  const submit = useServerFn(submitArticleFeedback);
  const [feedback, setFeedback] = useState<"yes" | "no" | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  const { data } = useQuery({
    queryKey: ["help-article", category, article],
    queryFn: () => get({ data: { category, slug: article } }),
  });

  useEffect(() => {
    if (data?.article?.id) track({ data: { articleId: data.article.id } }).catch(() => {});
  }, [data?.article?.id, track]);

  const mut = useMutation({
    mutationFn: (helpful: boolean) => submit({ data: { articleId: data!.article.id, helpful, comment: comment || undefined } }),
    onSuccess: () => { setSent(true); toast.success("Obrigado pelo feedback!"); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao enviar"),
  });

  if (data === null) throw notFound();
  if (!data) return <div className="p-8"><LoadingSkeleton variant="page" /></div>;

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <Link to="/ajuda/$category" params={{ category }} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> {data.category.name}
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="text-xs uppercase text-muted-foreground">{data.category.name}</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mt-2">{data.article.title}</h1>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {data.article.reading_time} min</span>
          <span>{data.article.views ?? 0} visualizações</span>
        </div>

        <article
          className="mt-8 prose prose-sm max-w-none text-foreground"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(data.article.content) }}
        />

        <Card className="mt-10">
          <CardContent className="p-6">
            {sent ? (
              <div className="flex items-center gap-2 text-sm text-primary"><Check className="h-4 w-4" /> Obrigado! Seu feedback nos ajuda a melhorar.</div>
            ) : (
              <>
                <div className="font-medium">Este artigo foi útil?</div>
                <div className="flex gap-2 mt-3">
                  <Button variant={feedback === "yes" ? "default" : "outline"} size="sm" onClick={() => setFeedback("yes")}>
                    <ThumbsUp className="mr-2 h-4 w-4" /> Sim
                  </Button>
                  <Button variant={feedback === "no" ? "default" : "outline"} size="sm" onClick={() => setFeedback("no")}>
                    <ThumbsDown className="mr-2 h-4 w-4" /> Não
                  </Button>
                </div>
                {feedback && (
                  <div className="mt-4 space-y-2">
                    <Textarea placeholder="Conta pra gente como podemos melhorar (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} />
                    <Button size="sm" onClick={() => mut.mutate(feedback === "yes")} disabled={mut.isPending}>
                      {mut.isPending ? "Enviando…" : "Enviar feedback"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {data.related.length > 0 && (
          <div className="mt-10">
            <h2 className="font-display text-lg font-semibold mb-3">Artigos relacionados</h2>
            <div className="grid gap-2">
              {data.related.map((r: any) => (
                <Link key={r.slug} to="/ajuda/$category/$article" params={{ category, article: r.slug }}>
                  <Card className="hover:shadow-md transition"><CardContent className="p-3">
                    <div className="font-medium text-sm">{r.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{r.excerpt}</div>
                  </CardContent></Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
