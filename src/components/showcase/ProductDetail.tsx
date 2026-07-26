import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, MessageCircle, ShoppingBag, X, ZoomIn } from "lucide-react";

import { stockLabel, STOCK_STATUS } from "@/lib/showcase";
import { readableInk } from "@/lib/menu-themes";
import { LazyImg } from "@/components/LazyImg";
import type { useCart } from "@/lib/cart";

export type CatalogProduct = {
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

export function ProductDetail({
  product,
  all,
  primary,
  line,
  whatsapp,
  cart,
  onClose,
  onSelect,
  onTrack,
}: {
  product: CatalogProduct;
  all: CatalogProduct[];
  primary: string;
  line: string;
  whatsapp: string | null;
  cart: ReturnType<typeof useCart>;
  onClose: () => void;
  onSelect: (p: CatalogProduct) => void;
  onTrack: (label: string) => void;
}) {
  const photos = useMemo(() => {
    const list = [product.image_url, ...((product.gallery ?? []) as string[])].filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, [product]);

  const variants = (Array.isArray(product.variants) ? product.variants : []).filter((v) => v?.label);
  const needsVariant = variants.length > 0;

  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [variant, setVariant] = useState<string | null>(null);
  const [warn, setWarn] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIdx(0);
    setZoom(false);
    setWarn(false);
    setVariant(variants.length === 1 ? variants[0].label : null);
    scroller.current?.scrollTo({ left: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const chosen = variants.find((v) => v.label === variant) ?? null;
  const base = product.promo_price ?? product.price ?? null;
  const unit = chosen?.price != null ? chosen.price : base;
  const out = product.stock_status === "out_of_stock";
  const canBuy = !out && (product.price != null || product.promo_price != null);
  const qty = cart.qtyOf(product.id, needsVariant ? variant : null);

  const related = useMemo(() => {
    const others = all.filter((p) => p.id !== product.id && p.stock_status !== "out_of_stock");
    const sameCat = others.filter((p) => p.category_id && p.category_id === product.category_id);
    const sameBrand = others.filter(
      (p) => !sameCat.includes(p) && p.brand && product.brand && p.brand === product.brand,
    );
    return [...sameCat, ...sameBrand, ...others.filter((p) => !sameCat.includes(p) && !sameBrand.includes(p))].slice(0, 6);
  }, [all, product]);

  const addToCart = () => {
    if (needsVariant && !variant) {
      setWarn(true);
      return;
    }
    cart.add(product.id, 1, needsVariant ? variant : null);
    onTrack(`add:${product.name}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl sm:rounded-3xl"
        style={{ background: "var(--mk-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid gap-0 sm:grid-cols-2">
          {/* GALERIA */}
          <div className="relative">
            <div
              ref={scroller}
              className="flex snap-x snap-mandatory overflow-x-auto"
              style={{ scrollbarWidth: "none" }}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.clientWidth) setIdx(Math.round(el.scrollLeft / el.clientWidth));
              }}
            >
              {photos.length > 0 ? (
                photos.map((src, i) => (
                  <div key={src + i} className="relative aspect-square w-full shrink-0 snap-center overflow-hidden">
                    <img
                      src={src}
                      alt={`${product.name} — foto ${i + 1}`}
                      onClick={() => setZoom(true)}
                      className="h-full w-full cursor-zoom-in object-cover"
                    />
                  </div>
                ))
              ) : (
                <div className="grid aspect-square w-full place-items-center opacity-40" style={{ background: line }}>
                  <ShoppingBag className="h-10 w-10" />
                </div>
              )}
            </div>


            {photos.length > 1 && (
              <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
                {photos.length} fotos
              </span>
            )}
            {photos.length > 0 && (
              <button
                onClick={() => setZoom(true)}
                aria-label="Ampliar foto"
                className="absolute bottom-3 left-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white"
            >
              <X className="h-4 w-4" />
            </button>

            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3" style={{ scrollbarWidth: "none" }}>
                {photos.map((src, i) => (
                  <button
                    key={`t${i}`}
                    onClick={() => {
                      setIdx(i);
                      const el = scroller.current;
                      if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
                    }}
                    className="h-14 w-14 shrink-0 overflow-hidden rounded-lg"
                    style={{ border: i === idx ? `2px solid ${primary}` : `1px solid ${line}` }}
                    aria-label={`Ver foto ${i + 1}`}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* INFO */}
          <div className="space-y-3 p-5">
            {product.brand && <div className="text-[11px] uppercase tracking-wider opacity-60">{product.brand}</div>}
            <h2 className="fx-serif text-xl font-extrabold">{product.name}</h2>

            <div className="flex items-baseline gap-2">
              {product.promo_price != null && product.price != null && product.promo_price < product.price && chosen?.price == null ? (
                <>
                  <span className="text-sm line-through opacity-50">{fmt(product.price, product.currency)}</span>
                  <span className="text-2xl font-extrabold" style={{ color: primary }}>
                    {fmt(product.promo_price, product.currency)}
                  </span>
                </>
              ) : (
                <span className="text-2xl font-extrabold" style={{ color: primary }}>
                  {unit != null ? fmt(unit, product.currency) : "Sob consulta"}
                </span>
              )}
            </div>

            {product.stock_status && (
              <span
                className="inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: `${stockTone(product.stock_status)}1a`, color: stockTone(product.stock_status) }}
              >
                {stockLabel(product.stock_status)}
              </span>
            )}

            {product.short_desc && <p className="text-sm opacity-80">{product.short_desc}</p>}
            {product.long_desc && <p className="whitespace-pre-line text-sm opacity-70">{product.long_desc}</p>}

            {needsVariant && (
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider opacity-60">
                  Escolha uma variação <span style={{ color: primary }}>*</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v, i) => {
                    const on = variant === v.label;
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setVariant(v.label);
                          setWarn(false);
                        }}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold"
                        style={
                          on
                            ? { background: primary, color: readableInk(primary), border: `1px solid ${primary}` }
                            : { border: `1px solid ${warn ? "#dc2626" : line}` }
                        }
                      >
                        {v.label}
                        {v.price != null ? ` · ${fmt(v.price, product.currency)}` : ""}
                      </button>
                    );
                  })}
                </div>
                {warn && <p className="text-xs font-semibold text-red-600">Selecione uma variação para continuar.</p>}
              </div>
            )}

            {product.sku && <div className="text-xs opacity-60">Código: {product.sku}</div>}

            <div className="flex flex-wrap gap-2 pt-2">
              {product.external_url && (
                <a
                  href={product.external_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onTrack(`buy:${product.name}`)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
                  style={{ background: primary, color: readableInk(primary) }}
                >
                  <ExternalLink className="h-4 w-4" /> Comprar
                </a>
              )}
              {whatsapp && (
                <a
                  href={`https://wa.me/${String(whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(
                    `Olá! Tenho interesse no produto "${product.name}"${variant ? ` (${variant})` : ""}.`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onTrack(`whatsapp:${product.name}`)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
                  style={{ border: `1px solid ${primary}`, color: primary }}
                >
                  <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
                </a>
              )}
            </div>

            {canBuy && (
              qty === 0 ? (
                <button
                  onClick={addToCart}
                  className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold"
                  style={
                    needsVariant && !variant
                      ? { background: line, color: "inherit", opacity: 0.7 }
                      : { background: primary, color: readableInk(primary) }
                  }
                >
                  <ShoppingBag className="h-4 w-4" />
                  {needsVariant && !variant ? "Escolha uma variação" : "Adicionar ao carrinho"}
                </button>
              ) : (
                <div
                  className="flex items-center justify-between rounded-full px-2 py-1.5"
                  style={{ border: `1px solid ${primary}` }}
                >
                  <button
                    onClick={() => cart.setQty(product.id, qty - 1, needsVariant ? variant : null)}
                    className="grid h-8 w-8 place-items-center rounded-full text-lg font-bold"
                    style={{ color: primary }}
                    aria-label="Diminuir"
                  >
                    −
                  </button>
                  <span className="text-sm font-bold">
                    {qty} no carrinho{variant ? ` · ${variant}` : ""}
                  </span>
                  <button
                    onClick={addToCart}
                    className="grid h-8 w-8 place-items-center rounded-full text-lg font-bold"
                    style={{ background: primary, color: readableInk(primary) }}
                    aria-label="Aumentar"
                  >
                    +
                  </button>
                </div>
              )
            )}
          </div>
        </div>

        {/* VOCÊ TAMBÉM PODE GOSTAR */}
        {related.length > 0 && (
          <div className="border-t px-5 py-5" style={{ borderColor: line }}>
            <div className="mb-3 text-sm font-bold">Você também pode gostar</div>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {related.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSelect(r)}
                  className="w-[132px] shrink-0 overflow-hidden rounded-xl text-left"
                  style={{ border: `1px solid ${line}` }}
                >
                  <div className="aspect-[4/5] w-full overflow-hidden" style={{ background: line }}>
                    {r.image_url ? (
                      <LazyImg src={r.image_url} alt={r.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center opacity-40">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="line-clamp-2 text-xs font-semibold leading-snug">{r.name}</div>
                    <div className="mt-1 text-xs font-extrabold" style={{ color: primary }}>
                      {r.promo_price ?? r.price ? fmt(r.promo_price ?? r.price, r.currency) : "Sob consulta"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* LIGHTBOX / ZOOM */}
      {zoom && photos.length > 0 && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/95"
          onClick={(e) => {
            e.stopPropagation();
            setZoom(false);
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setZoom(false);
            }}
            aria-label="Fechar zoom"
            className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="flex flex-1 snap-x snap-mandatory items-center overflow-x-auto overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {photos.map((src, i) => (
              <div key={`z${i}`} className="flex h-full w-full shrink-0 snap-center items-center justify-center p-4">
                <img src={src} alt={`${product.name} ampliada ${i + 1}`} className="max-h-[85dvh] w-auto max-w-full object-contain" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
