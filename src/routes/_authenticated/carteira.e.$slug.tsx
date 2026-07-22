import { createFileRoute } from "@tanstack/react-router";
import { DiscoveryProfilePage, discoveryProfileOpts } from "@/routes/e.$slug";

export const Route = createFileRoute("/_authenticated/carteira/e/$slug")({
  ssr: false,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(discoveryProfileOpts(params.slug)),
  component: DiscoveryProfilePage,
});
