import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { listActivePlans, changeEstablishmentPlan, getMyPlanUsage } from "@/lib/plans.functions";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Star, Check, Loader2, Users, Sparkles, UserCog, ArrowUp, ArrowDown,
  ChevronDown, Shield, Zap, Crown,
} from "lucide-react";
import { toast } from "sonner";
import { PaymentDialog } from "@/components/PaymentDialog";

export const Route = createFileRoute("/_authenticated/app/planos/")({
  component: MerchantPlansPage,
});

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtLimit(v: number | null | undefined) { return v == null ? "Ilimitado" : v.toString(); }

const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, enterprise: 3 };
const TIER_ICON: Record<string, any> = { free: Shield, starter: Zap, pro: Sparkles, enterprise: Crown };

function MerchantPlansPage() {
  const list = useServerFn(listActivePlans);
  const change = useServerFn(changeEstablishmentPlan);
  const getEsts = useServerFn(getMyEstablishments);
  const getUsage = useServerFn(getMyPlanUsage);
  const qc = useQueryClient();
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const activeEst = memberships?.[0]?.establishment as { id: string; plan?: string } | undefined;
  const { data: plans, isLoading } = useQuery({ queryKey: ["active-plans"], queryFn: () => list() });
  const { data: usage } = useQuery({
    queryKey: ["plan-usage", activeEst?.id],
    queryFn: () => getUsage({ data: { establishment_id: activeEst!.id } }),
    enabled: !!activeEst?.id,
  });

  const currentTier = usage?.plan?.tier;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState<null | { slug: string; name: string; tier: string; price: number; kind: "upgrade" | "downgrade" | "plan_change" }>(null);
  const [saving, setSaving] = useState(false);
  const [payFor, setPayFor] = useState<null | { slug: string; name: string; price_monthly: number; tier: string }>(null);

  function askChange(p: any) {
    if (!activeEst || !currentTier) return;
    if (p.tier === currentTier) return;
    const kind: "upgrade" | "downgrade" | "plan_change" =
      (PLAN_RANK[p.tier] ?? 0) > (PLAN_RANK[currentTier] ?? 0) ? "upgrade"
      : (PLAN_RANK[p.tier] ?? 0) < (PLAN_RANK[currentTier] ?? 0) ? "downgrade" : "plan_change";
    const price = Number(p.price_monthly ?? 0);
    if (price > 0 && kind !== "downgrade") {
      setPayFor({ slug: p.slug, name: p.name, price_monthly: price, tier: p.tier });
    } else {
      setPending({ slug: p.slug, name: p.name, tier: p.tier, price, kind });
    }
  }

  async function confirmChange() {
    if (!pending || !activeEst) return;
    setSaving(true);
    try {
      const res: any = await change({ data: { establishment_id: activeEst.id, plan_slug: pending.slug } });
      toast.success(
        res.kind === "upgrade" ? `Upgrade concluído! Bem-vindo ao ${pending.name}.`
        : res.kind === "downgrade" ? `Downgrade aplicado para ${pending.name}.`
        : `Plano alterado para ${pending.name}.`
      );
      setPending(null);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao alterar plano.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Assinatura</div>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Planos e Preços</h1>
        <p className="text-sm text-muted-foreground mt-2">Cresça no seu ritmo — mude de plano quando quiser, sem burocracia.</p>
      </motion.div>

      {/* Painel "Seu plano atual" — split premium navy */}
      {usage?.plan && (
        <CurrentPlanPanel usage={usage} />
      )}

      {/* Grid de planos */}
      {isLoading ? (
        <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3 items-start pt-4">
          {(plans ?? []).map((p: any, idx: number) => (
            <PlanCard
              key={p.id}
              plan={p}
              index={idx}
              isCurrent={p.tier === currentTier}
              canAct={!!activeEst}
              expanded={expanded === p.id}
              onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
              onAct={() => askChange(p)}
              currentRank={currentTier ? PLAN_RANK[currentTier] ?? 0 : 0}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-display">
              {pending?.kind === "upgrade" && <ArrowUp className="h-5 w-5 text-primary" />}
              {pending?.kind === "downgrade" && <ArrowDown className="h-5 w-5 text-destructive" />}
              {pending?.kind === "upgrade" ? "Confirmar upgrade"
                : pending?.kind === "downgrade" ? "Confirmar downgrade"
                : "Confirmar mudança de plano"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>
                  Você está prestes a mudar de <strong>{usage?.plan?.name ?? currentTier}</strong> para <strong>{pending?.name}</strong>.
                </div>
                <div className="rounded-lg border p-3 bg-muted/40">
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor mensal</span><span className="font-semibold">{pending ? fmtBRL(pending.price) : "—"}</span></div>
                </div>
                {pending?.kind === "downgrade" && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
                    Ao fazer downgrade você poderá perder acesso a recursos e ficar acima dos limites do novo plano.
                  </div>
                )}
                <div className="text-xs text-muted-foreground">A alteração é registrada em histórico de assinaturas e auditoria.</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmChange} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aplicando…</> : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PaymentDialog
        open={!!payFor}
        onOpenChange={(o) => !o && setPayFor(null)}
        plan={payFor}
        establishmentId={activeEst?.id ?? ""}
      />
    </div>
  );
}

/* ================== Seu plano atual — Painel premium navy ================== */
function CurrentPlanPanel({ usage }: { usage: any }) {
  const plan = usage.plan;
  const u = usage.usage;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a1a] text-white shadow-[0_30px_80px_-30px_rgba(79,70,229,0.5)]"
    >
      {/* Grid pattern + glow */}
      <div className="pointer-events-none absolute inset-0 opacity-40"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <motion.div
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(79,70,229,0.5), transparent 70%)" }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(167,139,250,0.35), transparent 70%)" }}
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative grid gap-8 p-8 md:grid-cols-[1fr_2fr]">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Assinatura ativa
          </div>
          <div>
            <div className="text-xs text-white/50">Seu plano atual</div>
            <div className="font-display text-3xl font-bold tracking-tight mt-1">{plan.name}</div>
            <div className="text-sm text-white/60 mt-1">{plan.description ?? "Tudo funcionando perfeitamente."}</div>
          </div>
          <div className="flex items-baseline gap-1 pt-2">
            <span className="font-display text-4xl font-bold text-white">{fmtBRL(Number(plan.price_monthly ?? 0))}</span>
            <span className="text-sm text-white/50">/mês</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <RadialUsage label="Clientes" icon={Users} used={u.customers} limit={plan.customer_limit} />
          <RadialUsage label="Campanhas" icon={Sparkles} used={u.campaigns} limit={plan.campaign_limit} />
          <RadialUsage label="Equipe" icon={UserCog} used={u.employees} limit={plan.employee_limit} />
        </div>
      </div>
    </motion.div>
  );
}

function RadialUsage({ label, icon: Icon, used, limit }: { label: string; icon: any; used: number; limit: number | null }) {
  const pct = limit == null ? 100 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const near = pct >= 80 && limit != null;
  const size = 96;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  const color = limit == null ? "#a78bfa" : near ? "#f97316" : "#4f46e5";
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="relative rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur"
    >
      <div className="flex items-center gap-2 text-xs text-white/60">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} strokeLinecap="round" fill="none"
            initial={{ strokeDasharray: `0 ${circ}` }}
            animate={{ strokeDasharray: `${dash} ${circ}` }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div>
          <div className="font-display text-2xl font-bold leading-none">{used}</div>
          <div className="text-[11px] text-white/50 mt-1">de {limit == null ? "∞" : limit}</div>
          {near && <div className="text-[10px] text-orange-300 mt-1 uppercase tracking-wider">quase no limite</div>}
        </div>
      </div>
    </motion.div>
  );
}

/* ================== Card de Plano com expansão + featured impactante ================== */
function PlanCard({
  plan, index, isCurrent, canAct, expanded, onToggle, onAct, currentRank,
}: {
  plan: any; index: number; isCurrent: boolean; canAct: boolean;
  expanded: boolean; onToggle: () => void; onAct: () => void; currentRank: number;
}) {
  const featured = plan.is_featured;
  const Icon = TIER_ICON[plan.tier] ?? Sparkles;
  const rank = PLAN_RANK[plan.tier] ?? 0;
  const isUpgrade = rank > currentRank;
  const isDowngrade = rank < currentRank;
  const features: any[] = plan.features ?? [];
  const primary = features.slice(0, 4);
  const rest = features.slice(4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: featured ? -8 : -4 }}
      className={`relative group ${featured ? "md:-my-3" : ""}`}
    >
      {/* Aura animada do featured */}
      {featured && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-[2px] rounded-2xl opacity-90"
          style={{
            background: "conic-gradient(from 0deg, #4f46e5, #a78bfa, #22d3ee, #4f46e5)",
            filter: "blur(14px)",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
      )}

      <div
        className={[
          "relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300",
          featured
            ? "bg-[#0a0a1a] text-white border border-white/10 shadow-[0_30px_80px_-30px_rgba(79,70,229,0.6)]"
            : "bg-card border border-border shadow-sm hover:shadow-lg hover:border-primary/30",
        ].join(" ")}
      >
        {/* Fundo animado no featured */}
        {featured && (
          <>
            <div className="pointer-events-none absolute inset-0 opacity-30"
              style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <motion.div
              className="pointer-events-none absolute -top-16 -right-16 h-60 w-60 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(79,70,229,0.55), transparent 70%)" }}
              animate={{ opacity: [0.5, 0.85, 0.5] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}

        {/* Ribbon Mais popular */}
        {featured && (
          <div className="absolute top-4 right-4 z-10">
            <motion.div
              initial={{ scale: 0, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 260 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white shadow-lg"
            >
              <Star className="h-3 w-3 fill-current" /> Mais popular
            </motion.div>
          </div>
        )}

        {isCurrent && (
          <div className="absolute top-4 left-4 z-10">
            <Badge variant="outline" className={featured ? "border-white/30 bg-white/10 text-white text-[10px] uppercase tracking-widest" : "text-[10px] uppercase tracking-widest"}>
              Ativo
            </Badge>
          </div>
        )}

        <div className="relative p-6 pt-14">
          <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${featured ? "bg-white/10 text-white" : "bg-primary/10 text-primary"}`}>
            <Icon className="h-5 w-5" />
          </div>
          <h3 className={`font-display text-2xl font-bold mt-4 tracking-tight ${featured ? "text-white" : ""}`}>{plan.name}</h3>
          <p className={`text-sm mt-1 ${featured ? "text-white/60" : "text-muted-foreground"}`}>{plan.description}</p>

          <div className="mt-5 flex items-baseline gap-1">
            <span className={`font-display text-5xl font-bold tracking-tight ${featured ? "text-white" : ""}`}>
              {fmtBRL(Number(plan.price_monthly))}
            </span>
            <span className={`text-sm ${featured ? "text-white/50" : "text-muted-foreground"}`}>/mês</span>
          </div>
        </div>

        <div className="relative px-6 pb-6 flex-1 flex flex-col gap-5">
          {/* Limites em pills */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "clientes", value: fmtLimit(plan.customer_limit) },
              { label: "campanhas", value: fmtLimit(plan.campaign_limit) },
              { label: "equipe", value: fmtLimit(plan.employee_limit) },
            ].map((it) => (
              <div
                key={it.label}
                className={`rounded-lg py-2 px-1 text-xs ${featured ? "bg-white/5 border border-white/10" : "bg-muted"}`}
              >
                <div className={`font-display font-bold text-sm ${featured ? "text-white" : ""}`}>{it.value}</div>
                <div className={featured ? "text-white/50 text-[10px] uppercase tracking-wider" : "text-muted-foreground text-[10px] uppercase tracking-wider"}>{it.label}</div>
              </div>
            ))}
          </div>

          {/* Features (top 4 sempre, resto expansível) */}
          <ul className="space-y-2.5 text-sm flex-1">
            {primary.map((f: any) => (
              <motion.li
                key={f.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className="flex items-start gap-2"
              >
                <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${featured ? "bg-indigo-500/30 text-indigo-200" : "bg-primary/10 text-primary"}`}>
                  <Check className="h-3 w-3" />
                </div>
                <span className={featured ? "text-white/85" : ""}>{f.feature_name}</span>
              </motion.li>
            ))}
            <AnimatePresence initial={false}>
              {expanded && rest.map((f: any) => (
                <motion.li
                  key={f.id}
                  initial={{ opacity: 0, height: 0, x: -6 }}
                  animate={{ opacity: 1, height: "auto", x: 0 }}
                  exit={{ opacity: 0, height: 0, x: -6 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-start gap-2 overflow-hidden"
                >
                  <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${featured ? "bg-indigo-500/30 text-indigo-200" : "bg-primary/10 text-primary"}`}>
                    <Check className="h-3 w-3" />
                  </div>
                  <span className={featured ? "text-white/85" : ""}>{f.feature_name}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          {rest.length > 0 && (
            <button
              type="button"
              onClick={onToggle}
              className={`inline-flex items-center gap-1 self-start text-xs font-medium transition-colors ${featured ? "text-white/70 hover:text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              {expanded ? "Mostrar menos" : `Ver mais ${rest.length} recurso${rest.length > 1 ? "s" : ""}`}
              <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.25 }}>
                <ChevronDown className="h-3.5 w-3.5" />
              </motion.span>
            </button>
          )}

          {/* CTA */}
          <motion.div whileTap={{ scale: 0.98 }}>
            <Button
              className={`w-full h-11 relative overflow-hidden group/btn ${
                featured
                  ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400 shadow-lg shadow-indigo-500/30"
                  : ""
              }`}
              variant={featured ? "default" : isCurrent ? "outline" : "outline"}
              disabled={isCurrent || !canAct}
              onClick={onAct}
            >
              {featured && !isCurrent && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }}
                />
              )}
              <span className="relative inline-flex items-center gap-2">
                {isCurrent ? "Plano atual" : isUpgrade ? <><ArrowUp className="h-4 w-4" /> Fazer upgrade</> : isDowngrade ? <><ArrowDown className="h-4 w-4" /> Fazer downgrade</> : (plan.button_text ?? `Assinar ${plan.name}`)}
              </span>
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
