import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Star, ExternalLink, Share2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getPublicReviewForm, submitPublicReview, logPublicReviewEvent } from "@/lib/public-reviews.functions";

type Question = {
  id: string;
  question: string;
  question_type: "stars" | "nps" | "yes_no" | "choice" | "short" | "long";
  choices: string[] | null;
  required: boolean;
};

function ensureDeviceId(): string {
  if (typeof window === "undefined") return "ssr-" + Math.random().toString(36).slice(2);
  const K = "prv-device-id";
  let v = window.localStorage.getItem(K);
  if (!v) { v = crypto.randomUUID(); window.localStorage.setItem(K, v); }
  return v;
}

export function PublicRatingBlock({ slug, source = "linktree", compact = false }: { slug: string; source?: "linktree" | "direct_url" | "qr"; compact?: boolean }) {
  const getFn = useServerFn(getPublicReviewForm);
  const submitFn = useServerFn(submitPublicReview);
  const logFn = useServerFn(logPublicReviewEvent);

  const { data } = useQuery({
    queryKey: ["public-review-form", slug],
    queryFn: () => getFn({ data: { slug } }),
  });

  const openedRef = useRef(false);
  useEffect(() => {
    if (data?.form && !openedRef.current) {
      openedRef.current = true;
      logFn({ data: { form_id: data.form.id, event_type: "page_opened" } }).catch(() => {});
    }
  }, [data, logFn]);

  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [consent, setConsent] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { text?: string; num?: number; bool?: boolean }>>({});
  const [result, setResult] = useState<{ action: string; google_url: string | null; success_message: string; selection_message?: string | null } | null>(null);

  const mut = useMutation({
    mutationFn: async () => submitFn({ data: {
      slug, rating, source,
      comment: comment.trim() || undefined,
      customer_name: anonymous ? undefined : (name.trim() || undefined),
      customer_phone: anonymous ? undefined : (phone.trim() || undefined),
      customer_email: anonymous ? undefined : (email.trim() || undefined),
      order_reference: orderRef.trim() || undefined,
      anonymous,
      device_id: ensureDeviceId(),
      answers: Object.entries(answers).map(([qid, v]) => ({
        question_id: qid,
        answer_text: v.text ?? null,
        answer_number: v.num ?? null,
        answer_boolean: v.bool ?? null,
      })),
    } }),
    onSuccess: (r) => {
      setResult(r);
      if (r.google_url && data?.form) {
        logFn({ data: { form_id: data.form.id, event_type: "google_shown" } }).catch(() => {});
      }
      toast.success(r.success_message);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const form = data?.form;
  const options = data?.options ?? [];
  const questions = (data?.questions ?? []) as Question[];
  const stats = data?.stats;
  const currentOpt = useMemo(() => options.find((o) => o.rating === rating), [options, rating]);

  if (!form) return null;

  const starColor = form.star_color || "#FACC15";
  const btnColor = form.button_color || "#7C3AED";
  const commentRequired = form.comment_required || currentOpt?.comment_required;

  // ============ RESULT ============
  if (result) {
    const isLow = rating <= 2;
    return (
      <Card className="overflow-hidden border-2" style={{ borderColor: `${btnColor}44` }}>
        <CardContent className="space-y-4 p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full" style={{ background: `${btnColor}22`, color: btnColor }}>
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold">{form.success_message}</h3>
          {isLow && (
            <p className="text-sm text-muted-foreground">
              Sentimos muito pela experiência. Sua mensagem foi encaminhada para a equipe entrar em contato.
            </p>
          )}
          {result.google_url && (
            <Button
              className="w-full text-white"
              style={{ background: btnColor }}
              onClick={() => {
                if (form) logFn({ data: { form_id: form.id, event_type: "google_clicked" } }).catch(() => {});
                window.open(result.google_url!, "_blank", "noopener");
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4" /> Avaliar também no Google
            </Button>
          )}
          {result.action === "invite_share" && typeof navigator !== "undefined" && "share" in navigator && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => (navigator as Navigator).share({ title: data.est.name, url: window.location.href }).catch(() => {})}
            >
              <Share2 className="mr-2 h-4 w-4" /> Compartilhar
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-2 shadow-lg" style={{ borderColor: `${btnColor}44` }}>
      <CardContent className={compact ? "p-4" : "p-6"}>
        <div className="text-center">
          <h3 className="text-lg font-bold tracking-tight">{form.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{form.question}</p>
          {form.description && <p className="mt-1 text-xs text-muted-foreground">{form.description}</p>}
          {stats && stats.count > 0 && (form.show_average || form.show_review_count) && (
            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              {form.show_average && <span className="flex items-center gap-1 font-semibold text-foreground"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{stats.avg.toFixed(1)}</span>}
              {form.show_review_count && <span>({stats.count} avaliações)</span>}
            </div>
          )}
        </div>

        {/* Stars */}
        <div className="mt-5 flex justify-center gap-1" role="radiogroup" aria-label="Nota">
          {[1, 2, 3, 4, 5].map((n) => {
            const enabled = options.some((o) => o.rating === n);
            const filled = (hover || rating) >= n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
                disabled={!enabled}
                onMouseEnter={() => enabled && setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => {
                  if (!enabled) return;
                  setRating(n);
                  if (form) logFn({ data: { form_id: form.id, event_type: "rating_selected" } }).catch(() => {});
                }}
                className="rounded-full p-1 transition hover:scale-110 disabled:opacity-25 disabled:cursor-not-allowed"
              >
                <Star
                  className="h-10 w-10"
                  style={{
                    fill: filled ? starColor : "transparent",
                    color: filled ? starColor : "currentColor",
                    opacity: filled ? 1 : 0.35,
                  }}
                />
              </button>
            );
          })}
        </div>

        {currentOpt && (
          <div className="mt-2 text-center text-sm font-semibold" style={{ color: btnColor }}>
            {currentOpt.label}
          </div>
        )}
        {currentOpt?.selection_message && (
          <p className="mt-1 text-center text-xs text-muted-foreground">{currentOpt.selection_message}</p>
        )}

        {rating > 0 && (
          <div className="mt-4 space-y-3">
            <div>
              <Label className="text-xs">
                Comentário {commentRequired ? <span className="text-destructive">*</span> : "(opcional)"}
              </Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={2000}
                placeholder={rating <= 2 ? "Conte o que aconteceu para que possamos melhorar" : "Conte o que mais gostou"}
                required={commentRequired}
              />
            </div>

            {form.anonymous_allowed && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={anonymous} onCheckedChange={(v) => setAnonymous(!!v)} />
                Enviar avaliação anônima
              </label>
            )}

            {!anonymous && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Nome {form.name_required && <span className="text-destructive">*</span>}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required={form.name_required} />
                </div>
                <div>
                  <Label className="text-xs">Telefone {form.phone_required && <span className="text-destructive">*</span>}</Label>
                  <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} required={form.phone_required} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">E-mail {form.email_required && <span className="text-destructive">*</span>}</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} required={form.email_required} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Nº do pedido / atendimento (opcional)</Label>
                  <Input value={orderRef} onChange={(e) => setOrderRef(e.target.value)} maxLength={80} />
                </div>
              </div>
            )}

            {questions.map((q) => (
              <div key={q.id} className="space-y-1.5">
                <Label className="text-xs">{q.question} {q.required && <span className="text-destructive">*</span>}</Label>
                {q.question_type === "short" && (
                  <Input value={answers[q.id]?.text ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: { text: e.target.value } })} maxLength={200} required={q.required} />
                )}
                {q.question_type === "long" && (
                  <Textarea value={answers[q.id]?.text ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: { text: e.target.value } })} maxLength={2000} required={q.required} />
                )}
                {q.question_type === "yes_no" && (
                  <RadioGroup value={answers[q.id]?.bool == null ? "" : String(answers[q.id]!.bool)} onValueChange={(v) => setAnswers({ ...answers, [q.id]: { bool: v === "true" } })}>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="true" />Sim</label>
                      <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="false" />Não</label>
                    </div>
                  </RadioGroup>
                )}
                {q.question_type === "choice" && (
                  <RadioGroup value={answers[q.id]?.text ?? ""} onValueChange={(v) => setAnswers({ ...answers, [q.id]: { text: v } })}>
                    <div className="flex flex-wrap gap-3">
                      {(q.choices ?? []).map((c) => (
                        <label key={c} className="flex items-center gap-2 text-sm"><RadioGroupItem value={c} />{c}</label>
                      ))}
                    </div>
                  </RadioGroup>
                )}
                {q.question_type === "stars" && (
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => setAnswers({ ...answers, [q.id]: { num: n } })}>
                        <Star className="h-6 w-6" style={{
                          fill: (answers[q.id]?.num ?? 0) >= n ? starColor : "transparent",
                          color: (answers[q.id]?.num ?? 0) >= n ? starColor : "currentColor",
                          opacity: (answers[q.id]?.num ?? 0) >= n ? 1 : 0.4,
                        }} />
                      </button>
                    ))}
                  </div>
                )}
                {q.question_type === "nps" && (
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                      <button key={n} type="button" onClick={() => setAnswers({ ...answers, [q.id]: { num: n } })}
                        className={`h-8 w-8 rounded-md text-xs font-semibold ${answers[q.id]?.num === n ? "text-white" : "bg-muted text-muted-foreground"}`}
                        style={answers[q.id]?.num === n ? { background: btnColor } : undefined}>{n}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {!anonymous && form.consent_text && (name || phone || email) && (
              <label className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
                <span>{form.consent_text}</span>
              </label>
            )}

            <Button
              className="w-full text-white"
              style={{ background: btnColor }}
              disabled={
                mut.isPending ||
                rating === 0 ||
                (commentRequired && !comment.trim()) ||
                (!anonymous && form.name_required && !name.trim()) ||
                (!anonymous && form.phone_required && !phone.trim()) ||
                (!anonymous && form.email_required && !email.trim()) ||
                (!anonymous && !!form.consent_text && (!!name || !!phone || !!email) && !consent)
              }
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? "Enviando…" : form.submit_label}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
