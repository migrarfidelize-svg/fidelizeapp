import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as Icons from "lucide-react";
import { ArrowLeft, BookOpen, Clock } from "lucide-react";
import { getHelpCategoryBySlug } from "@/lib/help.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/ajuda/$category/")({
  head: ({ params }) => ({
    meta: [
      { title: `Ajuda: ${params.category} — Fidelize` },
      { name: "description", content: `Artigos e guias sobre ${params.category} no Fidelize.` },
    ],
  }),
  component: CategoryPage,
  errorComponent: () => <div className="p-8">Erro ao carregar categoria.</div>,
  notFoundComponent: () => <div className="p-8">Categoria não encontrada.</div>,
});

function LucideIcon({ name, className }: { name?: string | null; className?: string }) {
  const Cmp = (name && (Icons as any)[name]) || BookOpen;
  return <Cmp className={className} />;
}

function CategoryPage() {
  const { category } = Route.useParams();
  const get = useServerFn(getHelpCategoryBySlug);
  const { data } = useQuery({ queryKey: ["help-cat", category], queryFn: () => get({ data: { slug: category } }) });

  if (data === null) throw notFound();
  if (!data) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <Link to="/ajuda" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Central de ajuda
          </Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center gap-4 mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <LucideIcon name={data.category.icon} className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">{data.category.name}</h1>
            <p className="text-sm text-muted-foreground">{data.category.description}</p>
          </div>
        </div>
        <div className="grid gap-3">
          {data.articles.map((a: any) => (
            <Link key={a.slug} to="/ajuda/$category/$article" params={{ category, article: a.slug }}>
              <Card className="hover:shadow-md transition"><CardContent className="p-4">
                <div className="font-medium">{a.title}</div>
                <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.excerpt}</div>
                <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3 w-3" /> {a.reading_time} min de leitura
                </div>
              </CardContent></Card>
            </Link>
          ))}
          {data.articles.length === 0 && <p className="text-muted-foreground text-sm">Nenhum artigo publicado ainda.</p>}
        </div>
      </main>
    </div>
  );
}
