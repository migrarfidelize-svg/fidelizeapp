import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, MessageCircle, BookOpen, LifeBuoy, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export type SupportNavCategory = { id: string; name: string; slug?: string | null };

type Props = {
  slug: string;
  name: string;
  logoUrl?: string | null;
  categories?: SupportNavCategory[];
};

export function SupportHeader({ slug, name, logoUrl, categories = [] }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
        <Link
          to="/suporte/$slug"
          params={{ slug }}
          className="flex min-w-0 items-center gap-3"
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft">
              <LifeBuoy className="h-4 w-4 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate font-semibold leading-tight">{name}</div>
            <div className="text-xs text-muted-foreground">Central de ajuda</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link
            to="/suporte/$slug"
            params={{ slug }}
            activeOptions={{ exact: true }}
            activeProps={{ className: "text-foreground font-medium" }}
            className="transition-colors hover:text-foreground"
          >
            Base de conhecimento
          </Link>
          <Link
            to="/suporte/meus"
            activeProps={{ className: "text-foreground font-medium" }}
            className="transition-colors hover:text-foreground"
          >
            Meus chamados
          </Link>
          <Link to="/" className="transition-colors hover:text-foreground">
            Ir para o site
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/suporte/$slug/novo" params={{ slug }} search={{ assunto: "" }} className="hidden sm:block">
            <Button size="sm" className="rounded-full">
              <MessageCircle className="mr-2 h-3.5 w-3.5" />
              Abrir chamado
            </Button>
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menu" className="rounded-full md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-xs overflow-y-auto">
              <SheetHeader className="text-left">
                <SheetTitle className="truncate">{name}</SheetTitle>
              </SheetHeader>

              <nav className="mt-6 flex flex-col gap-1">
                <Link
                  to="/suporte/$slug"
                  params={{ slug }}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted"
                >
                  <BookOpen className="h-4 w-4 text-primary" /> Base de conhecimento
                </Link>
                <Link
                  to="/suporte/$slug/novo"
                  params={{ slug }}
                  search={{ assunto: "" }}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted"
                >
                  <MessageCircle className="h-4 w-4 text-primary" /> Abrir chamado
                </Link>
                <Link
                  to="/suporte/meus"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted"
                >
                  <LifeBuoy className="h-4 w-4 text-primary" /> Meus chamados
                </Link>
                <Link
                  to="/"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted"
                >
                  <Home className="h-4 w-4 text-primary" /> Ir para o site
                </Link>
              </nav>

              {categories.length > 0 && (
                <div className="mt-6 border-t pt-4">
                  <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Categorias
                  </div>
                  <div className="flex flex-col">
                    {categories.map((c) => (
                      <a
                        key={c.id}
                        href={`#cat-${c.id}`}
                        onClick={() => setOpen(false)}
                        className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {c.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
