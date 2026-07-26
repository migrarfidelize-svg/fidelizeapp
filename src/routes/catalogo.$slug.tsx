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
import { ProductDetail } from "@/components/showcase/ProductDetail";


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
  gallery?: string[] | null;

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
  const categories = (data?.categories ?? []) as {
    id: string;
    name: string;
    description?: string | null;
    image_url?: string | null;
  }[];

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
  // Catálogo é vitrine: mesmo no tema "lista" mantemos grade (só mais densa).
  const gridCols =
    theme.layout === "list"
      ? "grid-cols-2 md:grid-cols-4 xl:grid-cols-5"
      : "grid-cols-2 md:grid-cols-3 xl:grid-cols-4";

  const openProduct = (p: Product) => {
    setOpen(p);
    trackChannelEvent({ slug, channel: "catalog", event_type: "link_click", ref_id: p.id, ref_label: `item:${p.name}` });
  };

  const showRows =
    activeCat === "all" &&
    !q.trim() &&
    !onlyPromo &&
    !onlyStock &&
    brand === "all" &&
    sort === "rel" &&
    categories.length > 1;

  const rows = !showRows
    ? []
    : categories
        .map((c) => ({ cat: c, list: filtered.filter((i) => i.category_id === c.id) }))
        .filter((r) => r.list.length > 0);

  const looseItems = showRows
    ? filtered.filter((i) => !categories.some((c) => c.id === i.category_id))
    : [];

  const renderCard = (p: Product, variant: "grid" | "row" = "grid") => {
    const out = p.stock_status === "out_of_stock";
    const off = discountOf(p);
    return (
      <div
        key={p.id}
        role="button"
        tabIndex={0}
        onClick={() => openProduct(p)}
        onKeyDown={(e) => { if (e.key === "Enter") openProduct(p); }}
        className={`fx-card group flex cursor-pointer flex-col overflow-hidden rounded-xl text-left ${
          variant === "row" ? "w-[46vw] shrink-0 snap-start sm:w-[210px]" : ""
        }`}
        style={{ background: "var(--mk-surface)", border: "1px solid var(--mk-line)" }}
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden" style={{ background: T.line }}>
          {p.image_url ? (
            <LazyImg src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center opacity-40">
              <ShoppingBag className="h-8 w-8" />
            </div>
          )}
          {off > 0 && !out && (
            <span
              className="absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold"
              style={{ background: primary, color: readableInk(primary) }}
            >
              -{off}%
            </span>
          )}
          {out && (
            <div className="absolute inset-0 grid place-items-center bg-black/45">
              <span className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-extrabold text-black">Esgotado</span>
            </div>
          )}
          {!out && p.stock_status && p.stock_status !== "in_stock" && (
            <span
              className="absolute bottom-2 left-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ background: `${stockTone(p.stock_status)}e6`, color: "#fff" }}
            >
              {stockLabel(p.stock_status)}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1 p-3">
          {p.brand && <div className="text-[10px] uppercase tracking-wider opacity-55">{p.brand}</div>}
          <div className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</div>
          {p.short_desc && <p className="line-clamp-1 text-xs opacity-60">{p.short_desc}</p>}

          <div className="mt-auto pt-2">
            {off > 0 && <div className="text-[11px] line-through opacity-45">{fmt(p.price, p.currency)}</div>}
            <div className="text-base font-extrabold leading-tight" style={{ color: primary }}>
              {p.promo_price != null || p.price != null
                ? fmt(p.promo_price ?? p.price, p.currency)
                : "Sob consulta"}
            </div>
            {(p.promo_price ?? p.price ?? 0) >= 30 && (
              <div className="text-[10px] opacity-55">
                ou 3x de {fmt((p.promo_price ?? p.price!) / 3, p.currency)}
              </div>
            )}
          </div>

          {!out && (p.price != null || p.promo_price != null) && (
            <div className="pt-2" onClick={(e) => e.stopPropagation()}>
              {cart.qtyOf(p.id) === 0 ? (
                <button
                  onClick={() => cart.add(p.id)}
                  className="w-full rounded-lg px-3 py-2 text-xs font-bold"
                  style={{ background: primary, color: readableInk(primary) }}
                >
                  Adicionar
                </button>
              ) : (
                <div className="flex items-center justify-between rounded-lg px-1 py-1" style={{ border: `1px solid ${primary}` }}>
                  <button
                    onClick={() => cart.setQty(p.id, cart.qtyOf(p.id) - 1)}
                    aria-label="Diminuir"
                    className="grid h-6 w-6 place-items-center rounded-md text-sm font-bold"
                    style={{ color: primary }}
                  >
                    −
                  </button>
                  <span className="text-xs font-bold">{cart.qtyOf(p.id)}</span>
                  <button
                    onClick={() => cart.add(p.id)}
                    aria-label="Aumentar"
                    className="grid h-6 w-6 place-items-center rounded-md text-sm font-bold"
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
    );
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
        .fx-card { transition: border-color .2s ease, box-shadow .2s ease; }
        .fx-card:hover { box-shadow: 0 18px 36px -24px rgba(23,19,14,.45); }
        .fx-card img { transition: transform .45s cubic-bezier(.2,.7,.3,1); }
        .fx-card:hover img { transform: scale(1.06); }
        .fx-hide-scroll::-webkit-scrollbar { display:none }
        .fx-hide-scroll { scrollbar-width: none }
        .fx-blur { backdrop-filter: saturate(140%) blur(10px); }
      `}</style>

      {/* TOPBAR DA LOJA */}
      <header
        className="fx-blur sticky top-0 z-30"
        style={{ background: `color-mix(in oklab, ${T.surface} 88%, transparent)`, borderBottom: "1px solid var(--mk-line)" }}
      >
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            {est?.logo_url && !logoErr ? (
              <img
                src={est.logo_url}
                alt={est.name}
                width={40}
                height={40}
                onError={() => setLogoErr(true)}
                className="h-9 w-9 shrink-0 rounded-lg object-cover sm:h-10 sm:w-10"
                style={{ border: "1px solid var(--mk-line)" }}
              />
            ) : (
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg sm:h-10 sm:w-10"
                style={{ background: primary, color: readableInk(primary) }}
              >
                <ShoppingBag className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold leading-tight sm:text-base">{est?.name}</div>
              <div className="truncate text-[11px] opacity-60">Catálogo digital · {items.length} produtos</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {est?.instagram && (
              <a
                href={`https://instagram.com/${String(est.instagram).replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="grid h-9 w-9 place-items-center rounded-full"
                style={{ border: "1px solid var(--mk-line)" }}
              >
                <Instagram className="h-4 w-4" />
              </a>
            )}
            {est?.whatsapp && (
              <a
                href={`https://wa.me/${String(est.whatsapp).replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold"
                style={{ background: primary, color: readableInk(primary) }}
                onClick={() => trackChannelEvent({ slug, channel: "catalog", event_type: "link_click", ref_label: "whatsapp" })}
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Falar com a loja</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* VITRINE / HERO DE COLEÇÃO */}
      <section className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
        <div
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl"
          style={{
            background: cover
              ? `linear-gradient(90deg, rgba(23,19,14,.78), rgba(23,19,14,.25)), url(${cover}) center/cover`
              : `linear-gradient(120deg, ${primary}, color-mix(in oklab, ${primary} 35%, #17130E))`,
            color: "#fff",
          }}
        >
          <div className="max-w-xl px-5 py-7 sm:px-8 sm:py-12">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider">
              <ShoppingBag className="h-3 w-3" /> Loja online
            </span>
            <h1 className="fx-serif mt-3 text-2xl font-extrabold leading-tight sm:text-4xl">
              {(data.menu as any)?.tagline || `Produtos de ${est?.name}`}
            </h1>
            {est?.description && (
              <p className="mt-2 line-clamp-2 text-sm opacity-85 sm:text-base">{est.description}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] opacity-85 sm:text-xs">
              {est?.address && (
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {est.address}</span>
              )}
              {est?.phone && (
                <a href={`tel:${est.phone}`} className="inline-flex items-center gap-1 hover:underline">
                  <Phone className="h-3.5 w-3.5" /> {est.phone}
                </a>
              )}
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" /> Pedido pelo WhatsApp
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* BUSCA · FILTROS · ORDENAÇÃO */}
      <div
        className="fx-blur sticky top-[57px] z-20 mt-4"
        style={{ background: `color-mix(in oklab, ${T.surface} 85%, transparent)`, borderBottom: "1px solid var(--mk-line)" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar produto, marca ou código..."
                className="w-full rounded-xl py-2.5 pl-9 pr-4 text-sm outline-none"
                style={{ background: "var(--mk-surface)", border: "1px solid var(--mk-line)", color: T.ink }}
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {brands.length > 1 && (
                <select
                  value={brand}
                  onChange={(e) => setBrand(e.target.value as any)}
                  className="rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: "var(--mk-surface)", border: "1px solid var(--mk-line)", color: T.ink }}
                >
                  <option value="all">Todas as marcas</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              )}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                aria-label="Ordenar"
                className="rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--mk-surface)", border: "1px solid var(--mk-line)", color: T.ink }}
              >
                <option value="rel">Relevância</option>
                <option value="asc">Menor preço</option>
                <option value="desc">Maior preço</option>
                <option value="az">Nome (A-Z)</option>
              </select>
            </div>
          </div>

          <div className="fx-hide-scroll mt-2.5 flex items-center gap-2 overflow-x-auto pb-0.5">
            {[{ id: "all", name: "Tudo" }, ...categories].map((c) => {
              const on = activeCat === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveCat(c.id as any);
                    trackChannelEvent({ slug, channel: "catalog", event_type: "link_click", ref_id: c.id, ref_label: `category:${c.name}` });
                  }}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium"
                  style={
                    on
                      ? { background: primary, color: readableInk(primary), border: "1px solid transparent" }
                      : { background: "transparent", border: "1px solid var(--mk-line)", color: T.ink }
                  }
                >
                  {c.name}
                </button>
              );
            })}
            <span className="mx-1 h-5 w-px shrink-0" style={{ background: "var(--mk-line)" }} />
            <button
              onClick={() => setOnlyPromo((v) => !v)}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium"
              style={
                onlyPromo
                  ? { background: primary, color: readableInk(primary), border: "1px solid transparent" }
                  : { background: "transparent", border: "1px solid var(--mk-line)", color: T.ink }
              }
            >
              Promoções
            </button>
            <button
              onClick={() => setOnlyStock((v) => !v)}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium"
              style={
                onlyStock
                  ? { background: primary, color: readableInk(primary), border: "1px solid transparent" }
                  : { background: "transparent", border: "1px solid var(--mk-line)", color: T.ink }
              }
            >
              Disponíveis
            </button>
          </div>
        </div>
      </div>

      {/* PRODUTOS */}
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        {filtered.length === 0 ? (
          <p className="py-16 text-center text-sm opacity-70">Nenhum produto encontrado.</p>
        ) : showRows ? (
          <div className="space-y-8">
            {rows.map(({ cat, list }) => (
              <section key={cat.id}>
                <div className="mb-3 flex items-end gap-3">
                  {cat.image_url && (
                    <div
                      className="h-14 w-14 shrink-0 overflow-hidden rounded-xl sm:h-16 sm:w-16"
                      style={{ background: T.line, border: "1px solid var(--mk-line)" }}
                    >
                      <LazyImg src={cat.image_url} alt={cat.name} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="fx-serif truncate text-lg font-bold sm:text-xl">{cat.name}</h2>
                    <p className="truncate text-xs opacity-60">
                      {cat.description || `${list.length} ${list.length === 1 ? "produto" : "produtos"}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveCat(cat.id)}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                    style={{ color: primary, border: `1px solid ${primary}33` }}
                  >
                    Ver tudo →
                  </button>
                </div>
                <div className="fx-hide-scroll -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:gap-4">
                  {list.slice(0, 12).map((p) => renderCard(p, "row"))}
                  {list.length > 12 && (
                    <button
                      onClick={() => setActiveCat(cat.id)}
                      className="w-[46vw] shrink-0 snap-start rounded-xl text-sm font-semibold sm:w-[210px]"
                      style={{ border: "1px dashed var(--mk-line)", color: primary }}
                    >
                      Ver todos os {list.length} →
                    </button>
                  )}
                </div>
              </section>
            ))}

            {looseItems.length > 0 && (
              <section>
                <h2 className="fx-serif mb-3 text-lg font-bold sm:text-xl">Outros produtos</h2>
                <div className={`grid gap-3 sm:gap-4 ${gridCols}`}>
                  {looseItems.map((p) => renderCard(p))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <>
            <div className="mb-3 text-xs opacity-60">
              {filtered.length} {filtered.length === 1 ? "produto" : "produtos"}
            </div>
            <div className={`grid gap-3 sm:gap-4 ${gridCols}`}>
              {filtered.map((p) => renderCard(p))}
            </div>
          </>
        )}
      </main>


      <footer className="pb-28 text-center text-[11px] opacity-60">
        Catálogo digital por <Link to="/" className="underline">Fidelize</Link>
      </footer>

      {/* DETALHE DO PRODUTO */}
      {open && (
        <ProductDetail
          product={open as any}
          all={items as any}
          primary={primary}
          line={T.line}
          whatsapp={est?.whatsapp ?? null}
          cart={cart}
          onClose={() => setOpen(null)}
          onSelect={(p) => openProduct(p as any)}
          onTrack={(label) =>
            trackChannelEvent({ slug, channel: "catalog", event_type: "link_click", ref_id: open.id, ref_label: label })
          }
        />
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

