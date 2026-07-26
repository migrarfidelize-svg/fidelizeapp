import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Minus, Plus, ShoppingCart, Trash2, X, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { createCatalogOrder } from "@/lib/orders.functions";
import { trackChannelEvent } from "@/lib/tracking";
import type { useCart } from "@/lib/cart";

type Product = {
  id: string;
  name: string;
  price: number | null;
  promo_price: number | null;
  currency: string;
  image_url: string | null;
};

function fmt(v: number, currency = "BRL") {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
  } catch {
    return `R$ ${v.toFixed(2)}`;
  }
}

const unitOf = (p: Product) => Number(p.promo_price ?? p.price ?? 0);

export function CatalogCart({
  slug,
  items,
  cart,
  primary,
  ink,
  whatsapp,
}: {
  slug: string;
  items: Product[];
  cart: ReturnType<typeof useCart>;
  primary: string;
  ink: string;
  whatsapp: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const send = useServerFn(createCatalogOrder);

  const detailed = useMemo(
    () =>
      cart.lines
        .map((l) => {
          const p = items.find((i) => i.id === l.id);
          const variantPrice = (p as any)?.variants?.find?.((v: any) => v?.label === l.variant)?.price;
          const unit = variantPrice != null ? Number(variantPrice) : p ? unitOf(p) : 0;
          return p ? { ...p, qty: l.qty, variant: l.variant ?? null, unit, lineTotal: unit * l.qty } : null;
        })
        .filter(Boolean) as (Product & { qty: number; variant: string | null; unit: number; lineTotal: number })[],
    [cart.lines, items],
  );


  const total = detailed.reduce((a, l) => a + l.lineTotal, 0);
  const currency = detailed[0]?.currency ?? "BRL";

  if (cart.count === 0) return null;

  async function submit() {
    if (name.trim().length < 2) {
      toast.error("Informe seu nome para continuar.");
      return;
    }
    if (fulfillment === "delivery" && address.trim().length < 5) {
      toast.error("Informe o endereço de entrega.");
      return;
    }
    setSending(true);
    try {
      const res = await send({
        data: {
          slug,
          customer_name: name.trim(),
          customer_phone: phone.trim() || null,
          fulfillment,
          address: address.trim() || null,
          note: note.trim() || null,
          items: cart.lines.map((l) => ({ item_id: l.id, qty: l.qty })),
        },
      });

      const linesTxt = res.lines
        .map((l: any) => `• ${l.qty}x ${l.name} — ${fmt(Number(l.line_total), res.currency)}`)
        .join("\n");
      const msg = [
        `*Pedido #${res.order_number}* — ${res.establishment.name}`,
        "",
        linesTxt,
        "",
        `*Total: ${fmt(Number(res.total), res.currency)}*`,
        "",
        `Nome: ${name.trim()}`,
        phone.trim() ? `Telefone: ${phone.trim()}` : null,
        fulfillment === "delivery" ? `Entrega: ${address.trim()}` : "Retirada no local",
        note.trim() ? `Obs.: ${note.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const num = String(res.establishment.whatsapp || res.establishment.phone || whatsapp || "").replace(/\D/g, "");
      trackChannelEvent({
        slug,
        channel: "catalog",
        event_type: "link_click",
        ref_label: `order:${res.order_number}`,
      });

      cart.clear();
      setOpen(false);
      toast.success(`Pedido #${res.order_number} enviado!`);

      if (num) {
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
      } else {
        toast.info("A loja ainda não cadastrou um WhatsApp — o pedido foi registrado no painel dela.");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível enviar o pedido.");
    } finally {
      setSending(false);
    }
  }

  const field = "w-full rounded-xl px-3 py-2 text-sm outline-none";
  const fieldStyle = { background: "var(--mk-surface)", border: "1px solid var(--mk-line)", color: "inherit" };

  return (
    <>
      {/* Barra flutuante */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4">
        <button
          onClick={() => setOpen(true)}
          className="pointer-events-auto mx-auto flex w-full max-w-md items-center justify-between gap-3 rounded-full px-5 py-3.5 text-sm font-bold shadow-2xl"
          style={{ background: primary, color: ink }}
        >
          <span className="inline-flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            {cart.count} {cart.count === 1 ? "item" : "itens"}
          </span>
          <span>Ver carrinho · {fmt(total, currency)}</span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-6" onClick={() => setOpen(false)}>
          <div
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            style={{ background: "var(--mk-surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between px-5 py-4" style={{ background: "var(--mk-surface)", borderBottom: "1px solid var(--mk-line)" }}>
              <h2 className="fx-serif text-lg font-extrabold">Seu pedido</h2>
              <button onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-full p-1.5 opacity-70">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 p-5">
              {detailed.map((l) => (
                <div key={`${l.id}::${l.variant ?? ""}`} className="flex items-center gap-3">
                  {l.image_url ? (
                    <img src={l.image_url} alt={l.name} className="h-14 w-14 rounded-xl object-cover" />
                  ) : (
                    <div className="grid h-14 w-14 place-items-center rounded-xl opacity-40" style={{ border: "1px solid var(--mk-line)" }}>
                      <ShoppingCart className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{l.name}</div>
                    {l.variant && <div className="truncate text-[11px] opacity-70">Variação: {l.variant}</div>}
                    <div className="text-xs opacity-70">{fmt(l.unit, l.currency)}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => cart.setQty(l.id, l.qty - 1, l.variant)} aria-label="Diminuir" className="grid h-7 w-7 place-items-center rounded-full" style={{ border: "1px solid var(--mk-line)" }}>
                      {l.qty === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                    </button>
                    <span className="w-5 text-center text-sm font-bold">{l.qty}</span>
                    <button onClick={() => cart.setQty(l.id, l.qty + 1, l.variant)} aria-label="Aumentar" className="grid h-7 w-7 place-items-center rounded-full" style={{ background: primary, color: ink }}>
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}


              <div className="flex items-center justify-between pt-2 text-base font-extrabold" style={{ borderTop: "1px solid var(--mk-line)" }}>
                <span className="pt-2">Total</span>
                <span className="pt-2" style={{ color: primary }}>{fmt(total, currency)}</span>
              </div>

              <div className="space-y-2 pt-2">
                <input className={field} style={fieldStyle} placeholder="Seu nome *" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
                <input className={field} style={fieldStyle} placeholder="WhatsApp / telefone" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} />

                <div className="grid grid-cols-2 gap-2">
                  {(["pickup", "delivery"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFulfillment(f)}
                      className="rounded-xl px-3 py-2 text-sm font-semibold"
                      style={
                        fulfillment === f
                          ? { background: primary, color: ink }
                          : { border: "1px solid var(--mk-line)" }
                      }
                    >
                      {f === "pickup" ? "Retirar no local" : "Entrega"}
                    </button>
                  ))}
                </div>

                {fulfillment === "delivery" && (
                  <input className={field} style={fieldStyle} placeholder="Endereço de entrega *" value={address} maxLength={240} onChange={(e) => setAddress(e.target.value)} />
                )}

                <textarea className={field} style={fieldStyle} rows={2} placeholder="Observação (opcional)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
              </div>

              <button
                onClick={submit}
                disabled={sending}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold disabled:opacity-60"
                style={{ background: primary, color: ink }}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                Enviar pedido no WhatsApp
              </button>
              <p className="pb-2 text-center text-[11px] opacity-60">
                O pedido é registrado para a loja e a conversa abre no WhatsApp para confirmar.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
