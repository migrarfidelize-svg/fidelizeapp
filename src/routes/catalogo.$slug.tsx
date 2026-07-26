import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MapPin, Phone, Instagram, MessageCircle, Search, ShoppingBag, X, ExternalLink } from "lucide-react";

import { getPublicMenuBySlug } from "@/lib/menu.functions";
import { trackChannelEvent, useChannelPageView } from "@/lib/tracking";
import { LazyImg } from "@/components/LazyImg";
import { resolveMenuTheme, menuBackgroundCss, readableInk } from "@/lib/menu-themes";
import { stockLabel, STOCK_STATUS } from "@/lib/showcase";
import { useCart } from "@/lib/cart";
import { CatalogCart } from "@/components/showcase/CatalogCart";

const opts = (slug: string) =>
  queryOptions({
    queryKey: ["public-catalog", slug],
    queryFn: () => getPublicMenuBySlug({ data: { slug, kind: "catalog" } }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

export const Route = createFileRoute("/catalogo/$slug")({
  loader: async ({ params, context }) => {
    const d = await context.queryClient.ensureQueryData(opts(params.slug));
    if (!d) throw notFound();
    return d;
  },
  head: ({ params, loaderData }) => {
    const url = `https://fidelizeapp.lovable.app/catalogo/${params.slug}`;
    if (!loaderData) {
      return {
        meta: [
          { title: "Catálogo não encontrado — Fidelize" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const name = loaderData.establishment.name;
    const title = `${name} — Catálogo Digital`;
    const description =
      (loaderData.menu as any)?.tagline ||
      loaderData.establishment.description ||
      `Confira o catálogo digital de ${name}: produtos, fotos e preços atualizados.`;
    const image = loaderData.establishment.cover_url || loaderData.establishment.logo_url || null;
    const absImage = image
      ? image.startsWith("http") ? image : `https://fidelizeapp.lovable.app${image}`
      : null;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:site_name", content: "Fidelize" },
        { property: "og:locale", content: "pt_BR" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(absImage
          ? [
              { property: "og:image", content: absImage },
              { property: "og:image:alt", content: `Catálogo de ${name}` },
              { name: "twitter:image", content: absImage },
            ]
          : []),
      ],
      links: [
        { rel: "canonical", href: url },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Figtree:wght@400;500;600;700&display=swap",
        },
      ],
    };
  },
  component: PublicCatalogPage,
  notFoundComponent: () => (
    <div className="min-h-dvh grid place-items-center p-6 text-center" style={{ background: "#FBF7F0", color: "#17130E" }}>
      <div>
        <h1 style={{ fontFamily: "Outfit, sans-serif" }} className="text-3xl font-bold">Catálogo indisponível</h1>
        <p className="mt-2 opacity-70">Esta loja ainda não publicou seu catálogo.</p>
        <Link to="/" className="mt-6 inline-block underline">Voltar</Link>
      </div>
    </div>
  ),
});

type Product = {
  id: string;
  name: string;
  short_desc: string | null;
  long_desc: string | null;
  price: number | null;
  promo_price: number | null;
  currency: string;
  image_url: string | null;
  category_id: string | null;
  sku?: string | null;
  brand?: string | null;
  stock_status?: string | null;
  external_url?: string | null;
  variants?: { label: string; price: number | null }[] | null;
};

function fmt(v: number | null, currency = "BRL") {
  if (v == null) return "";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
  } catch {
    return `R$ ${v.toFixed(2)}`;
  }
}

function stockTone(id?: string | null) {
  return STOCK_STATUS.find((s) => s.id === id)?.tone ?? "#6b7280";
}

function PublicCatalogPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(opts(slug));
  useChannelPageView(slug, "catalog");

  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Product | null>(null);
  const [logoErr, setLogoErr] = useState(false);
  const [sort, setSort] = useState<"rel" | "asc" | "desc" | "az">("rel");
  const [onlyPromo, setOnlyPromo] = useState(false);
  const [onlyStock, setOnlyStock] = useState(false);
  const [brand, setBrand] = useState<string | "all">("all");
  const cart = useCart(slug);


  const theme = resolveMenuTheme((data as any)?.menu?.theme);
  const T = theme.preset_def;
  const est = data?.establishment;
  const primary = theme.accent_color || T.bar || est?.primary_color || "#0F766E";
  const pageBg = menuBackgroundCss(theme, T, primary);

  const items = (data?.items ?? []) as Product[];
  const categories = (data?.categories ?? []) as { id: string; name: string }[];

  const brands = useMemo(
    () => Array.from(new Set(items.map((i) => (i.brand ?? "").trim()).filter(Boolean))).sort(),
    [items],
  );

  const priceOf = (i: Product) => i.promo_price ?? i.price ?? Number.POSITIVE_INFINITY;
  const isPromo = (i: Product) => i.promo_price != null && i.price != null && i.promo_price < i.price;
  const discountOf = (i: Product) =>
    isPromo(i) ? Math.round((1 - (i.promo_price as number) / (i.price as number)) * 100) : 0;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = items.filter((i) => {
      if (activeCat !== "all" && i.category_id !== activeCat) return false;
      if (brand !== "all" && (i.brand ?? "").trim() !== brand) return false;
      if (onlyPromo && !isPromo(i)) return false;
      if (onlyStock && i.stock_status === "out_of_stock") return false;
      if (!term) return true;
      return (
        i.name.toLowerCase().includes(term) ||
        (i.short_desc ?? "").toLowerCase().includes(term) ||
        (i.brand ?? "").toLowerCase().includes(term) ||
        (i.sku ?? "").toLowerCase().includes(term)
      );
    });
    if (sort === "asc") return [...list].sort((a, b) => priceOf(a) - priceOf(b));
    if (sort === "desc") return [...list].sort((a, b) => priceOf(b) - priceOf(a));
    if (sort === "az") return [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return list;
  }, [items, activeCat, q, sort, onlyPromo, onlyStock, brand]);

  if (!data || !data.menu) {
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-center" style={{ background: "#FBF7F0", color: "#17130E" }}>
        <div>
          <h1 style={{ fontFamily: "Outfit, sans-serif" }} className="text-3xl font-bold">Em breve</h1>
          <p className="mt-2 opacity-70">
            {data?.establishment.name ?? "Esta loja"} ainda está preparando o catálogo digital.
          </p>
        </div>
      </div>
    );
  }

  const cover = est?.cover_url || null;
  const gridCols = theme.layout === "list" ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3";

  const openProduct = (p: Product) => {
    setOpen(p);
    trackChannelEvent({ slug, channel: "catalog", event_type: "link_click", ref_id: p.id, ref_label: `item:${p.name}` });
  };

  return (
    <div
      style={{
        background: pageBg,
        color: T.ink,
        fontFamily: "Figtree, system-ui, sans-serif",
        ["--mk-surface" as any]: T.surface,
        ["--mk-line" as any]: T.line,
      }}
      className="min-h-dvh"
    >
      <style>{`
        .fx-serif { font-family: ${T.fontHead}; letter-spacing: -0.01em; }
        .fx-shadow { box-shadow: 0 1px 2px rgba(23,19,14,.06), 0 8px 24px -12px rgba(23,19,14,.18); }
        .fx-card { transition: transform .2s ease, box-shadow .2s ease; }
        .fx-card:hover { transform: translateY(-2px); box-shadow: 0 20px 40px -20px rgba(23,19,14,.25); }
        .fx-hide-scroll::-webkit-scrollbar { display:none }
        .fx-hide-scroll { scrollbar-width: none }
      `}</style>

      {/* HERO */}
      <header className="relative">
        <div
          className="h-14 sm:h-24 w-full"
          style={{
            background: cover
              ? `linear-gradient(180deg, rgba(23,19,14,0.15), rgba(23,19,14,0.55)), url(${cover}) center/cover`
              : `linear-gradient(135deg, ${primary}, #17130E)`,
          }}
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-5 -mt-8 sm:-mt-10 relative">
          <div
            className="rounded-2xl sm:rounded-3xl fx-shadow p-4 sm:p-5 flex flex-col items-center text-center gap-2"
            style={{ background: "var(--mk-surface)", border: "1px solid var(--mk-line)" }}
          >
            {est?.logo_url && !logoErr ? (
              <img
                src={est.logo_url}
                alt={est.name}
                width={80}
                height={80}
                onError={() => setLogoErr(true)}
                className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-cover"
                style={{ border: "1px solid var(--mk-line)" }}
              />
            ) : (
              <div
                className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl grid place-items-center"
                style={{ background: primary, color: readableInk(primary) }}
              >
                <ShoppingBag className="h-7 w-7" />
              </div>
            )}
            <h1 className="fx-serif text-xl sm:text-3xl font-extrabold">{est?.name}</h1>
            {((data.menu as any)?.tagline || est?.description) && (
              <p className="text-sm opacity-75 max-w-xl">
                {(data.menu as any)?.tagline || est?.description}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-xs opacity-80">
              {est?.address && (
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {est.address}</span>
              )}
              {est?.phone && (
                <a href={`tel:${est.phone}`} className="inline-flex items-center gap-1 hover:underline">
                  <Phone className="h-3.5 w-3.5" /> {est.phone}
                </a>
              )}
              {est?.whatsapp && (
                <a
                  href={`https://wa.me/${String(est.whatsapp).replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                  onClick={() => trackChannelEvent({ slug, channel: "catalog", event_type: "link_click", ref_label: "whatsapp" })}
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              )}
              {est?.instagram && (
                <a
                  href={`https://instagram.com/${String(est.instagram).replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <Instagram className="h-3.5 w-3.5" /> Instagram
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* BUSCA + COLEÇÕES */}
      <div className="max-w-4xl mx-auto px-4 sm:px-5 mt-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar produto, marca ou código..."
            className="w-full rounded-full py-2.5 pl-9 pr-4 text-sm outline-none"
            style={{ background: "var(--mk-surface)", border: "1px solid var(--mk-line)", color: T.ink }}
          />
        </div>

        {categories.length > 0 && (
          <div className="fx-hide-scroll mt-3 flex gap-2 overflow-x-auto pb-1">
            {[{ id: "all", name: "Tudo" }, ...categories].map((c) => {
              const on = activeCat === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveCat(c.id as any);
                    trackChannelEvent({ slug, channel: "catalog", event_type: "link_click", ref_id: c.id, ref_label: `category:${c.name}` });
                  }}
                  className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium"
                  style={
                    on
                      ? { background: primary, color: readableInk(primary), border: "1px solid transparent" }
                      : { background: "var(--mk-surface)", border: "1px solid var(--mk-line)", color: T.ink }
                  }
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* GRADE DE PRODUTOS */}
      <main className="max-w-4xl mx-auto px-4 sm:px-5 py-5">
        {filtered.length === 0 ? (
          <p className="py-16 text-center text-sm opacity-70">Nenhum produto encontrado.</p>
        ) : (
          <div className={`grid gap-3 ${gridCols}`}>
            {filtered.map((p) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => openProduct(p)}
                onKeyDown={(e) => { if (e.key === "Enter") openProduct(p); }}
                className="fx-card cursor-pointer overflow-hidden rounded-2xl text-left"
                style={{ background: "var(--mk-surface)", border: "1px solid var(--mk-line)" }}
              >

                <div className="aspect-square w-full overflow-hidden" style={{ background: T.line }}>
                  {p.image_url ? (
                    <LazyImg src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center opacity-40">
                      <ShoppingBag className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-3">
                  {p.brand && <div className="text-[10px] uppercase tracking-wider opacity-60">{p.brand}</div>}
                  <div className="fx-serif line-clamp-2 text-sm font-bold">{p.name}</div>
                  {p.short_desc && <p className="line-clamp-2 text-xs opacity-70">{p.short_desc}</p>}
                  <div className="flex items-baseline gap-2 pt-1">
                    {p.promo_price != null && p.price != null && p.promo_price < p.price ? (
                      <>
                        <span className="text-xs line-through opacity-50">{fmt(p.price, p.currency)}</span>
                        <span className="text-sm font-extrabold" style={{ color: primary }}>{fmt(p.promo_price, p.currency)}</span>
                      </>
                    ) : (
                      <span className="text-sm font-extrabold" style={{ color: primary }}>
                        {p.price != null ? fmt(p.price, p.currency) : "Sob consulta"}
                      </span>
                    )}
                  </div>
                  {p.stock_status && p.stock_status !== "in_stock" && (
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: `${stockTone(p.stock_status)}1a`, color: stockTone(p.stock_status) }}
                    >
                      {stockLabel(p.stock_status)}
                    </span>
                  )}

                  {p.stock_status !== "out_of_stock" && (p.price != null || p.promo_price != null) && (
                    <div className="pt-1.5" onClick={(e) => e.stopPropagation()}>
                      {cart.qtyOf(p.id) === 0 ? (
                        <button
                          onClick={() => cart.add(p.id)}
                          className="w-full rounded-full px-3 py-1.5 text-xs font-bold"
                          style={{ background: primary, color: readableInk(primary) }}
                        >
                          Adicionar
                        </button>
                      ) : (
                        <div className="flex items-center justify-between rounded-full px-1 py-1" style={{ border: `1px solid ${primary}` }}>
                          <button
                            onClick={() => cart.setQty(p.id, cart.qtyOf(p.id) - 1)}
                            aria-label="Diminuir"
                            className="grid h-6 w-6 place-items-center rounded-full text-sm font-bold"
                            style={{ color: primary }}
                          >
                            −
                          </button>
                          <span className="text-xs font-bold">{cart.qtyOf(p.id)}</span>
                          <button
                            onClick={() => cart.add(p.id)}
                            aria-label="Aumentar"
                            className="grid h-6 w-6 place-items-center rounded-full text-sm font-bold"
                            style={{ background: primary, color: readableInk(primary) }}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            ))}
          </div>
        )}
      </main>

      <footer className="pb-28 text-center text-[11px] opacity-60">
        Catálogo digital por <Link to="/" className="underline">Fidelize</Link>
      </footer>

      {/* DETALHE DO PRODUTO */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
          onClick={() => setOpen(null)}
        >
          <div
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            style={{ background: "var(--mk-surface)", color: T.ink }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              {open.image_url ? (
                <img src={open.image_url} alt={open.name} className="aspect-square w-full object-cover" />
              ) : (
                <div className="grid aspect-video w-full place-items-center opacity-40" style={{ background: T.line }}>
                  <ShoppingBag className="h-10 w-10" />
                </div>
              )}
              <button
                onClick={() => setOpen(null)}
                aria-label="Fechar"
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-5">
              {open.brand && <div className="text-[11px] uppercase tracking-wider opacity-60">{open.brand}</div>}
              <h2 className="fx-serif text-xl font-extrabold">{open.name}</h2>
              <div className="flex items-baseline gap-2">
                {open.promo_price != null && open.price != null && open.promo_price < open.price ? (
                  <>
                    <span className="text-sm line-through opacity-50">{fmt(open.price, open.currency)}</span>
                    <span className="text-2xl font-extrabold" style={{ color: primary }}>{fmt(open.promo_price, open.currency)}</span>
                  </>
                ) : (
                  <span className="text-2xl font-extrabold" style={{ color: primary }}>
                    {open.price != null ? fmt(open.price, open.currency) : "Sob consulta"}
                  </span>
                )}
              </div>
              {open.stock_status && (
                <span
                  className="inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{ background: `${stockTone(open.stock_status)}1a`, color: stockTone(open.stock_status) }}
                >
                  {stockLabel(open.stock_status)}
                </span>
              )}
              {open.short_desc && <p className="text-sm opacity-80">{open.short_desc}</p>}
              {open.long_desc && <p className="whitespace-pre-line text-sm opacity-70">{open.long_desc}</p>}

              {Array.isArray(open.variants) && open.variants.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] uppercase tracking-wider opacity-60">Variações</div>
                  <div className="flex flex-wrap gap-2">
                    {open.variants.map((v, i) => (
                      <span key={i} className="rounded-full px-2.5 py-1 text-xs" style={{ border: "1px solid var(--mk-line)" }}>
                        {v.label}{v.price != null ? ` · ${fmt(v.price, open.currency)}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {open.sku && <div className="text-xs opacity-60">Código: {open.sku}</div>}

              <div className="flex flex-wrap gap-2 pt-2">
                {open.external_url && (
                  <a
                    href={open.external_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackChannelEvent({ slug, channel: "catalog", event_type: "link_click", ref_id: open.id, ref_label: `buy:${open.name}` })}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
                    style={{ background: primary, color: readableInk(primary) }}
                  >
                    <ExternalLink className="h-4 w-4" /> Comprar
                  </a>
                )}
                {est?.whatsapp && (
                  <a
                    href={`https://wa.me/${String(est.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Tenho interesse no produto "${open.name}".`)}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackChannelEvent({ slug, channel: "catalog", event_type: "link_click", ref_id: open.id, ref_label: `whatsapp:${open.name}` })}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
                    style={{ border: `1px solid ${primary}`, color: primary }}
                  >
                    <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
                  </a>
                )}
              </div>

              {open.stock_status !== "out_of_stock" && (open.price != null || open.promo_price != null) && (
                <button
                  onClick={() => { cart.add(open.id); setOpen(null); }}
                  className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold"
                  style={{ background: primary, color: readableInk(primary) }}
                >
                  <ShoppingBag className="h-4 w-4" /> Adicionar ao carrinho
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <CatalogCart
        slug={slug}
        items={items as any}
        cart={cart}
        primary={primary}
        ink={readableInk(primary)}
        whatsapp={est?.whatsapp ?? null}
      />
    </div>
  );
}

