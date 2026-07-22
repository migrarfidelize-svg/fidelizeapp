import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getPublicLinkTreeBySlug } from "@/lib/linktree.functions";
import { ExternalLink, Instagram, MessageCircle, Globe, MapPin, Youtube, Facebook, Music2, Mail, Phone, Star } from "lucide-react";

const opts = (slug: string) =>
  queryOptions({
    queryKey: ["public-linktree", slug],
    queryFn: () => getPublicLinkTreeBySlug({ data: { slug } }),
  });

export const Route = createFileRoute("/links/$slug")({
  loader: async ({ params, context }) => {
    const d = await context.queryClient.ensureQueryData(opts(params.slug));
    if (!d) throw notFound();
    return d;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.establishment.name} — Links` },
          { name: "description", content: loaderData.page?.description ?? loaderData.establishment.description ?? `Links oficiais de ${loaderData.establishment.name}` },
          { property: "og:title", content: `${loaderData.establishment.name} — Links` },
          { property: "og:description", content: loaderData.page?.description ?? `Links oficiais de ${loaderData.establishment.name}` },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary" },
        ]
      : [{ title: "Não encontrado" }, { name: "robots", content: "noindex" }],
  }),
  component: PublicLinkTreePage,
  notFoundComponent: () => (
    <div className="min-h-dvh grid place-items-center p-6 text-center bg-neutral-950 text-white">
      <div>
        <h1 className="font-display text-3xl font-bold">Página não encontrada</h1>
        <p className="text-white/60 mt-2">O link pode ter sido removido ou não está publicado.</p>
        <Link to="/" className="mt-6 inline-block underline">Voltar</Link>
      </div>
    </div>
  ),
});

const KIND_ICONS: Record<string, any> = {
  whatsapp: MessageCircle,
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Music2,
  youtube: Youtube,
  site: Globe,
  google: Star,
  maps: MapPin,
  email: Mail,
  phone: Phone,
  custom: ExternalLink,
};

function normalizeUrl(kind: string, url: string) {
  const u = url.trim();
  if (kind === "whatsapp") {
    const digits = u.replace(/\D/g, "");
    if (digits && !u.startsWith("http")) return `https://wa.me/${digits}`;
  }
  if (kind === "email" && !u.startsWith("mailto:") && u.includes("@")) return `mailto:${u}`;
  if (kind === "phone" && !u.startsWith("tel:")) return `tel:${u.replace(/\s/g, "")}`;
  if (kind === "instagram" && !u.startsWith("http")) return `https://instagram.com/${u.replace(/^@/, "")}`;
  if (!/^https?:\/\//i.test(u) && !u.startsWith("mailto:") && !u.startsWith("tel:")) return `https://${u}`;
  return u;
}

function PublicLinkTreePage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(opts(slug));
  const est = data!.establishment;
  const page = data!.page;
  const links = data!.links ?? [];

  const theme = (page?.theme as Record<string, string> | null) ?? {};
  const primary = theme.primary || est.primary_color || "#0ea5e9";
  const accent = theme.accent || est.accent_color || "#8b5cf6";
  const bg = theme.background || "#0b0f19";
  const text = theme.text || "#ffffff";
  const rounded =
    theme.rounded === "sm" ? "rounded-md"
    : theme.rounded === "md" ? "rounded-lg"
    : theme.rounded === "lg" ? "rounded-xl"
    : theme.rounded === "full" ? "rounded-full"
    : "rounded-2xl";
  const buttonStyle = theme.button_style || "solid";

  const title = page?.title || est.name;
  const description = page?.description ?? est.description;
  const logo = page?.logo_url ?? est.logo_url;
  const cover = page?.cover_url ?? est.cover_url;

  const buttonClass = (i: number) => {
    const grad = `linear-gradient(135deg, ${primary} 0%, ${accent} 120%)`;
    if (buttonStyle === "outline") {
      return { style: { borderColor: primary, color: text, background: "transparent" }, className: `border-2 ${rounded}` };
    }
    if (buttonStyle === "glass") {
      return { style: { background: "rgba(255,255,255,0.08)", color: text, backdropFilter: "blur(12px)" }, className: `border border-white/15 ${rounded}` };
    }
    return { style: { background: grad, color: "#fff" }, className: rounded };
  };

  return (
    <div className="min-h-dvh w-full" style={{ background: bg, color: text }}>
      {cover && (
        <div className="h-40 w-full overflow-hidden">
          <img src={cover} alt="" className="h-full w-full object-cover opacity-60" />
        </div>
      )}
      <div className="mx-auto max-w-md px-5 pb-16 pt-8 text-center">
        {logo ? (
          <img src={logo} alt={est.name} className="mx-auto h-24 w-24 rounded-2xl object-cover ring-2 ring-white/20" />
        ) : (
          <div
            className="mx-auto grid h-24 w-24 place-items-center rounded-2xl text-3xl font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
          >
            {est.name[0]}
          </div>
        )}
        <h1 className="mt-4 font-display text-2xl font-bold">{title}</h1>
        {description && <p className="mt-2 text-sm opacity-80">{description}</p>}

        {links.length === 0 ? (
          <p className="mt-10 opacity-60 text-sm">Nenhum link disponível ainda.</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {links.map((l, i) => {
              const Icon = KIND_ICONS[l.kind] ?? ExternalLink;
              const cfg = buttonClass(i);
              return (
                <li key={l.id}>
                  <a
                    href={normalizeUrl(l.kind, l.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-3 px-5 py-4 text-sm font-semibold transition-transform active:scale-[0.97] hover:scale-[1.02] ${cfg.className}`}
                    style={cfg.style}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{l.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-12 text-[10px] uppercase tracking-widest opacity-50">
          <Link to="/">Powered by Fidelize</Link>
        </div>
      </div>
    </div>
  );
}
