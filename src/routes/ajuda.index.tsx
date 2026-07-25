import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import * as Icons from "lucide-react";
import { Search, ArrowRight, BookOpen, LifeBuoy } from "lucide-react";
import { listHelpCategories, searchHelp } from "@/lib/help.functions";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/ajuda/")({
  head: () => ({
    meta: [
      { title: "Central de Ajuda — Fidelize" },
      { name: "description", content: "Guias, artigos e respostas oficiais para dominar o Fidelize e evoluir seu programa de fidelidade." },
      { property: "og:title", content: "Central de Ajuda — Fidelize" },
      { property: "og:description", content: "Guias, artigos e respostas oficiais para dominar o Fidelize." },
    ],
  }),
  component: HelpHome,
});

function LucideIcon({ name, className }: { name?: string | null; className?: string }) {
  const Cmp = (name && (Icons as any)[name]) || BookOpen;
  return <Cmp className={className} />;
}

function HelpHome() {
  const list = useServerFn(listHelpCategories);
  const search = useServerFn(searchHelp);
  const [q, setQ] = useState("");
  const { data: categories = [] } = useQuery({ queryKey: ["help-categories"], queryFn: () => list() });
  const { data: results = [] } = useQuery({
    queryKey: ["help-search", q],
    queryFn: () => search({ data: { q } }),
    enabled: q.trim().length >= 2,
  });

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-2">
            <Link to="/app/fidelize"><Button variant="outline" size="sm"><LifeBuoy className="mr-2 h-4 w-4" />Falar com suporte</Button></Link>
          </div>
        </div>
      </header>

      <section className="border-b bg-gradient-to-b from-primary-soft/40 to-transparent">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Como podemos ajudar?</h1>
          <p className="mt-3 text-muted-foreground">Guias, respostas e boas práticas para você aproveitar 100% do Fidelize.</p>
          <div className="mt-6 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por dúvida, ex: carimbar cliente, QR Code, cancelar"
              className="pl-12 h-14 text-base rounded-2xl"
            />
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {q.trim().length >= 2 ? (
          <div>
            <h2 className="font-display text-xl font-semibold mb-4">Resultados para "{q}"</h2>
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum artigo encontrado. Tente outros termos ou <Link to="/app/fidelize" className="text-primary underline">abra um ticket</Link>.</p>
            ) : (
              <div className="grid gap-3">
                {results.map((r: any) => (
                  <Link key={`${r.category?.slug}/${r.slug}`} to="/ajuda/$category/$article" params={{ category: r.category.slug, article: r.slug }}>
                    <Card className="hover:shadow-md transition"><CardContent className="p-4">
                      <div className="text-xs uppercase text-muted-foreground">{r.category?.name}</div>
                      <div className="font-medium mt-1">{r.title}</div>
                      <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.excerpt}</div>
                    </CardContent></Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="font-display text-xl font-semibold mb-4">Explore por categoria</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c: any) => (
                <Link key={c.slug} to="/ajuda/$category" params={{ category: c.slug }}>
                  <Card className="hover:shadow-lg hover:-translate-y-0.5 transition h-full">
                    <CardContent className="p-6">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                        <LucideIcon name={c.icon} className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 font-semibold">{c.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                      <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
                        {c.article_count} artigo{c.article_count === 1 ? "" : "s"} <ArrowRight className="h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
