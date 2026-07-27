import { useState } from "react";
import { ShoppingBag, Sparkles, Check, ExternalLink, Truck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type DisplayModel = {
  id: string;
  name: string;
  tag: string;
  price: number;
  oldPrice?: number;
  features: string[];
  gradient: string;
  accent: string;
  icon: string;
};

const MODELS: DisplayModel[] = [
  {
    id: "essential",
    name: "Essencial",
    tag: "Mais vendido",
    price: 39.9,
    oldPrice: 59.9,
    features: ["Acrílico cristal 3mm", "Balcão 10×15 cm", "Base curvada 15°"],
    gradient: "from-cyan-500/25 via-cyan-400/10 to-transparent",
    accent: "border-cyan-400/40",
    icon: "▯",
  },
  {
    id: "pro",
    name: "Pro NFC",
    tag: "Toque + QR",
    price: 89.9,
    oldPrice: 119.9,
    features: ["Chip NFC embutido", "Acrílico premium 5mm", "Impressão dupla face"],
    gradient: "from-violet-500/25 via-primary/10 to-transparent",
    accent: "border-primary/50",
    icon: "◈",
  },
  {
    id: "totem",
    name: "Totem Mesa",
    tag: "Premium",
    price: 149.9,
    features: ["Base metálica escovada", "LED contorno cyan", "Cabo USB-C incluso"],
    gradient: "from-amber-400/25 via-orange-400/10 to-transparent",
    accent: "border-amber-400/40",
    icon: "◇",
  },
];

/**
 * Preview-only storefront card. Buttons open a placeholder external link;
 * the real store flow will be wired later.
 */
export function DisplayStorePreview() {
  const [selected, setSelected] = useState<string>("pro");

  const openStore = (modelId: string) => {
    // Placeholder — will be replaced by the real affiliate/checkout URL.
    const url = `https://fidelize.app/loja/displays?model=${modelId}&utm_source=app&utm_medium=qr-page`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-background to-background p-4 shadow-inner">
      {/* subtle animated glow */}
      <div className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-0 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              <Sparkles className="h-3 w-3" /> Loja Fidelize
            </div>
            <div className="text-sm font-bold leading-tight">
              Adquira seu display físico de balcão
            </div>
            <div className="text-[11px] text-muted-foreground">
              Cartazes prontos pra imprimir + suporte acrílico entregue na sua porta.
            </div>
          </div>
          <Badge variant="outline" className="shrink-0 border-primary/40 bg-primary/10 text-[10px] font-semibold text-primary">
            Preview
          </Badge>
        </div>

        {/* Models */}
        <div className="grid gap-2">
          {MODELS.map((m) => {
            const isSelected = selected === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m.id)}
                className={`group relative overflow-hidden rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? `${m.accent} bg-card shadow-lg shadow-primary/10 scale-[1.01]`
                    : "border-border/60 bg-card/40 hover:border-primary/30 hover:bg-card/70"
                }`}
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${m.gradient} opacity-${isSelected ? "100" : "50"} transition-opacity`} />
                <div className="relative flex items-center gap-3">
                  {/* Icon tile */}
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${m.accent} bg-background/80 text-2xl font-light`}>
                    <span style={{ background: "linear-gradient(135deg, hsl(var(--primary)), #d946ef)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                      {m.icon}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold">{m.name}</span>
                      <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-semibold uppercase tracking-wide">
                        {m.tag}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {m.features.map((f) => (
                        <span key={f} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Check className="h-2.5 w-2.5 text-primary" /> {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {m.oldPrice && (
                      <div className="text-[10px] text-muted-foreground line-through">
                        R$ {m.oldPrice.toFixed(2).replace(".", ",")}
                      </div>
                    )}
                    <div className="text-base font-black leading-none text-primary">
                      R$ {m.price.toFixed(2).replace(".", ",")}
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">à vista</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2 text-[10px]">
          <div className="flex items-center gap-1.5">
            <Truck className="h-3 w-3 text-primary" />
            <span>Envio em 3–5 dias úteis</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-primary" />
            <span>Garantia 30 dias</span>
          </div>
        </div>

        {/* CTA */}
        <Button
          onClick={() => openStore(selected)}
          className="group w-full bg-gradient-to-r from-primary via-primary to-violet-500 text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:shadow-primary/40"
        >
          <ShoppingBag className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
          Comprar {MODELS.find((m) => m.id === selected)?.name}
          <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-70" />
        </Button>

        <p className="text-center text-[10px] leading-tight text-muted-foreground">
          Preview da vitrine — a loja completa será configurada em breve.
        </p>
      </div>
    </div>
  );
}
