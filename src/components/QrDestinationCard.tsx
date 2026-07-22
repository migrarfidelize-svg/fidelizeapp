import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getQrDestinationStatus, setQrDestination } from "@/lib/linktree.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";

type Dest = "reviews" | "linktree" | "landing";

export function QrDestinationCard({ establishmentId }: { establishmentId: string }) {
  const getFn = useServerFn(getQrDestinationStatus);
  const setFn = useServerFn(setQrDestination);
  const q = useQuery({
    queryKey: ["qr-destination", establishmentId],
    queryFn: () => getFn({ data: { establishment_id: establishmentId } }),
  });
  const [dest, setDest] = useState<Dest>("reviews");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.data?.destination) setDest(q.data.destination);
  }, [q.data?.destination]);

  const linktreeReady = !!q.data?.linktree_published;
  const reviewsReady = !!q.data?.review_form_active;

  async function save(next: Dest) {
    setDest(next);
    setSaving(true);
    try {
      await setFn({ data: { establishment_id: establishmentId, destination: next } });
      toast.success("Destino do QR atualizado.");
      q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const showWarning =
    (dest === "linktree" && !linktreeReady) ||
    (dest === "reviews" && !reviewsReady);

  return (
    <Card className="border-primary/20 bg-card/70">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Para onde o QR leva
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              O QR físico continua o mesmo — você troca o destino a qualquer momento.
            </p>
          </div>
          <Select value={dest} onValueChange={(v) => save(v as Dest)} disabled={saving}>
            <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="reviews">Avaliação de atendimento</SelectItem>
              <SelectItem value="linktree">Árvore de Links</SelectItem>
              <SelectItem value="landing">Página do estabelecimento</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showWarning ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
            {dest === "linktree" ? (
              <div className="flex-1">
                <p className="font-medium">Você ainda não possui uma Árvore de Links publicada.</p>
                <Button asChild size="sm" variant="outline" className="mt-2">
                  <Link to="/app/linktree">Criar Árvore de Links</Link>
                </Button>
              </div>
            ) : (
              <div className="flex-1">
                <p className="font-medium">Você ainda não possui uma avaliação ativa.</p>
                <Button asChild size="sm" variant="outline" className="mt-2">
                  <Link to="/app/avaliacoes">Configurar avaliação</Link>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-muted-foreground">
              Destino ativo e pronto para receber scans.
            </span>
            {q.data?.slug && (
              <a
                href={`/${dest === "linktree" ? "links" : dest === "landing" ? "l" : "avaliar"}/${q.data.slug}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
              >
                Ver <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
