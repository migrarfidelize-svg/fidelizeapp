import { useEffect, useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPendingStampReview, submitStampReview } from "@/lib/wallet-reviews.functions";
import { Star, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const DISMISS_KEY = "wallet:review-dismissed";

function isDismissed(stampId: string): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const set = JSON.parse(raw) as string[];
    return Array.isArray(set) && set.includes(stampId);
  } catch { return false; }
}

function markDismissed(stampId: string) {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    const set: string[] = raw ? JSON.parse(raw) : [];
    if (!set.includes(stampId)) set.push(stampId);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(set.slice(-50)));
  } catch { /* ignore */ }
}

/**
 * Mostra um bottom sheet contextual após o cliente receber um carimbo
 * (via Supabase Realtime + polling). Uma vez avaliado ou dispensado,
 * o carimbo não abre o prompt novamente na mesma sessão/dispositivo.
 * Deve ser montado uma única vez no layout `/carteira`.
 */
export function PostStampReviewSheet() {
  const qc = useQueryClient();
  const shownRef = useRef<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [thanks, setThanks] = useState<null | { estName: string; primary: string; googleUrl: string | null; showGoogle: boolean; message: string }>(null);

  const { data: pending, refetch } = useQuery({
    queryKey: ["pending-stamp-review"],
    queryFn: () => getPendingStampReview(),
    staleTime: 10_000,
    refetchInterval: 60_000,
  });

  // Realtime: escuta novos stamps para carimbos do usuário e re-consulta.
  useEffect(() => {
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
      if (!userId) return;
      channel = supabase
        // Sufixo único: reusar o mesmo nome reanexa callbacks num canal já inscrito.
        .channel(`wallet-stamps-${userId}-${Math.random().toString(36).slice(2, 8)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "stamps" }, () => {
          refetch();
        })
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Abre o sheet quando um novo pending aparece e não foi dispensado.
  useEffect(() => {
    if (!pending) return;
    if (shownRef.current.has(pending.stampId)) return;
    if (isDismissed(pending.stampId)) return;
    shownRef.current.add(pending.stampId);
    // Pequeno delay pra dar tempo do toast de carimbo aparecer primeiro.
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [pending]);

  const mutation = useMutation({
    mutationFn: submitStampReview,
    onSuccess: () => {
      if (!pending) return;
      const showGoogle =
        !!pending.settings.google_place_url &&
        rating >= (pending.settings.google_redirect_min_rating ?? 5);
      setThanks({
        estName: pending.establishment.name,
        primary: pending.establishment.primary_color || "#a78bfa",
        googleUrl: pending.settings.google_place_url ?? null,
        showGoogle,
        message: pending.settings.thank_you_message,
      });
      setOpen(false);
      setRating(0);
      setComment("");
      qc.invalidateQueries({ queryKey: ["pending-stamp-review"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Não foi possível enviar."),
  });

  function dismiss() {
    if (pending) markDismissed(pending.stampId);
    setOpen(false);
    setRating(0);
    setComment("");
  }

  function submit() {
    if (!pending || rating < 1) return;
    mutation.mutate({
      data: {
        stampId: pending.stampId,
        rating,
        comment: comment.trim() || undefined,
        isPublic: true,
      },
    });
  }

  if (thanks && !open) {
    return (
      <ThanksSheet
        thanks={thanks}
        onClose={() => setThanks(null)}
      />
    );
  }

  if (!open || !pending) return null;

  const est = pending.establishment;
  const primary = est.primary_color || "#a78bfa";

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={dismiss}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[71] mx-auto w-full max-w-3xl rounded-t-3xl border-t border-x border-border/70 bg-background p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-prompt-title"
      >
        <div
          className="pointer-events-none absolute -top-16 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full opacity-25 blur-3xl"
          style={{ background: primary }}
        />
        <div className="relative">
          <button
            onClick={dismiss}
            className="absolute right-0 top-0 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mb-3 flex items-center gap-3">
            <div
              className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border/60 bg-muted text-base font-black uppercase"
              style={{ borderColor: `${primary}55` }}
            >
              {est.logo_url ? (
                <img src={est.logo_url} alt={est.name} className="h-full w-full object-cover" />
              ) : (
                est.name.charAt(0)
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Novo carimbo em {est.name}
              </div>
              <h2 id="review-prompt-title" className="font-display text-lg font-bold leading-tight">
                {pending.settings.prompt_title}
              </h2>
              <p className="text-xs text-muted-foreground">{pending.settings.prompt_message}</p>
            </div>
          </div>

          <div
            className="flex items-center justify-center gap-1 rounded-2xl border border-border/60 bg-card/40 p-3"
            onMouseLeave={() => setHover(0)}
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const active = (hover || rating) >= n;
              return (
                <button
                  key={n}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => setRating(n)}
                  className="grid h-11 w-11 place-items-center rounded-xl transition-transform hover:scale-110 active:scale-95"
                  aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                >
                  <Star
                    className={"h-8 w-8 transition-colors " + (active ? "fill-current" : "")}
                    style={{ color: active ? primary : "hsl(var(--muted-foreground) / 0.5)" }}
                  />
                </button>
              );
            })}
          </div>

          {rating > 0 && (
            <div className="mt-3 space-y-3 animate-in fade-in duration-200">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={rating >= 4 ? "O que você mais gostou? (opcional)" : "Como podemos melhorar? (opcional)"}
                maxLength={1000}
                rows={3}
                className="w-full resize-none rounded-2xl border border-border/60 bg-card/40 p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
              />
              <button
                onClick={submit}
                disabled={mutation.isPending}
                className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:brightness-110 disabled:opacity-60"
                style={{ background: primary, color: "#000" }}
              >
                {mutation.isPending ? "Enviando…" : "Enviar avaliação"}
              </button>
            </div>
          )}

          <button
            onClick={dismiss}
            className="mt-3 w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Agora não
          </button>
        </div>
      </div>
    </>
  );
}

function ThanksSheet({ thanks, onClose }: {
  thanks: { estName: string; primary: string; googleUrl: string | null; showGoogle: boolean; message: string };
  onClose: () => void;
}) {
  useEffect(() => {
    if (!thanks.showGoogle) {
      const t = setTimeout(onClose, 3500);
      return () => clearTimeout(t);
    }
  }, [thanks.showGoogle, onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[71] mx-auto w-full max-w-3xl rounded-t-3xl border-t border-x border-border/70 bg-background p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="text-center">
          <div
            className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl text-3xl"
            style={{ background: `${thanks.primary}22`, color: thanks.primary }}
          >
            ⭐
          </div>
          <h3 className="font-display text-lg font-bold">{thanks.message}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Sua avaliação foi enviada a {thanks.estName}.
          </p>
          {thanks.showGoogle && thanks.googleUrl && (
            <a
              href={thanks.googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg"
              onClick={() => setTimeout(onClose, 400)}
            >
              <ExternalLink className="h-4 w-4" />
              Compartilhar no Google também
            </a>
          )}
          <button
            onClick={onClose}
            className="mt-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Fechar
          </button>
        </div>
      </div>
    </>
  );
}
