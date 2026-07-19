import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getHelpCenter, searchArticles } from "@/lib/helpdesk.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MessageCircle, BookOpen, HelpCircle, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/suporte/$slug/")({
  head: ({ params }) => ({
    meta: [
      { title: `Central de Ajuda — ${params.slug}` },
      { name: "description", content: "Encontre respostas rápidas ou abra um chamado." },
    ],
  }),
  loader: ({ params }) => getHelpCenter({ data: { slug: params.slug } }),
  errorComponent: ({ error, reset }) => (
    <div className="p-8 text-center"><p>Erro: {error.message}</p><Button onClick={reset}>Tentar novamente</Button></div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">Central não encontrada</div>,
  component: HelpCenterHub,
});

function HelpCenterHub() {
  const data = Route.useLoaderData();
  const params = Route.useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const search = useServerFn(searchArticles);
  const { establishment, categories, articles } = data;
  const { data: results } = useQuery({
    queryKey: ["kb-search", establishment.id, q],
    queryFn: () => q.length >= 2 ? search({ data: { establishment_id: establishment.id, q } }) : Promise.resolve([]),
    enabled: q.length >= 2,
  });


  return (
    <div className="min-h-dvh bg-gradient-to-b from-primary-soft/40 to-background">
      <header className="border-b bg-background/70 backdrop-blur">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            {establishment.logo_url && <img src={establishment.logo_url} alt="" className="h-9 w-9 rounded-full object-cover" />}
            <div>
              <div className="font-semibold">{establishment.name}</div>
              <div className="text-xs text-muted-foreground">Central de ajuda</div>
            </div>
          </div>
          <Link to="/suporte/meus" className="text-sm font-medium text-primary hover:underline">Meus chamados</Link>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 pt-14 pb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Como podemos ajudar?</h1>
        <p className="mt-3 text-muted-foreground">Busque na base de conhecimento ou abra um chamado.</p>
        <div className="relative mt-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Descreva sua dúvida…" className="pl-12 h-14 text-base rounded-2xl shadow-sm" />
        </div>
        {q.length >= 2 && (
          <div className="mt-3 text-left bg-card rounded-xl border shadow-lg overflow-hidden">
            {(results ?? []).length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Nada encontrado. <button onClick={() => navigate({ to: "/suporte/$slug/novo", params, search: { assunto: q } })} className="text-primary underline">Abrir chamado</button></div>
            ) : (results ?? []).map((r) => (
              <Link key={r.id} to="/suporte/$slug/kb/$article" params={{ slug: params.slug, article: r.slug }} className="flex items-start gap-3 p-4 hover:bg-muted/50 border-b last:border-b-0">
                <BookOpen className="h-4 w-4 mt-0.5 text-primary" />
                <div>
                  <div className="font-medium text-sm">{r.title}</div>
                  {r.excerpt && <div className="text-xs text-muted-foreground line-clamp-1">{r.excerpt}</div>}
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/suporte/$slug/novo" params={params} search={{ assunto: "" }}><Button size="lg" className="rounded-full"><MessageCircle className="mr-2 h-4 w-4" />Abrir chamado</Button></Link>
          <Link to="/suporte/meus"><Button size="lg" variant="outline" className="rounded-full">Ver meus chamados</Button></Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-16">
        {categories.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            {categories.map((c: { id: string; name: string; description: string | null }) => {
              const catArts = articles.filter((a: { category_id: string | null }) => a.category_id === c.id);
              return (
                <div key={c.id} className="rounded-2xl bg-card border p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-lg bg-primary-soft grid place-items-center"><HelpCircle className="h-4 w-4 text-primary" /></div>
                    <h3 className="font-semibold">{c.name}</h3>
                  </div>
                  {c.description && <p className="text-xs text-muted-foreground mb-3">{c.description}</p>}
                  <ul className="space-y-1.5">
                    {catArts.slice(0, 5).map((a: { id: string; slug: string; title: string }) => (
                      <li key={a.id}>
                        <Link to="/suporte/$slug/kb/$article" params={{ slug: params.slug, article: a.slug }} className="text-sm text-muted-foreground hover:text-primary flex items-center justify-between group">
                          <span className="truncate">{a.title}</span>
                          <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
        {categories.length === 0 && articles.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {articles.slice(0, 10).map((a: { id: string; slug: string; title: string; excerpt: string | null }) => (
              <Link key={a.id} to="/suporte/$slug/kb/$article" params={{ slug: params.slug, article: a.slug }} className="p-4 rounded-xl border bg-card hover:border-primary transition">
                <div className="font-medium text-sm">{a.title}</div>
                {a.excerpt && <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{a.excerpt}</div>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
