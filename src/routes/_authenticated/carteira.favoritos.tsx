import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { getMyWallet, setWalletFavorite } from "@/lib/my-wallet.functions";
import { Heart, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_authenticated/carteira/favoritos",
)({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Favoritos — Carteira Fidelize" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WalletFavorites,
});

function WalletFavorites() {
  const queryClient = useQueryClient();

  const { data: wallet = [], isLoading } = useQuery({
    queryKey: ["my-wallet"],
    queryFn: () => getMyWallet(),
    staleTime: 15_000,
  });

  const favoriteMutation = useMutation({
    mutationFn: ({
      customerId,
      pinned,
    }: {
      customerId: string;
      pinned: boolean;
    }) =>
      setWalletFavorite({
        data: {
          customerId,
          pinned,
        },
      }),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["my-wallet"],
      });
    },

    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o favorito.",
      );
    },
  });

  const favorites = wallet.filter((item) => item.customer.pinned);

  if (isLoading) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Carregando favoritos…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3 pt-2">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Heart className="h-6 w-6 fill-current" />
        </div>

        <div>
          <h1 className="font-display text-xl font-bold">
            Favoritos
          </h1>

          <p className="text-sm text-muted-foreground">
            Seus estabelecimentos preferidos em um só lugar.
          </p>
        </div>
      </header>

      {favorites.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-border/60 bg-card/30 p-8 text-center">
          <Heart className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />

          <h2 className="font-display text-sm font-bold">
            Nenhum favorito ainda
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Favorite seus cartões para encontrá-los rapidamente aqui.
          </p>

          <Link
            to="/carteira"
            className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Voltar para minha carteira
          </Link>
        </section>
      ) : (
        <div className="grid gap-3">
          {favorites.map((item) => {
            const establishment = item.establishment as {
              slug: string;
              name: string;
              logo_url: string | null;
              primary_color: string | null;
              active: boolean;
            };

            return (
              <div
                key={item.customer.id}
                className="flex items-center gap-3 rounded-3xl border border-border/60 bg-card/40 p-4"
              >
                <Link
                  to="/carteira/$slug"
                  params={{ slug: establishment.slug }}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div
                    className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary/10 font-bold"
                    style={{
                      color: establishment.primary_color || undefined,
                    }}
                  >
                    {establishment.logo_url ? (
                      <img
                        src={establishment.logo_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      establishment.name.slice(0, 2).toUpperCase()
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm font-bold">
                      {establishment.name}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {item.card
                        ? `${item.card.stamps} carimbos`
                        : "Sem campanha ativa"}
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>

                <button
                  type="button"
                  disabled={favoriteMutation.isPending}
                  onClick={() =>
                    favoriteMutation.mutate({
                      customerId: item.customer.id,
                      pinned: false,
                    })
                  }
                  aria-label={`Remover ${establishment.name} dos favoritos`}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                >
                  <Heart className="h-5 w-5 fill-current" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}