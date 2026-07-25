import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapPin, Phone, Instagram, MessageCircle, Clock, ChevronLeft, ChevronRight,
  X, Search, Flame, Leaf, Wheat, Beef, Fish, Milk, Egg, Nut, Play, Download,
  ArrowLeft, Pause, Volume2, VolumeX, List, Heart, Share2,
} from "lucide-react";

import { getPublicMenuBySlug } from "@/lib/menu.functions";
import { generateMenuPdf } from "@/lib/menu-pdf";
import { trackChannelEvent, useChannelPageView } from "@/lib/tracking";
import { LazyImg } from "@/components/LazyImg";
import { buildMenuJsonLd } from "@/lib/menu-jsonld";
import { resolveMenuTheme, menuBackgroundCss } from "@/lib/menu-themes";

const opts = (slug: string) =>
  queryOptions({
    queryKey: ["public-menu", slug],
    queryFn: () => getPublicMenuBySlug({ data: { slug } }),
    // Vitrine pública: dados mudam raramente durante a sessão do cliente
    staleTime: 5 * 60 * 1000,      // 5 min sem refetch
    gcTime: 30 * 60 * 1000,        // mantém em memória por 30 min
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

export const Route = createFileRoute("/cardapio/$slug")({
  loader: async ({ params, context }) => {
    const d = await context.queryClient.ensureQueryData(opts(params.slug));
    if (!d) throw notFound();
    const { applySeoCacheHeaders } = await import("@/lib/seo-cache.server");
    applySeoCacheHeaders({
      version: [
        (d.menu as any)?.updated_at,
        (d.menu as any)?.status,
        (d.establishment as any)?.updated_at,
        (d.establishment as any)?.cover_url,
        (d.establishment as any)?.logo_url,
        d.items?.length,
      ],
    });
    return d;
  },
  head: ({ params, loaderData }) => {
    const url = `https://fidelizeapp.lovable.app/cardapio/${params.slug}`;
    if (!loaderData) {
      return {
        meta: [
          { title: "Cardápio não encontrado — Fidelize" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const name = loaderData.establishment.name;
    const title = `${name} — Cardápio Digital`;
    const description =
      loaderData.menu?.tagline ||
      loaderData.establishment.description ||
      `Confira o cardápio digital de ${name}: pratos, bebidas, fotos e preços atualizados em tempo real.`;
    const image =
      loaderData.establishment.cover_url ||
      loaderData.establishment.logo_url ||
      null;
    const absImage = image
      ? image.startsWith("http")
        ? image
        : `https://fidelizeapp.lovable.app${image}`
      : null;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "restaurant.menu" },
        { property: "og:url", content: url },
        { property: "og:site_name", content: "Fidelize" },
        { property: "og:locale", content: "pt_BR" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(absImage
          ? [
              { property: "og:image", content: absImage },
              { property: "og:image:alt", content: `Cardápio de ${name}` },
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
        ...(absImage
          ? [{ rel: "preload", as: "image", href: absImage, fetchpriority: "high" } as any]
          : []),
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(buildMenuJsonLd({ loaderData, url, name, description, absImage })),
        },
      ],

    };
  },
  component: PublicMenuPage,
  notFoundComponent: () => (
    <div className="min-h-dvh grid place-items-center p-6 text-center" style={{ background: "#FBF7F0", color: "#17130E" }}>
      <div>
        <h1 style={{ fontFamily: "Outfit, sans-serif" }} className="text-3xl font-bold">
          Cardápio indisponível
        </h1>
        <p className="mt-2 opacity-70">Este restaurante ainda não publicou seu cardápio.</p>
        <Link to="/" className="mt-6 inline-block underline">Voltar</Link>
      </div>
    </div>
  ),
});

// buildMenuJsonLd movido para @/lib/menu-jsonld (reutilizado pelo painel admin).

// ------------ types & helpers ------------
type Item = {
  id: string; name: string; short_desc: string | null; long_desc: string | null;
  price: number | null; promo_price: number | null; currency: string;
  image_url: string | null; video_url: string | null; video_poster_url: string | null;
  prep_minutes: number | null; badges: any; ingredients: string[]; allergens: string[];
  variants?: { label: string; price: number | null }[] | null;
  category_id: string | null;
};


const BADGE_META: Record<string, { label: string; icon: any; tone: string }> = {
  vegetariano: { label: "Vegetariano", icon: Leaf, tone: "#2f7a3a" },
  vegano: { label: "Vegano", icon: Leaf, tone: "#2f7a3a" },
  sem_gluten: { label: "Sem glúten", icon: Wheat, tone: "#8b5a1a" },
  sem_lactose: { label: "Sem lactose", icon: Milk, tone: "#5a6b8b" },
  picante: { label: "Picante", icon: Flame, tone: "#b8371d" },
  carne: { label: "Carne", icon: Beef, tone: "#7a2f2f" },
  frutos_mar: { label: "Frutos do mar", icon: Fish, tone: "#1d6b8b" },
  contem_ovos: { label: "Contém ovos", icon: Egg, tone: "#a68a1d" },
  contem_castanhas: { label: "Castanhas", icon: Nut, tone: "#8b5a1a" },
};

function fmt(v: number | null, currency = "BRL") {
  if (v == null) return "";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
  } catch {
    return `R$ ${v.toFixed(2)}`;
  }
}

// ------------ page ------------
function PublicMenuPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(opts(slug));
  useChannelPageView(slug, "menu");

  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [q, setQ] = useState("");
  const [catPicked, setCatPicked] = useState(false);
  const [open, setOpen] = useState<Item | null>(null);
  const [stories, setStories] = useState<{ list: Item[]; index: number } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [logoErr, setLogoErr] = useState(false);
  const catRefs = useRef<Record<string, HTMLElement | null>>({});
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!data || !data.menu) {
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-center" style={{ background: "#FBF7F0", color: "#17130E" }}>
        <div>
          <h1 style={{ fontFamily: "Outfit, sans-serif" }} className="text-3xl font-bold">Em breve</h1>
          <p className="mt-2 opacity-70">
            {data?.establishment.name ?? "Este restaurante"} ainda está preparando o cardápio digital.
          </p>
        </div>
      </div>
    );
  }

  const { establishment: est, menu, categories, items } = data;
  const videoItems = useMemo(() => (items as Item[]).filter((i) => !!i.video_url), [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (items as Item[]).filter((i) => {
      if (activeCat !== "all" && i.category_id !== activeCat) return false;
      if (!term) return true;
      return (
        i.name.toLowerCase().includes(term) ||
        (i.short_desc ?? "").toLowerCase().includes(term) ||
        (i.long_desc ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, activeCat, q]);

  const byCat = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const c of categories) map.set(c.id, []);
    map.set("__uncat", []);
    for (const it of filtered) {
      const k = it.category_id ?? "__uncat";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return map;
  }, [filtered, categories]);

  const scrollToCat = (id: string) => {
    setCatPicked(true);
    setActiveCat(id === "all" ? "all" : id);
    const el = catRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    const label =
      id === "all" ? "category:all" : `category:${categories.find((c) => c.id === id)?.name ?? id}`;
    trackChannelEvent({ slug, channel: "menu", event_type: "link_click", ref_id: id, ref_label: label });
  };

  const openItem = (i: Item) => {
    trackChannelEvent({ slug, channel: "menu", event_type: "link_click", ref_id: i.id, ref_label: `item:${i.name}` });
    const hasMedia = (x: Item) => !!(x.video_url || x.image_url);
    if (!hasMedia(i)) { setOpen(i); return; }
    const pool = (filtered as Item[]).filter(hasMedia);
    const idx = pool.findIndex((x) => x.id === i.id);
    if (idx < 0) { setOpen(i); return; }
    setStories({ list: pool, index: idx });
  };


  const openStories = (list: Item[], index: number) => {
    setStories({ list, index });
    const it = list[index];
    trackChannelEvent({ slug, channel: "menu", event_type: "link_click", ref_id: it?.id ?? null, ref_label: `stories_open:${it?.name ?? ""}` });
  };

  // Abre a categoria em modo story: passa 1 vídeo ou 1 imagem por produto
  const openCategoryStories = (catId: string, catName: string) => {
    const pool = (items as Item[]).filter(
      (x) => x.category_id === catId && !!(x.video_url || x.image_url),
    );
    if (pool.length === 0) { scrollToCat(catId); return; }
    setStories({ list: pool, index: 0 });
    trackChannelEvent({ slug, channel: "menu", event_type: "link_click", ref_id: catId, ref_label: `stories_category:${catName}` });
  };


  const onSearchChange = (value: string) => {
    setQ(value);
    if (value.trim()) setCatPicked(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const term = value.trim();
    if (!term) return;
    searchTimer.current = setTimeout(() => {
      trackChannelEvent({ slug, channel: "menu", event_type: "link_click", ref_label: `search:${term.slice(0, 40)}` });
    }, 900);
  };

  const downloadPdf = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    trackChannelEvent({ slug, channel: "menu", event_type: "link_click", ref_label: "pdf_download" });
    try {
      await generateMenuPdf(data as any, slug);
    } catch (e) {
      console.error("[menu-pdf]", e);
      alert("Não foi possível gerar o PDF agora. Tente novamente.");
    } finally {
      setPdfLoading(false);
    }
  };

  const cover = est.cover_url || null;
  const theme = resolveMenuTheme((menu as any)?.theme);
  const primary = theme.accent_color || est.primary_color || "#B8371D";
  const T = theme.preset_def;
  const pageBg = menuBackgroundCss(theme, T, primary);
  const showCatPicker = theme.entry === "categories" && !catPicked && !q.trim() && categories.length > 0;

  return (
    <div
      style={{
        background: pageBg,
        color: T.ink,
        fontFamily: "Figtree, system-ui, sans-serif",
        ["--mk-surface" as any]: T.surface,
        ["--mk-ink" as any]: T.ink,
        ["--mk-line" as any]: T.line,
        ["--mk-bar" as any]: T.bar,
        ["--mk-barink" as any]: T.barInk,
      }}
      className="min-h-dvh"
    >
      <style>{`
        .fx-serif { font-family: ${T.fontHead}; letter-spacing: -0.01em; }
        .fx-shadow { box-shadow: 0 1px 2px rgba(23,19,14,.06), 0 8px 24px -12px rgba(23,19,14,.18); }
        .fx-pill { transition: transform .15s ease, background .15s ease, color .15s ease, border-color .15s ease; }
        .fx-pill:hover { transform: translateY(-1px); }
        .fx-card { transition: transform .2s ease, box-shadow .2s ease; }
        .fx-card:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(23,19,14,.08), 0 20px 40px -20px rgba(23,19,14,.25); }
        .fx-hide-scroll::-webkit-scrollbar { display:none }
        .fx-hide-scroll { scrollbar-width: none }
      `}</style>

      {/* ---------- HERO ---------- */}
      <header className="relative">
        <div
          className="h-14 sm:h-24 w-full"
          style={{
            background: cover
              ? `linear-gradient(180deg, rgba(23,19,14,0.15), rgba(23,19,14,0.55)), url(${cover}) center/cover`
              : `linear-gradient(135deg, ${primary}, #17130E)`,
          }}
        />
        <div className="max-w-3xl mx-auto px-4 sm:px-5 -mt-8 sm:-mt-10 relative">
          <div className="rounded-2xl sm:rounded-3xl fx-shadow p-3.5 sm:p-5 flex flex-col items-center text-center gap-2 sm:gap-3" style={{ background: "var(--mk-surface)", border: "1px solid var(--mk-line)" }}>
            {est.logo_url && !logoErr ? (
              <img
                src={est.logo_url}
                alt={est.name}
                width={80}
                height={80}
                loading="eager"
                onError={() => setLogoErr(true)}
                className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl object-contain bg-white ring-1 ring-black/5 p-1"
              />
            ) : (
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl grid place-items-center text-white text-2xl fx-serif font-bold"
                style={{ background: primary }}
              >
                {est.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 w-full">
              {est.logo_url && !logoErr ? (
                <h1 className="sr-only">{est.name}</h1>
              ) : (
                <h1 className="fx-serif text-xl sm:text-2xl font-bold truncate">{est.name}</h1>
              )}

              {(menu.tagline || est.description) && (
                <p className="text-[13px] sm:text-sm opacity-70 line-clamp-2">
                  {menu.tagline || est.description}
                </p>
              )}
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1.5 text-[11px] sm:text-xs opacity-70">
                {est.address && <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{est.address}</span></span>}
                {menu.hours && (menu.hours as any)?.summary && (
                  <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5 shrink-0" />{(menu.hours as any).summary}</span>
                )}
              </div>
            </div>
          </div>

          {/* Stories strip */}
          {videoItems.length > 0 && (
            <div className="mt-3 -mx-1 px-1 flex gap-3 overflow-x-auto fx-hide-scroll">

              {videoItems.slice(0, 12).map((v, idx) => (
                <button
                  key={v.id}
                  onClick={() => openStories(videoItems, idx)}
                  className="shrink-0 flex flex-col items-center gap-1"
                >
                  <span
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full p-[3px] block"
                    style={{ background: `conic-gradient(from 90deg, ${primary}, #d4a464, ${primary})` }}
                  >
                    <span className="block w-full h-full rounded-full p-[2px]" style={{ background: "var(--mk-surface)" }}>
                      <span
                        className="block w-full h-full rounded-full bg-cover bg-center relative"
                        style={{ backgroundImage: `url(${v.video_poster_url || v.image_url || ""})`, background: (v.video_poster_url || v.image_url) ? undefined : "#eee" }}
                      >
                        <Play className="w-4 h-4 text-white absolute inset-0 m-auto drop-shadow" />
                      </span>
                    </span>
                  </span>
                  <span className="text-[10px] max-w-[64px] truncate">{v.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ---------- STICKY NAV ---------- */}
      <div className="sticky top-0 z-30 mt-3" style={{ background: `${T.bg}EB`, backdropFilter: "blur(10px)", borderBottom: "1px solid var(--mk-line)" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-5 py-2.5">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
              <input
                value={q}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar no cardápio…"
                className="w-full pl-9 pr-3 py-2.5 rounded-full border outline-none text-sm"
                style={{ borderColor: "var(--mk-line)", background: "var(--mk-surface)", color: "var(--mk-ink)" }}
              />
            </div>
            <button
              onClick={downloadPdf}
              disabled={pdfLoading}
              className="fx-pill shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2.5 rounded-full border disabled:opacity-60"
              style={{ background: "var(--mk-bar)", color: "var(--mk-barink)", borderColor: "var(--mk-bar)" }}
              aria-label="Baixar cardápio em PDF"
              title="Baixar cardápio em PDF"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{pdfLoading ? "Gerando…" : "PDF"}</span>
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto fx-hide-scroll pb-1">
            <button
              onClick={() => scrollToCat("all")}
              className="fx-pill shrink-0 text-xs font-semibold px-4 py-2 rounded-full border"
              style={
                activeCat === "all"
                  ? { background: "var(--mk-bar)", color: "var(--mk-barink)", borderColor: "var(--mk-bar)" }
                  : { background: "var(--mk-surface)", color: "var(--mk-ink)", borderColor: "var(--mk-line)" }
              }
            >
              Tudo
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => scrollToCat(c.id)}
                className="fx-pill shrink-0 text-xs font-semibold px-4 py-2 rounded-full border"
                style={
                  activeCat === c.id
                    ? { background: "var(--mk-bar)", color: "var(--mk-barink)", borderColor: "var(--mk-bar)" }
                    : { background: "var(--mk-surface)", color: "var(--mk-ink)", borderColor: "var(--mk-line)" }
                }
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- FEED ---------- */}
      <main className="max-w-3xl mx-auto px-4 sm:px-5 pb-32 pt-5 space-y-8 sm:space-y-10">
        {showCatPicker ? (
          <div className="grid grid-cols-2 gap-4">
            {categories.map((c) => {
              const count = (items as Item[]).filter((i) => i.category_id === c.id).length;
              if (count === 0) return null;
              const cover = (items as Item[]).find((i) => i.category_id === c.id && !!i.image_url)?.image_url || null;
              const storyCount = (items as Item[]).filter((i) => i.category_id === c.id && !!(i.video_url || i.image_url)).length;
              return (
                <div
                  key={c.id}
                  className="fx-pill overflow-hidden rounded-2xl border text-left"
                  style={{ background: "var(--mk-surface)", borderColor: "var(--mk-line)" }}
                >
                  <button
                    onClick={() => (storyCount > 0 ? openCategoryStories(c.id, c.name) : scrollToCat(c.id))}
                    className="block w-full text-left"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden relative" style={{ background: "var(--mk-line)" }}>
                      {cover && <img src={cover} alt={c.name} loading="lazy" className="h-full w-full object-cover" />}
                      {storyCount > 0 && (
                        <>
                          <span className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.45))" }} />
                          <span className="absolute inset-0 grid place-items-center">
                            <span className="grid place-items-center w-11 h-11 rounded-full bg-white/25 backdrop-blur border border-white/50">
                              <Play className="w-5 h-5 text-white" />
                            </span>
                          </span>
                          <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/55 text-white">
                            {storyCount} stories
                          </span>
                        </>
                      )}
                    </div>
                    <div className="px-3 pt-3">
                      <div className="fx-serif text-base font-bold leading-tight">{c.name}</div>
                      <div className="text-xs opacity-60 mt-0.5">{count} {count === 1 ? "item" : "itens"}</div>
                    </div>
                  </button>
                  <button
                    onClick={() => scrollToCat(c.id)}
                    className="w-full text-left px-3 pb-3 pt-1.5 text-[11px] font-semibold underline underline-offset-2 opacity-70"
                  >
                    ver lista
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => scrollToCat("all")}
              className="fx-pill col-span-2 rounded-2xl border px-4 py-3 text-sm font-semibold"
              style={{ background: "var(--mk-bar)", color: "var(--mk-barink)", borderColor: "var(--mk-bar)" }}
            >
              Ver cardápio completo
            </button>
          </div>
        ) : null}
        {!showCatPicker && categories.map((c) => {
          const list = byCat.get(c.id) || [];
          if (list.length === 0 && (activeCat === c.id || q)) return null;
          if (list.length === 0) return null;
          const storyList = list.filter((i) => !!(i.video_url || i.image_url));
          return (
            <section key={c.id} ref={(el) => { catRefs.current[c.id] = el; }} className="scroll-mt-32">
              <div className="flex items-end justify-between gap-2 mb-3">
                <h2 className="fx-serif text-xl sm:text-2xl font-bold">{c.name}</h2>
                <div className="flex items-center gap-2 shrink-0">
                  {c.featured && (
                    <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full" style={{ background: primary, color: "#fff" }}>
                      Destaque
                    </span>
                  )}
                  {storyList.length > 0 && (
                    <button
                      onClick={() => openStories(storyList, 0)}
                      className="fx-pill inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full text-white"
                      style={{ background: primary }}
                    >
                      <Play className="w-3 h-3" /> Assistir
                    </button>
                  )}
                </div>
              </div>

              {c.description && <p className="text-sm opacity-60 -mt-2 mb-4">{c.description}</p>}
              <div className={theme.layout === "grid" ? "grid gap-4 grid-cols-2" : "grid gap-4"}>
                {list.map((i) => (
                  <ItemCard key={i.id} item={i} primary={primary} layout={theme.layout} onOpen={() => openItem(i)} />
                ))}
              </div>
            </section>
          );
        })}
        {!showCatPicker && (byCat.get("__uncat") || []).length > 0 && (
          <section ref={(el) => { catRefs.current["__uncat"] = el; }}>
            <h2 className="fx-serif text-xl font-bold mb-3">Outros</h2>
            <div className={theme.layout === "grid" ? "grid gap-4 grid-cols-2" : "grid gap-4"}>
              {(byCat.get("__uncat") || []).map((i) => (
                <ItemCard key={i.id} item={i} primary={primary} layout={theme.layout} onOpen={() => openItem(i)} />
              ))}
            </div>
          </section>
        )}

        {!showCatPicker && filtered.length === 0 && (
          <div className="text-center py-16 opacity-60">
            <p className="fx-serif text-lg">Nenhum item encontrado</p>
            <p className="text-sm mt-1">Tente outra busca ou categoria.</p>
          </div>
        )}
      </main>

      {/* ---------- FLOATING CTA ---------- */}
      {(est.whatsapp || est.instagram || est.phone) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex gap-2 rounded-full p-1.5 fx-shadow" style={{ background: "var(--mk-bar)" }}>
          {est.whatsapp && (
            <a
              href={`https://wa.me/${(est.whatsapp || "").replace(/\D/g, "")}`}
              target="_blank" rel="noreferrer"
              onClick={() => trackChannelEvent({ slug, channel: "menu", event_type: "link_click", ref_label: "cta:whatsapp" })}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold"
              style={{ background: "#25D366", color: "#fff" }}
            >
              <MessageCircle className="w-4 h-4" /> Pedir no WhatsApp
            </a>
          )}
          {est.instagram && (
            <a
              href={est.instagram.startsWith("http") ? est.instagram : `https://instagram.com/${est.instagram.replace(/^@/, "")}`}
              target="_blank" rel="noreferrer"
              onClick={() => trackChannelEvent({ slug, channel: "menu", event_type: "link_click", ref_label: "cta:instagram" })}
              className="grid place-items-center w-10 h-10 rounded-full text-white"
              style={{ background: "linear-gradient(135deg, #833AB4, #E1306C, #FCAF45)" }}
              aria-label="Instagram"
            >
              <Instagram className="w-4 h-4" />
            </a>
          )}
          {est.phone && (
            <a
              href={`tel:${est.phone}`}
              onClick={() => trackChannelEvent({ slug, channel: "menu", event_type: "link_click", ref_label: "cta:phone" })}
              className="grid place-items-center w-10 h-10 rounded-full text-white bg-white/10"
              aria-label="Telefone"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
        </div>
      )}

      {/* ---------- ITEM MODAL ---------- */}
      {open && <ItemModal item={open} primary={primary} onClose={() => setOpen(null)} />}

      {/* ---------- STORIES ---------- */}
      {stories && (
        <StoriesViewer
          items={stories.list}
          startIndex={stories.index}
          primary={primary}
          catName={(id) => categories.find((c) => c.id === id)?.name ?? ""}
          onClose={() => setStories(null)}
          onDetails={(i) => { setStories(null); setOpen(i); }}
          onItemView={(i) =>
            trackChannelEvent({ slug, channel: "menu", event_type: "link_click", ref_id: i.id, ref_label: `stories:${i.name}` })
          }
        />

      )}

    </div>
  );
}

// ------------ Item Card ------------
function ItemCard({
  item, primary, onOpen, layout = "list",
}: { item: Item; primary: string; onOpen: () => void; layout?: "list" | "grid" | "magazine" }) {
  const hasPromo = item.promo_price != null && item.price != null && item.promo_price < item.price;
  const badges = Array.isArray(item.badges) ? (item.badges as string[]) : [];
  const variants = (Array.isArray(item.variants) ? item.variants : []).filter((v) => v?.label);
  const variantPrices = variants.map((v) => v.price).filter((p): p is number => p != null);
  const surface = { background: "var(--mk-surface)", border: "1px solid var(--mk-line)" } as const;

  const Price = ({ size = "text-lg" }: { size?: string }) =>
    hasPromo ? (
      <>
        <span className={`fx-serif font-bold ${size}`} style={{ color: primary }}>{fmt(item.promo_price, item.currency)}</span>
        <span className="text-xs opacity-50 line-through">{fmt(item.price, item.currency)}</span>
      </>
    ) : item.price != null ? (
      <span className={`fx-serif font-bold ${size}`}>{fmt(item.price, item.currency)}</span>
    ) : variantPrices.length > 0 ? (
      <span className={`fx-serif font-bold ${size}`}>
        <span className="text-[10px] font-medium opacity-60 mr-1">a partir de</span>
        {fmt(Math.min(...variantPrices), item.currency)}
      </span>
    ) : null;

  const VariantChips = () =>
    variants.length === 0 ? null : (
      <div className="flex flex-wrap gap-1 mt-1.5">
        {variants.slice(0, 3).map((v, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: `${primary}18`, color: primary }}
          >
            {v.label}{v.price != null ? ` · ${fmt(v.price, item.currency)}` : ""}
          </span>
        ))}
        {variants.length > 3 && <span className="text-[10px] opacity-60">+{variants.length - 3}</span>}
      </div>
    );


  const Thumb = ({ className }: { className: string }) => (
    <div className={`${className} shrink-0 overflow-hidden relative`} style={{ background: `${primary}12` }}>
      {item.image_url ? (
        <LazyImg src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full grid place-items-center text-2xl">🍽️</div>
      )}
      {item.video_url && (
        <span className="absolute top-1.5 right-1.5 grid place-items-center w-6 h-6 rounded-full bg-black/60 text-white">
          <Play className="w-3 h-3" />
        </span>
      )}
    </div>
  );

  const Badges = () => (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {badges.slice(0, 3).map((b) => {
        const meta = BADGE_META[b];
        if (!meta) return null;
        const Ico = meta.icon;
        return (
          <span key={b} className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${meta.tone}22`, color: meta.tone }}>
            <Ico className="w-2.5 h-2.5" /> {meta.label}
          </span>
        );
      })}
      {item.prep_minutes != null && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold opacity-60">
          <Clock className="w-2.5 h-2.5" /> {item.prep_minutes} min
        </span>
      )}
    </div>
  );

  if (layout === "grid") {
    return (
      <button onClick={onOpen} className="fx-card text-left w-full rounded-2xl overflow-hidden fx-shadow flex flex-col" style={surface}>
        <Thumb className="w-full h-32 sm:h-40" />
        <div className="p-3 flex-1 flex flex-col">
          <h3 className="fx-serif font-bold text-sm sm:text-base leading-tight line-clamp-2">{item.name}</h3>
          {item.short_desc && <p className="text-xs opacity-70 line-clamp-2 mt-1">{item.short_desc}</p>}
          <Badges />
          <div className="mt-auto pt-2 flex items-baseline gap-2"><Price size="text-base" /></div>
        </div>
      </button>
    );
  }

  if (layout === "magazine") {
    return (
      <button onClick={onOpen} className="fx-card text-left w-full rounded-2xl overflow-hidden fx-shadow flex items-center gap-3 p-3" style={surface}>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="fx-serif font-bold text-base sm:text-lg leading-tight truncate">{item.name}</h3>
            <span className="flex-1 border-b border-dashed opacity-30" style={{ borderColor: "var(--mk-ink)" }} />
            <span className="flex items-baseline gap-2 shrink-0"><Price size="text-base" /></span>
          </div>
          {item.short_desc && <p className="text-xs sm:text-sm opacity-70 line-clamp-2 mt-1">{item.short_desc}</p>}
          <Badges />
        </div>
        <Thumb className="w-16 h-16 rounded-xl" />
      </button>
    );
  }

  return (
    <button onClick={onOpen} className="fx-card text-left w-full rounded-2xl overflow-hidden fx-shadow flex gap-3 sm:gap-4 p-3" style={surface}>
      <Thumb className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl" />
      <div className="flex-1 min-w-0 py-1 flex flex-col">
        <h3 className="fx-serif font-bold text-base sm:text-lg leading-tight line-clamp-2">{item.name}</h3>
        {item.short_desc && <p className="text-xs sm:text-sm opacity-70 line-clamp-2 mt-1">{item.short_desc}</p>}
        <Badges />
        <div className="mt-auto pt-2 flex items-baseline gap-2"><Price /></div>
      </div>
    </button>
  );
}


// ------------ Item Modal ------------
function ItemModal({ item, primary, onClose }: { item: Item; primary: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  const hasPromo = item.promo_price != null && item.price != null && item.promo_price < item.price;
  const badges = Array.isArray(item.badges) ? (item.badges as string[]) : [];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92dvh] flex flex-col"
        style={{ color: "var(--mk-ink)", background: "var(--mk-surface)" }}
      >
        <button onClick={onClose} className="absolute top-3 right-3 z-10 grid place-items-center w-9 h-9 rounded-full bg-black/40 text-white backdrop-blur">
          <X className="w-4 h-4" />
        </button>
        {item.video_url ? (
          <video
            src={item.video_url}
            poster={item.video_poster_url || item.image_url || undefined}
            controls
            playsInline
            preload="metadata"
            className="w-full aspect-[4/3] object-cover bg-black"
          />
        ) : item.image_url ? (
          <LazyImg src={item.image_url} alt={item.name} className="w-full aspect-[4/3] object-cover" eager />
        ) : (
          <div className="w-full aspect-[4/3] grid place-items-center text-6xl" style={{ background: "#f3ede2" }}>🍽️</div>
        )}
        <div className="p-5 overflow-y-auto">
          <h3 className="fx-serif text-2xl font-bold" style={{ fontFamily: "Outfit" }}>{item.name}</h3>
          <div className="flex items-baseline gap-2 mt-1">
            {hasPromo ? (
              <>
                <span className="fx-serif font-bold text-xl" style={{ color: primary, fontFamily: "Outfit" }}>{fmt(item.promo_price, item.currency)}</span>
                <span className="text-sm opacity-50 line-through">{fmt(item.price, item.currency)}</span>
              </>
            ) : (
              item.price != null && <span className="fx-serif font-bold text-xl" style={{ fontFamily: "Outfit" }}>{fmt(item.price, item.currency)}</span>
            )}
            {item.prep_minutes != null && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs opacity-70">
                <Clock className="w-3 h-3" /> {item.prep_minutes} min
              </span>
            )}
          </div>
          {(item.long_desc || item.short_desc) && (
            <p className="text-sm opacity-80 mt-3 whitespace-pre-line">{item.long_desc || item.short_desc}</p>
          )}
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {badges.map((b) => {
                const meta = BADGE_META[b];
                if (!meta) return null;
                const Ico = meta.icon;
                return (
                  <span key={b} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full" style={{ background: `${meta.tone}15`, color: meta.tone }}>
                    <Ico className="w-3 h-3" /> {meta.label}
                  </span>
                );
              })}
            </div>
          )}
          {item.ingredients?.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs uppercase tracking-widest font-bold opacity-60 mb-1">Ingredientes</h4>
              <p className="text-sm">{item.ingredients.join(", ")}</p>
            </div>
          )}
          {item.allergens?.length > 0 && (
            <div className="mt-3">
              <h4 className="text-xs uppercase tracking-widest font-bold opacity-60 mb-1">Alérgenos</h4>
              <p className="text-sm">{item.allergens.join(", ")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------ Stories Viewer ------------
const STORY_MS = 5000;

function StoriesViewer({
  items, startIndex, primary, catName, onClose, onItemView, onDetails,
}: {
  items: Item[]; startIndex: number; primary: string;
  catName: (id: string | null) => string;
  onClose: () => void; onItemView: (i: Item) => void; onDetails: (i: Item) => void;
}) {
  const [i, setI] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showList, setShowList] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const touchY = useRef<number | null>(null);
  const current = items[i];

  const next = () => setI((x) => (x >= items.length - 1 ? (onClose(), x) : x + 1));
  const prev = () => setI((x) => Math.max(0, x - 1));

  useEffect(() => {
    if (current) onItemView(current);
    setProgress(0);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  // auto-advance
  useEffect(() => {
    if (!current || paused) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const v = videoRef.current;
      let p: number;
      if (current.video_url && v && v.duration && isFinite(v.duration)) {
        p = Math.min(1, v.currentTime / v.duration);
      } else {
        p = Math.min(1, (t - start) / STORY_MS);
      }
      setProgress(p);
      if (p >= 1) { next(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [i, paused, current]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause(); else void v.play().catch(() => {});
  }, [paused, i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === " ") setPaused((p) => !p);
    };
    document.addEventListener("keydown", onKey);
    const prevOv = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOv;
    };
  }, [items.length, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;
  const hasPromo = current.promo_price != null && current.price != null && current.promo_price < current.price;
  const isVideo = !!current.video_url;
  const thumb = current.image_url || current.video_poster_url || null;

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ title: current.name, text: current.short_desc || current.name, url });
      else await navigator.clipboard.writeText(url);
    } catch { /* cancelado */ }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black grid place-items-center animate-in fade-in duration-200">
      <div
        className="relative w-full h-full sm:w-auto sm:h-[95dvh] sm:aspect-[9/16] sm:rounded-3xl overflow-hidden bg-black select-none"
        onTouchStart={(e) => { touchY.current = e.touches[0].clientY; setPaused(true); }}
        onTouchEnd={(e) => {
          setPaused(false);
          const dy = touchY.current == null ? 0 : e.changedTouches[0].clientY - touchY.current;
          touchY.current = null;
          if (dy > 90) onClose();
        }}
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
      >
        {/* media */}
        {isVideo ? (
          <video
            key={current.id}
            ref={videoRef}
            src={current.video_url!}
            poster={current.video_poster_url || current.image_url || undefined}
            autoPlay muted={muted} playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <LazyImg
            key={current.id}
            src={current.image_url || ""}
            alt={current.name}
            className="absolute inset-0 w-full h-full object-cover animate-in zoom-in-105 duration-[5000ms]"
            eager
          />
        )}

        {/* tap zones */}
        <button aria-label="Anterior" onClick={prev} className="absolute left-0 top-16 bottom-40 w-1/3 z-10" />
        <button aria-label="Próximo" onClick={next} className="absolute right-0 top-16 bottom-40 w-1/3 z-10" />

        {/* top bar */}
        <div className="absolute top-0 inset-x-0 z-30 pt-3 pb-6 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
          <div className="flex items-center justify-between px-4 pointer-events-auto">
            <button aria-label="Voltar" onClick={onClose} className="text-white/95 p-1.5 -ml-1.5">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-4 text-white/95">
              <button aria-label={paused ? "Retomar" : "Pausar"} onClick={(e) => { e.stopPropagation(); setPaused((p) => !p); }}>
                {paused ? <Play className="w-[22px] h-[22px]" /> : <Pause className="w-[22px] h-[22px]" />}
              </button>
              {isVideo && (
                <button aria-label={muted ? "Ativar som" : "Silenciar"} onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}>
                  {muted ? <VolumeX className="w-[22px] h-[22px]" /> : <Volume2 className="w-[22px] h-[22px]" />}
                </button>
              )}
              <button aria-label="Lista de itens" onClick={(e) => { e.stopPropagation(); setPaused(true); setShowList(true); }}>
                <List className="w-[22px] h-[22px]" />
              </button>
            </div>
          </div>

          {/* progress bars */}
          <div className="mt-3 px-4 flex gap-[5px]">
            {items.map((_, idx) => (
              <span key={idx} className="flex-1 h-[3px] rounded-full overflow-hidden bg-white/30">
                <span
                  className="block h-full bg-white rounded-full"
                  style={{ width: idx < i ? "100%" : idx === i ? `${progress * 100}%` : "0%" }}
                />
              </span>
            ))}
          </div>
        </div>

        {/* desktop arrows */}
        {i > 0 && (
          <button onClick={prev} className="hidden sm:grid absolute left-2 top-1/2 -translate-y-1/2 z-30 place-items-center w-10 h-10 rounded-full bg-white/15 text-white backdrop-blur">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {i < items.length - 1 && (
          <button onClick={next} className="hidden sm:grid absolute right-2 top-1/2 -translate-y-1/2 z-30 place-items-center w-10 h-10 rounded-full bg-white/15 text-white backdrop-blur">
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* bottom info */}
        <div className="absolute bottom-0 inset-x-0 z-20 text-white">
          <div className="px-4 pt-16 pb-3" style={{ background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.85) 45%)" }}>
            <div className="flex items-start gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); onDetails(current); }}
                className="shrink-0 w-[72px] h-[72px] rounded-xl overflow-hidden bg-white/10 ring-1 ring-white/25"
              >
                {thumb ? (
                  <img src={thumb} alt={current.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="grid place-items-center w-full h-full text-xs opacity-70">Ver</span>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/70 leading-tight">{catName(current.category_id)}</p>
                <h3 style={{ fontFamily: "Outfit" }} className="text-[26px] font-bold leading-tight truncate">{current.name}</h3>
              </div>
              <button aria-label="Fechar" onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1 text-white/90">
                <X className="w-6 h-6" />
              </button>
            </div>

            {current.short_desc && (
              <p className="mt-3 text-[15px] leading-snug text-white/85 line-clamp-3">{current.short_desc}</p>
            )}
          </div>

          {/* action bar */}
          <div className="flex items-center gap-6 px-5 py-3 bg-black/90">
            <button aria-label="Ver detalhes" onClick={(e) => { e.stopPropagation(); onDetails(current); }}>
              <MessageCircle className="w-6 h-6 text-white/90" />
            </button>
            <button
              aria-label="Favoritar"
              onClick={(e) => { e.stopPropagation(); setLiked((l) => ({ ...l, [current.id]: !l[current.id] })); }}
            >
              <Heart
                className="w-6 h-6 transition"
                style={liked[current.id] ? { color: primary, fill: primary } : { color: "rgba(255,255,255,0.9)" }}
              />
            </button>
            <button aria-label="Compartilhar" onClick={(e) => { e.stopPropagation(); void share(); }} className="flex items-center gap-2 mx-auto">
              <Share2 className="w-6 h-6 text-white/90" />
              <span className="text-[15px] font-medium text-white/90">Share</span>
            </button>
            {current.price != null && (
              <span className="flex items-baseline gap-2">
                {hasPromo && <span className="text-xs opacity-60 line-through">{fmt(current.price, current.currency)}</span>}
                <span className="text-xl font-bold" style={{ fontFamily: "Outfit" }}>
                  {fmt(hasPromo ? current.promo_price : current.price, current.currency)}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* item list sheet */}
        {showList && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-150"
            onClick={() => { setShowList(false); setPaused(false); }}>
            <div className="bg-neutral-950 rounded-t-3xl max-h-[70%] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-semibold">Todos os itens</h4>
                <button onClick={() => { setShowList(false); setPaused(false); }} className="text-white/70"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-1">
                {items.map((it, idx) => (
                  <button
                    key={it.id}
                    onClick={() => { setI(idx); setShowList(false); setPaused(false); }}
                    className={`w-full flex items-center gap-3 rounded-xl p-2 text-left ${idx === i ? "bg-white/10" : ""}`}
                  >
                    <span className="w-11 h-11 rounded-lg overflow-hidden bg-white/10 shrink-0">
                      {(it.image_url || it.video_poster_url) && (
                        <img src={(it.image_url || it.video_poster_url)!} alt={it.name} className="w-full h-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-white text-sm font-medium truncate">{it.name}</span>
                      <span className="block text-white/50 text-xs">{catName(it.category_id)}</span>
                    </span>
                    {it.price != null && <span className="text-white/80 text-sm">{fmt(it.price, it.currency)}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

