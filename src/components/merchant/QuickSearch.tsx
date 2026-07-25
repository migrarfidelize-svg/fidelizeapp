import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Search, User, ArrowRight, Loader2, Stamp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchCustomer } from "@/lib/loyalty.functions";

export const QUICK_SEARCH_KEY = "fidelize:quick-search-q";

type NavTarget = { to: string; label: string };

/**
 * Busca rápida global do painel: acha cliente por nome, telefone ou código de
 * qualquer tela e também navega para as páginas do menu.
 * Atalhos: Ctrl/⌘+K para abrir, Esc para fechar.
 */
export function QuickSearch({
  establishmentId,
  navTargets,
}: {
  establishmentId?: string | null;
  navTargets: NavTarget[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const navigate = useNavigate();
  const search = useServerFn(searchCustomer);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ["quick-search", establishmentId, term],
    queryFn: () => search({ data: { establishment_id: establishmentId!, query: term } }),
    enabled: open && !!establishmentId && term.length >= 2,
    staleTime: 15_000,
  });

  const customers = (data as { customers?: Array<{ id: string; name: string | null; phone: string | null; code: string | null }> } | undefined)?.customers ?? [];

  const pages = useMemo(() => {
    const needle = term.toLowerCase();
    if (!needle) return navTargets.slice(0, 6);
    return navTargets.filter((n) => n.label.toLowerCase().includes(needle)).slice(0, 6);
  }, [navTargets, term]);

  function goStamp(code: string | null, name: string | null) {
    try { sessionStorage.setItem(QUICK_SEARCH_KEY, code || name || ""); } catch { /* noop */ }
    setOpen(false);
    navigate({ to: "/app/carimbar" });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Busca rápida"
        className="h-9 gap-2 border-primary/25 px-2 sm:px-3"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden text-xs text-muted-foreground sm:inline">Buscar cliente</span>
        <kbd className="hidden rounded border px-1 text-[10px] text-muted-foreground lg:inline">⌘K</kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Busca rápida</DialogTitle>
            <DialogDescription>Cliente por nome, telefone ou código — ou uma página do painel.</DialogDescription>
          </DialogHeader>

          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex.: Maria, 11999..., ABC123"
            aria-label="Termo de busca"
          />

          <div className="max-h-[50vh] space-y-4 overflow-y-auto">
            {establishmentId && term.length >= 2 && (
              <div>
                <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Clientes {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
                </p>
                {customers.length === 0 && !isFetching ? (
                  <p className="px-1 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
                ) : (
                  <ul className="space-y-1">
                    {customers.map((c) => (
                      <li key={c.id}>
                        <button
                          onClick={() => goStamp(c.code, c.name)}
                          className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left hover:border-primary/30 hover:bg-primary/5"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <User className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{c.name || "Sem nome"}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {[c.phone, c.code].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <Stamp className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Páginas</p>
              <ul className="space-y-1">
                {pages.map((p) => (
                  <li key={p.to}>
                    <button
                      onClick={() => { setOpen(false); navigate({ to: p.to }); }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="truncate">{p.label}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
