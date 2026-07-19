import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getReviewContextByToken, submitReviewByToken } from "@/lib/reviews.functions";

type Props = { token: string; variant?: "auto" | "inline" };

export function RatingPrompt({ token, variant = "auto" }: Props) {
  const getCtx = useServerFn(getReviewContextByToken);
  const submit = useServerFn(submitReviewByToken);
  const qc = useQueryClient();
  const [open, setOpen] = useState(variant === "inline");
  const [dismissed, setDismissed] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [nps, setNps] = useState<number | null>(null);

  const { data } = useQuery({
    queryKey: ["review-ctx", token],
    queryFn: () => getCtx({ data: { token } }),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (variant !== "auto" || !data || dismissed) return;
    const key = data.lastStamp ? `rp-shown-${data.lastStamp.id}` : null;
    if (!key) return;
    if (!data.settings?.auto_prompt) return;
    if (data.existing) return;
    const ageMs = Date.now() - new Date(data.lastStamp!.created_at).getTime();
    if (ageMs > 72 * 3600 * 1000) return;
    if (typeof window !== "undefined" && window.localStorage.getItem(key)) return;
    setOpen(true);
  }, [data, variant, dismissed]);

  const mut = useMutation({
    mutationFn: async () => submit({ data: {
      token, rating, nps: nps ?? undefined,
      comment: comment.trim() || undefined,
    } }),
    onSuccess: () => {
      if (data?.lastStamp && typeof window !== "undefined") {
        window.localStorage.setItem(`rp-shown-${data.lastStamp.id}`, "1");
      }
      toast.success(data?.settings?.thank_you_message ?? "Obrigado pelo seu feedback!");
      qc.invalidateQueries({ queryKey: ["review-ctx", token] });
      // Google redirect for high ratings
      const min = data?.settings?.google_redirect_min_rating ?? 5;
      const url = data?.settings?.google_place_url;
      if (url && rating >= min) {
        setTimeout(() => { window.open(url, "_blank", "noopener"); }, 800);
      }
      setOpen(false);
      setRating(0); setComment(""); setNps(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return null;
  if (data.existing && variant === "auto") return null;
  if (!data.lastStamp && variant === "auto") return null;
  if (variant === "auto" && !open) return null;

  const est = (data.customer as { establishments?: { name?: string; primary_color?: string } })?.establishments;
  const primary = est?.primary_color ?? "#7C3AED";

  return (
    <Card className="relative overflow-hidden border-2 p-5 shadow-lg" style={{ borderColor: `${primary}55` }}>
      {variant === "auto" && (
        <button aria-label="Fechar" onClick={() => { setOpen(false); setDismissed(true); }}
                className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="text-base font-semibold">{data.settings?.prompt_title ?? "Como foi seu atendimento?"}</div>
      <p className="mt-1 text-sm text-muted-foreground">
        {data.settings?.prompt_message ?? "Sua opinião nos ajuda a melhorar."}
      </p>
      <div className="mt-4 flex justify-center gap-2" role="radiogroup" aria-label="Nota de 1 a 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n}
            aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
            onClick={() => setRating(n)}
            className="rounded-full p-1 transition hover:scale-110">
            <Star className={`h-9 w-9 ${rating >= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <Textarea
            className="mt-4"
            placeholder={rating >= 4 ? "Conta o que você mais gostou (opcional)" : "O que podemos melhorar? (opcional)"}
            value={comment}
            maxLength={1000}
            onChange={(e) => setComment(e.target.value)}
          />
          {data.settings?.ask_nps && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                De 0 a 10, quanto recomendaria para um amigo?
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                  <button key={n} type="button"
                    onClick={() => setNps(n)}
                    className={`h-9 w-9 rounded-lg text-sm font-semibold transition ${nps === n ? "text-white shadow" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                    style={nps === n ? { background: primary } : undefined}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button
            className="mt-4 w-full text-white"
            style={{ background: primary }}
            disabled={mut.isPending}
            onClick={() => mut.mutate()}>
            {mut.isPending ? "Enviando…" : "Enviar avaliação"}
          </Button>
        </>
      )}
    </Card>
  );
}
