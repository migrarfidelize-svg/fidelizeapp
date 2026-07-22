import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo } from "react";
import { listMyInbox, markMessagesRead } from "@/lib/inbox.functions";
import { WalletErrorState, WithOfflineFallback } from "@/components/wallet/WalletStates";
import { EmptyState } from "@/components/states/EmptyState";
import { Megaphone, Tag, Bell, ExternalLink, Inbox } from "lucide-react";

const opts = queryOptions({
  queryKey: ["my-inbox"],
  queryFn: () => listMyInbox(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/_authenticated/carteira/mensagens")({
  ssr: false,
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  head: () => ({
    meta: [
      { title: "Mensagens — Carteira Fidelize" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InboxPage,
  errorComponent: ({ error, reset }) => <WalletErrorState error={error} onRetry={reset} />,
});

const KIND_META: Record<string, { icon: typeof Megaphone; label: string; tone: string }> = {
  promo: { icon: Tag, label: "Promoção", tone: "bg-emerald-500/15 text-emerald-500" },
  novidade: { icon: Megaphone, label: "Novidade", tone: "bg-primary/15 text-primary" },
  aviso: { icon: Bell, label: "Aviso", tone: "bg-amber-500/15 text-amber-500" },
};

function InboxPage() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(opts);
  const items = data ?? [];
  const markFn = useServerFn(markMessagesRead);

  const unreadIds = useMemo(() => items.filter((m) => !m.read).map((m) => m.id), [items]);

  useEffect(() => {
    if (!unreadIds.length) return;
    // marca como lidas sempre que chegarem novas mensagens não lidas
    markFn({ data: { ids: unreadIds } })
      .then(() => {
        qc.invalidateQueries({ queryKey: ["inbox-unread"] });
        qc.invalidateQueries({ queryKey: ["my-inbox"] });
      })
      .catch(() => {});
  }, [unreadIds.join(","), markFn, qc]);

  return (
    <WithOfflineFallback onRetry={() => qc.invalidateQueries({ queryKey: ["my-inbox"] })}>
      <div className="space-y-4">
        <div className="pt-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">Mensagens</h1>
          <p className="text-sm text-muted-foreground">
            Novidades, promoções e avisos dos seus lugares favoritos.
          </p>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nenhuma mensagem ainda"
            description="Quando os estabelecimentos que você segue publicarem novidades, aparecerão aqui."
          />
        ) : (
          <ul className="space-y-3">
            {items.map((m) => {
              const est = m.establishment as {
                slug: string;
                name: string;
                logo_url: string | null;
                primary_color: string;
              };
              const meta = KIND_META[m.kind] ?? KIND_META.novidade;
              const Icon = meta.icon;
              return (
                <li
                  key={m.id}
                  className={
                    "relative overflow-hidden rounded-2xl border p-4 transition-colors " +
                    (m.read
                      ? "border-border/60 bg-card/40"
                      : "border-primary/40 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]")
                  }
                >
                  {!m.read && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-0 h-full w-1 bg-primary"
                    />
                  )}
                  <div className="flex items-start gap-3">
                    <div
                      className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-background text-sm font-bold uppercase"
                      style={{ color: est.primary_color || undefined }}
                    >
                      {est.logo_url ? (
                        <img src={est.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        est.name.slice(0, 2)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest " +
                            meta.tone
                          }
                        >
                          <Icon className="h-3 w-3" /> {meta.label}
                        </span>
                        <Link
                          to="/carteira/$slug"
                          params={{ slug: est.slug }}
                          className="truncate text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                        >
                          {est.name}
                        </Link>
                      </div>
                      <h3 className="font-display text-base font-bold leading-tight">{m.title}</h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {m.body}
                      </p>
                      {m.image_url && (
                        <img
                          src={m.image_url}
                          alt=""
                          className="mt-3 max-h-56 w-full rounded-xl object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{new Date(m.published_at).toLocaleString()}</span>
                        {m.link_url && (
                          <a
                            href={m.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                          >
                            Saiba mais <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </WithOfflineFallback>
  );
}
