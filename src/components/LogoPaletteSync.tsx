import { useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { extractPaletteFromUrl, type LogoPalette } from "@/lib/logo-palette";

export type PaletteFields = {
  primary?: boolean;
  accent?: boolean;
  background?: boolean;
  text?: boolean;
};

type Props = {
  logoUrl: string | null | undefined;
  onApply: (palette: LogoPalette) => void;
  /** Rótulos das cores que serão aplicadas (para descrever o que muda). */
  fields?: PaletteFields;
  /** Texto complementar sob o botão. */
  hint?: string;
  className?: string;
};

/**
 * Bloco reutilizável que extrai a paleta da logo do estabelecimento e aplica
 * automaticamente nas cores do editor (primária, acento, fundo e texto).
 */
export function LogoPaletteSync({
  logoUrl,
  onApply,
  fields = { primary: true, accent: true, background: true, text: true },
  hint,
  className = "",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [palette, setPalette] = useState<LogoPalette | null>(null);

  const applyLabel = [
    fields.primary && "primária",
    fields.accent && "acento",
    fields.background && "fundo",
    fields.text && "texto",
  ].filter(Boolean).join(" • ");

  async function run() {
    if (!logoUrl) {
      toast.error("Envie primeiro uma logo em Configurações → Marca.");
      return;
    }
    setLoading(true);
    try {
      const p = await extractPaletteFromUrl(logoUrl);
      setPalette(p);
      onApply(p);
      toast.success("Paleta sincronizada com a logo.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao analisar a logo.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`rounded-xl border border-border/60 bg-gradient-to-br from-primary/5 to-transparent p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <Wand2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Sincronizar cores com a logo
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {hint ?? `Analisamos a sua logo e aplicamos automaticamente as cores (${applyLabel}). Você pode ajustar depois.`}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={run} disabled={loading || !logoUrl}>
              {loading ? (<><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Analisando…</>) : (<><Wand2 className="mr-1.5 h-3.5 w-3.5" /> Aplicar agora</>)}
            </Button>
            {!logoUrl && (
              <span className="text-[11px] text-muted-foreground">Envie uma logo para habilitar.</span>
            )}
            {palette && (
              <div className="flex items-center gap-1">
                {palette.swatches.slice(0, 5).map((c) => (
                  <span key={c} className="h-5 w-5 rounded-full border border-border/60 shadow-sm" style={{ background: c }} title={c} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
