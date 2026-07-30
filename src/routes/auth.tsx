import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getWalletHint, setWalletHint, formatWalletHint, isStandaloneLaunch } from "@/lib/wallet-hint";
import { getKeepSignedIn, setKeepSignedIn } from "@/lib/session-keeper";

import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Coffee, Check, ArrowRight, Sparkles, Wifi, Store, User, Loader2, Eye, EyeOff, Building2 } from "lucide-react";

export const ONBOARDING_PREFILL_KEY = "fidelize:onboarding-prefill";
import { claimCustomerByToken, attachEstablishmentBySlug } from "@/lib/my-wallet.functions";
import { DISCOVER_CATEGORIES } from "@/lib/discover-categories";
import { getCaptchaConfig, verifyCaptcha } from "@/lib/captcha.functions";
import { Turnstile, resetTurnstile } from "@/components/Turnstile";
import { useIsMobile } from "@/hooks/use-mobile";

const AUTH_SYNC_CHANNEL = "fidelize-auth-sync";

function notifyAuthSync(type: "SIGNED_IN" | "SIGNED_UP") {
  try {
    localStorage.setItem("fidelize:last-auth-sync", JSON.stringify({ type, at: Date.now(), host: window.location.host }));
  } catch {}
  try {
    const bc = new BroadcastChannel(AUTH_SYNC_CHANNEL);
    bc.postMessage({ type: "SIGNED_IN", source: "auth-route", at: Date.now() });
    bc.close();
  } catch {}
}


const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).default("signin"),
  as: z.enum(["customer", "establishment"]).optional(),
  claim: z.string().optional(),
  est_slug: z.string().optional(),
  next: z.string().optional(),
  source: z.string().optional(),
});

async function routeAfterAuth(opts: { claim?: string; est_slug?: string; next?: string }): Promise<{ to: string; toast?: string; toastKind?: "success" | "error" | "info" }> {
  // Vindo de um QR de estabelecimento (usuário já tinha conta ou acabou de criar).
  if (opts.est_slug) {
    try {
      const r = await attachEstablishmentBySlug({ data: { slug: opts.est_slug } });
      const msg = r.status === "created"
        ? `Bem-vindo à ${r.name}! Um novo cartão foi criado na sua carteira.`
        : r.status === "adopted"
        ? `Encontramos um cadastro antigo em ${r.name} com o seu WhatsApp — vinculamos à sua conta e mantivemos seu histórico.`
        : `Você já tinha cartão em ${r.name}. Nada mudou no seu cadastro anterior.`;
      return { to: `/carteira/${r.slug}`, toast: msg, toastKind: "success" };
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const name = (err as { establishmentName?: string })?.establishmentName;
      const slug = (err as { slug?: string })?.slug ?? opts.est_slug;
      if (code === "inactive") {
        return {
          to: "/carteira",
          toast: `${name ?? slug} está inativo/suspenso. Não vinculamos o cartão à sua carteira.`,
          toastKind: "error" as const,
        };
      }
      if (code === "not_found") {
        return {
          to: "/carteira",
          toast: `Estabelecimento "${slug}" não encontrado. Verifique o QR ou peça um novo link.`,
          toastKind: "error" as const,
        };
      }
      // Segue fluxo padrão.
    }
  }
  // Se veio de um link com token específico, tenta vincular esse cartão.
  if (opts.claim) {
    try {
      const r = await claimCustomerByToken({ data: { token: opts.claim } });
      return { to: `/carteira/${r.slug}`, toast: "Cartão salvo na sua carteira!", toastKind: "success" };
    } catch {
      // Fall through to default routing.
    }
  }
  if (opts.next && opts.next.startsWith("/")) return { to: opts.next };
  try {
    const { data } = await supabase.rpc("my_account_type");
    if (data === "super_admin") return { to: "/hash" };
    if (data === "establishment") return { to: "/app" };
    return { to: "/carteira" };
  } catch {
    return { to: "/carteira" };
  }
}

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  ssr: false,
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const dest = await routeAfterAuth({ claim: search.claim, est_slug: search.est_slug, next: search.next });
      throw redirect({ to: dest.to });
    }
  },
  head: () => ({ meta: [{ title: "Entrar — Fidelize" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const { mode } = search;
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState(() => formatWalletHint(getWalletHint()));
  const [company, setCompany] = useState("");
  const walletHintApplied = useRef<boolean>(Boolean(getWalletHint()));

  const [segment, setSegment] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [keepSignedIn, setKeepSignedInState] = useState<boolean>(() => getKeepSignedIn());
  useEffect(() => { setKeepSignedIn(keepSignedIn); }, [keepSignedIn]);
  const pwScore = (() => {
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[a-zA-Z]/.test(password) && /\d/.test(password)) s++;
    return Math.min(s, 3);
  })();
  // Sem claim/est_slug (cadastro vindo do site institucional) o padrão é "estabelecimento".
  // Fluxos de cliente final sempre chegam com `claim` ou `est_slug` (QR/scan) ou `as=customer`.
  // Se abriu como PWA instalado (source=pwa), assume "cliente".
  const [role, setRole] = useState<"customer" | "establishment">(
    search.as ?? (search.claim || search.est_slug || search.source === "pwa" ? "customer" : "establishment"),
  );

  async function completeAuthRedirect(to: string, type: "SIGNED_IN" | "SIGNED_UP") {
    notifyAuthSync(type);
    // Garante que a sessão está hidratada antes do guard do /_authenticated rodar.
    await supabase.auth.getSession();
    setRedirecting(true);
    // Invalida caches de rota (loaders/beforeLoad) para o próximo destino recomputar auth.
    try { await router.invalidate(); } catch {}
    // SPA navigation — sem reload de página inteira, evita o flash de telas anteriores.
    await router.navigate({ to, replace: true });
  }



  const isSignup = mode === "signup";
  const isCustomer = role === "customer";
  const isEstablishmentSignup = isSignup && role === "establishment";
  // Cliente (carteira) usa apenas WhatsApp — cadastro exige nome + WhatsApp, login exige só WhatsApp.
  const walletFlow = isCustomer;

  function formatWhatsapp(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  /**
   * Credenciais sintéticas para clientes que usam apenas o WhatsApp.
   * O número (com DDD) atua como identificador único e como PIN — trade-off
   * consciente pedido pelo usuário: "só o WhatsApp para acessar".
   */
  function walletCredentials(digits: string) {
    return {
      email: `wa${digits}@carteira.fidelize.app`,
      password: `wa_${digits}_fidelize_v1`,
    };
  }

  /**
   * Captcha (Cloudflare Turnstile) — exibido apenas no desktop.
   * No mobile o fluxo segue liberado, conforme decisão de produto.
   */
  const isMobile = useIsMobile();
  const [captcha, setCaptcha] = useState<{ enabled: boolean; siteKey: string } | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  useEffect(() => {
    if (isMobile) return;
    let alive = true;
    getCaptchaConfig()
      .then((c) => { if (alive) setCaptcha(c); })
      .catch(() => { if (alive) setCaptcha({ enabled: false, siteKey: "" }); });
    return () => { alive = false; };
  }, [isMobile]);
  const captchaRequired = !isMobile && !!captcha?.enabled;

  /**
   * Anti-bot simples: campo honeypot invisível + tempo mínimo de preenchimento.
   * Automações genéricas preenchem todos os campos e enviam em milissegundos.
   */
  const [honeypot, setHoneypot] = useState("");
  const formOpenedAt = useRef(Date.now());
  useEffect(() => { formOpenedAt.current = Date.now(); }, [mode, role]);

  /** Identificador usado no rate limit (e-mail ou WhatsApp). */
  function currentIdentifier() {
    return walletFlow ? whatsapp.replace(/\D/g, "") : email.trim().toLowerCase();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const action = isSignup ? ("signup" as const) : ("login" as const);
    const identifier = currentIdentifier();

    // Honeypot + tempo mínimo + rate limit por IP/identificador (validados no servidor).
    const guard = await guardAuthAttempt({
      data: {
        identifier,
        action,
        honeypot,
        elapsedMs: Date.now() - formOpenedAt.current,
      },
    }).catch(() => null);
    if (guard && !guard.ok) {
      toast.error(guard.message);
      return;
    }

    if (captchaRequired) {
      if (!captchaToken) {
        toast.error("Confirme o desafio de segurança para continuar.");
        return;
      }
      const check = await verifyCaptcha({ data: { token: captchaToken } }).catch(() => null);
      if (!check?.ok) {
        toast.error("Não foi possível validar o desafio de segurança. Tente novamente.");
        setCaptchaToken(null);
        resetTurnstile();
        return;
      }
      // Tokens do Turnstile são de uso único.
      setCaptchaToken(null);
      resetTurnstile();
    }
    setLoading(true);
    const markAttempt = (success: boolean) =>
      void reportAuthAttempt({ data: { identifier, action, success } }).catch(() => null);
    try {

      if (isSignup) {
        const digits = whatsapp.replace(/\D/g, "");
        if (digits.length < 10) {
          toast.error("Informe um WhatsApp válido com DDD.");
          setLoading(false);
          return;
        }
        if (isEstablishmentSignup && company.trim().length < 2) {
          toast.error("Informe o nome do seu negócio.");
          setLoading(false);
          return;
        }
        if (isEstablishmentSignup && !segment) {
          toast.error("Selecione a categoria do seu negócio.");
          setLoading(false);
          return;
        }
        const creds = walletFlow ? walletCredentials(digits) : { email, password };
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: creds.email,
          password: creds.password,
          options: {
            data: { full_name: name, phone: whatsapp, whatsapp, company_name: company.trim() || undefined },
            emailRedirectTo: window.location.origin + "/auth",
          },
        });
        if (error) {
          const msg = (error.message || "").toLowerCase();
          if (walletFlow && (msg.includes("already") || msg.includes("registered") || msg.includes("exists"))) {
            const retry = await supabase.auth.signInWithPassword(creds);
            if (retry.error) throw new Error("Este WhatsApp já tem cadastro. Toque em Entrar.");
          } else if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
            throw new Error("Já existe uma conta com este e-mail. Use “Entrar” ou recupere sua senha.");
          } else {
            throw error;
          }
        }

        const uid = signUpData.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
        if (uid) {
          await supabase.from("profiles").upsert(
            { id: uid, full_name: name, phone: whatsapp, account_type: isEstablishmentSignup ? "establishment" : "customer" },
            { onConflict: "id" },
          );
        }
        if (isEstablishmentSignup) {
          try {
            localStorage.setItem(
              ONBOARDING_PREFILL_KEY,
              JSON.stringify({ name: company.trim(), segment, at: Date.now() }),
            );
          } catch { /* ignore */ }
          toast.success("Conta criada! Vamos configurar seu cartão.");
          await completeAuthRedirect("/onboarding", "SIGNED_UP");
        } else {
          if (walletFlow) setWalletHint(whatsapp);
          const dest = await routeAfterAuth({ claim: search.claim, est_slug: search.est_slug, next: search.next });
          if (dest.toastKind === "error") toast.error(dest.toast ?? "Não foi possível vincular seu cartão.");
          else toast.success(dest.toast ?? "Conta criada!");
          await completeAuthRedirect(dest.to, "SIGNED_UP");
        }

      } else {
        let creds: { email: string; password: string };
        if (walletFlow) {
          const digits = whatsapp.replace(/\D/g, "");
          if (digits.length < 10) {
            toast.error("Informe seu WhatsApp com DDD.");
            setLoading(false);
            return;
          }
          creds = walletCredentials(digits);
        } else {
          creds = { email, password };
        }
        let { error } = await supabase.auth.signInWithPassword(creds);
        if (error) {
          const msg = (error.message || "").toLowerCase();
          const code = (error as { code?: string }).code ?? "";
          if (msg.includes("not confirmed") || msg.includes("email not confirmed") || code === "email_not_confirmed") {
            const { confirmEmailByAddress } = await import("@/lib/auth-confirm.functions");
            const res = await confirmEmailByAddress({ data: { email: creds.email } });
            if (res.ok) {
              const retry = await supabase.auth.signInWithPassword(creds);
              error = retry.error;
            }
          }
          // Fluxo carteira: tenta localizar a conta pelo WhatsApp mesmo que o
          // usuário tenha se cadastrado com e-mail real (via QR/site) e
          // reencaixar a senha sintética para permitir login por WhatsApp.
          if (error && walletFlow && ((error.message || "").toLowerCase().includes("invalid"))) {
            try {
              const { resolveWalletLoginByWhatsapp } = await import("@/lib/my-wallet.functions");
              const digits2 = whatsapp.replace(/\D/g, "");
              const r = await resolveWalletLoginByWhatsapp({ data: { whatsapp: digits2 } });
              if (r.found) {
                const retry = await supabase.auth.signInWithPassword({ email: r.email, password: r.password });
                error = retry.error;
              }
            } catch {
              // segue para o fluxo de "não cadastrado"
            }
          }
          if (error) {
            if (walletFlow && ((error.message || "").toLowerCase().includes("invalid"))) {
              // Cliente ainda não tem conta — leva direto ao cadastro mantendo o WhatsApp.
              toast.info("Não encontramos seu WhatsApp. Complete seu nome para criar sua conta.");
              await router.navigate({ to: "/auth", search: { ...search, mode: "signup" }, replace: true });
              return;
            }

            throw error;
          }
        }

        if (walletFlow) setWalletHint(whatsapp);
        const dest = await routeAfterAuth({ claim: search.claim, est_slug: search.est_slug, next: search.next });
        if (dest.toastKind === "error") toast.error(dest.toast ?? "Não foi possível vincular seu cartão.");
        else toast.success(dest.toast ?? "Bem-vindo de volta!");
        await completeAuthRedirect(dest.to, "SIGNED_IN");

      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-cinema relative min-h-screen w-full overflow-hidden bg-[oklch(0.14_0.02_230)] px-6 py-4">
      {/* Overlay de transição — cobre a tela durante o redirect pós-login para eliminar qualquer flash de telas anteriores. */}
      {redirecting && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-[oklch(0.14_0.02_230)] animate-in fade-in duration-150">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#a78bfa]/8 blur-[120px]" />
          <Loader2 className="h-10 w-10 animate-spin text-[#a78bfa]" />
          <div className="text-xs uppercase tracking-[0.3em] text-white/60">Carregando seu painel…</div>
        </div>
      )}
      {/* Ambient glows */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#a78bfa]/5 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-[oklch(0.78_0.19_330)]/10 blur-[100px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(#a78bfa 1px, transparent 1px), linear-gradient(90deg, #a78bfa 1px, transparent 1px)", backgroundSize: "100px 100px" }} />


      {/* Top bar */}
      <div className="relative z-10 mx-auto flex max-w-6xl items-center justify-between">
        <Link to="/" className="text-white"><Logo className="text-white" /></Link>
        <Link to="/" className="text-xs uppercase tracking-[0.2em] text-white/40 hover:text-[#a78bfa]">← Voltar</Link>
      </div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl grid-cols-1 items-center gap-8 lg:gap-12 lg:grid-cols-2">
        {/* Protagonist: Premium loyalty stamp card */}
        <div className="hidden flex-col items-center space-y-6 lg:flex lg:items-start">

          <div className="auth-card-stage group [perspective:2200px]">
            {/* Floating ambient chips behind card */}
            <div className="pointer-events-none absolute -left-8 -top-6 h-24 w-24 rounded-full bg-[#a78bfa]/20 blur-2xl animate-[auth-float_9s_ease-in-out_infinite]" />
            <div className="pointer-events-none absolute -bottom-10 -right-6 h-32 w-32 rounded-full bg-[oklch(0.78_0.19_330)]/25 blur-3xl animate-[auth-float_11s_ease-in-out_infinite_reverse]" />

            <div className="auth-loyalty-card relative aspect-[1.6/1] w-[min(320px,70vw)] sm:w-[min(460px,88vw)] transform-gpu transition-transform duration-700 will-change-transform [transform:rotateY(-14deg)_rotateX(9deg)] group-hover:[transform:rotateY(-4deg)_rotateX(3deg)]">
              {/* Card body */}
              <div className="auth-card-body relative h-full w-full overflow-hidden rounded-[26px] border border-white/12">
                {/* Layered background */}
                <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,oklch(0.22_0.06_235)_0%,oklch(0.14_0.03_235)_55%,oklch(0.11_0.02_240)_100%)]" />
                <div className="absolute inset-0 opacity-[0.14]" style={{ backgroundImage: "radial-gradient(circle at 1.5px 1.5px, #a78bfa 1px, transparent 0)", backgroundSize: "18px 18px" }} />
                {/* Corner glows */}
                <div className="absolute -top-24 -right-20 h-56 w-56 rounded-full bg-[#a78bfa]/22 blur-3xl" />
                <div className="absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-[oklch(0.78_0.19_330)]/22 blur-3xl" />

                {/* Content grid — locks alignment */}
                <div className="relative grid h-full grid-rows-[auto_1fr_auto] gap-3 p-5 sm:p-6">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Holo chip */}
                      <div className="relative h-9 w-11 shrink-0 overflow-hidden rounded-md border border-[#a78bfa]/40 bg-gradient-to-br from-[#a78bfa]/30 via-white/10 to-[oklch(0.78_0.19_330)]/30">
                        <div className="absolute inset-0 animate-[auth-holo_3s_linear_infinite] bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.55)_50%,transparent_65%)]" />
                        <div className="absolute inset-1 rounded-[3px] border border-white/30" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] uppercase tracking-[0.28em] text-white/45">Cartão fidelidade</div>
                        <div className="font-display text-lg font-bold leading-tight tracking-tight text-white truncate">
                          Café <span className="text-[#a78bfa]">Aurora</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-[#a78bfa]/35 bg-[#a78bfa]/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#a78bfa]">
                      <Sparkles className="h-3 w-3" /> Ouro
                    </div>
                  </div>

                  {/* Stamp grid — perfectly aligned */}
                  <div className="grid grid-cols-5 grid-rows-2 gap-2 sm:gap-2.5">
                    {Array.from({ length: 10 }).map((_, i) => {
                      const filled = i < 7;
                      const isNext = i === 7;
                      return (
                        <div
                          key={i}
                          style={{ animationDelay: `${i * 110}ms` }}
                          className={
                            "auth-stamp relative flex aspect-square items-center justify-center rounded-full border text-[10px] " +
                            (filled
                              ? "auth-stamp-filled border-[#a78bfa]/55 bg-[#a78bfa]/12 text-[#a78bfa]"
                              : isNext
                              ? "border-[oklch(0.78_0.19_330)]/50 border-dashed text-[oklch(0.78_0.19_330)]"
                              : "border-dashed border-white/12 text-white/25")
                          }
                        >
                          {filled ? (
                            <Coffee className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          ) : (
                            <span className="font-display font-bold">{i + 1}</span>
                          )}
                          {isNext && (
                            <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-[oklch(0.78_0.19_330)]/25" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer row */}
                  <div className="flex items-end justify-between gap-2 border-t border-white/8 pt-2">
                    <div className="min-w-0">
                      <div className="text-[8px] uppercase tracking-[0.2em] text-white/40">Faltam</div>
                      <div className="font-display text-[11px] font-bold leading-tight text-white truncate">
                        3 carimbos · <span className="text-[oklch(0.85_0.19_330)]">café grátis</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Wifi className="h-3 w-3 rotate-90 text-[#a78bfa]/70" />
                      <div className="text-right">
                        <div className="text-[8px] uppercase tracking-[0.2em] text-white/40">Membro</div>
                        <div className="font-display text-[11px] font-semibold text-white">Ana R.</div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Cinematic sheen sweep — infinite */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[26px]">
                  <div className="absolute -inset-y-8 -left-1/3 w-1/3 rotate-[18deg] bg-gradient-to-r from-transparent via-white/12 to-transparent animate-[auth-sheen_4.5s_ease-in-out_infinite]" />
                </div>
                {/* Top hairline highlight */}
                <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              </div>
              {/* Ground shadow */}
              <div className="pointer-events-none absolute -bottom-8 left-1/2 h-8 w-4/5 -translate-x-1/2 rounded-[50%] bg-black/60 blur-2xl" />
            </div>
          </div>

          <div className="max-w-md text-center lg:text-left">
            <h1 className="font-display text-3xl font-bold leading-tight text-white">
              Onde a lealdade vira <span className="text-[#a78bfa]">experiência.</span>
            </h1>
            <p className="mt-2 text-sm text-white/50">Cartão fidelidade digital, carimbos em tempo real e clientes que voltam sempre.</p>
          </div>
        </div>


        {/* Form panel */}
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl sm:p-6">

            {/* Sliding switch toggle */}
            <div className="relative mb-4 grid grid-cols-2 rounded-full border border-white/10 bg-black/40 p-1">
              <span
                className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-[#a78bfa] shadow-[0_0_24px_rgba(167,139,250,0.45)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: isSignup ? "translateX(100%)" : "translateX(0%)" }}
              />
              <Link
                to="/auth"
                search={{ ...search, mode: "signin" }}
                className={"relative z-10 rounded-full py-1.5 text-center font-display text-sm font-semibold transition-colors duration-300 " + (isSignup ? "text-white/60" : "text-black")}
              >
                Entrar
              </Link>
              <Link
                to="/auth"
                search={{ ...search, mode: "signup" }}
                className={"relative z-10 rounded-full py-1.5 text-center font-display text-sm font-semibold transition-colors duration-300 " + (isSignup ? "text-black" : "text-white/60")}
              >
                Criar conta
              </Link>
            </div>

            <form onSubmit={handleSubmit} className={isSignup ? "space-y-2" : "space-y-3.5"}>

              {/* Honeypot invisível: bots preenchem, humanos nunca veem. */}
              <div aria-hidden className="pointer-events-none absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
                <label htmlFor="company-website">Não preencha este campo</label>
                <input
                  id="company-website"
                  name="company_website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>


              {/* Toggle Cliente / Estabelecimento — oculto quando o fluxo veio da carteira */}
              {search.source !== "wallet" && (
                <div className="animate-fade-in">
                  <div className="mb-1 ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a78bfa]">Sou</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole("customer")}
                      className={
                        "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all " +
                        (role === "customer"
                          ? "border-[#a78bfa] bg-[#a78bfa]/10 text-white shadow-[0_0_20px_-6px_rgba(167,139,250,0.6)]"
                          : "border-white/10 bg-white/5 text-white/60 hover:text-white")
                      }
                    >
                      <User className="h-3.5 w-3.5" /> Cliente
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole("establishment")}
                      className={
                        "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all " +
                        (role === "establishment"
                          ? "border-[#a78bfa] bg-[#a78bfa]/10 text-white shadow-[0_0_20px_-6px_rgba(167,139,250,0.6)]"
                          : "border-white/10 bg-white/5 text-white/60 hover:text-white")
                      }
                    >
                      <Store className="h-3.5 w-3.5" /> Estabelecimento
                    </button>
                  </div>
                  {isSignup && (
                    <p className="mt-1.5 ml-1 text-[10px] text-white/40">
                      {role === "customer"
                        ? "Acumule carimbos e recompensas em qualquer estabelecimento Fidelize."
                        : "Crie seu programa de fidelidade digital para o seu negócio."}
                    </p>
                  )}
                </div>
              )}
              {search.source === "wallet" && (
                <div className="animate-fade-in rounded-xl border border-[#a78bfa]/25 bg-[#a78bfa]/5 px-3 py-2.5 text-[11px] text-white/70 flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-[#a78bfa]" />
                  Acesso à carteira do cliente. Use seu WhatsApp para entrar.
                </div>
              )}


              {isSignup && (
                <div className="animate-fade-in space-y-1">
                  <label htmlFor="name" className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a78bfa]">Seu nome</label>
                  <input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className="auth-input" />
                </div>
              )}

              {isEstablishmentSignup && (
                <div className="animate-fade-in space-y-1">
                  <label htmlFor="company" className="ml-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a78bfa]">
                    <Building2 className="h-3 w-3" /> Nome do negócio
                  </label>
                  <input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value.slice(0, 60))}
                    required
                    minLength={2}
                    placeholder="Ex: Café Aurora"
                    className="auth-input"
                  />
                  
                </div>
              )}

              {isEstablishmentSignup && (
                <div className="animate-fade-in space-y-1">
                  <label htmlFor="segment" className="ml-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a78bfa]">
                    <Store className="h-3 w-3" /> Categoria do negócio
                  </label>
                  <select
                    id="segment"
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                    required
                    className="auth-input appearance-none"
                  >
                    <option value="" disabled>Selecione a categoria</option>
                    {DISCOVER_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#12101c] text-white">
                        {c.emoji} {c.label}
                      </option>
                    ))}
                  </select>
                  
                </div>
              )}



              {/* WhatsApp: obrigatório para cliente (sempre) e para estabelecimento no signup */}
              {(walletFlow || isEstablishmentSignup) && (
                <div className="animate-fade-in space-y-1">
                  <label htmlFor="whatsapp" className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a78bfa]">WhatsApp</label>
                  <input id="whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 91234-5678" value={whatsapp} onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))} required className="auth-input" />
                  {walletFlow && (
                    <p className="ml-1 text-[10px] text-white/40">
                      {isSignup ? "Usaremos seu WhatsApp para você acessar sua carteira." : "Digite o mesmo WhatsApp usado no cadastro."}
                    </p>
                  )}
                </div>
              )}

              {/* Email + senha somente para estabelecimento/admin */}
              {!walletFlow && (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a78bfa]">E-mail</label>
                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="voce@empresa.com" className="auth-input" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="password" className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a78bfa]">Senha</label>
                      {!isSignup && (
                        <Link to="/auth/recuperar" className="text-[10px] uppercase tracking-widest text-[oklch(0.78_0.19_330)] hover:underline">Esqueci</Link>
                      )}
                    </div>
                    <div className="relative">
                      <input id="password" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={15} autoComplete={isSignup ? "new-password" : "current-password"} placeholder="••••••" className="auth-input pr-10" aria-describedby={isSignup ? "password-hint" : undefined} />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white/80"
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {isSignup && (
                      <>
                        <div className="ml-1 flex items-center gap-1.5" aria-hidden>
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className={
                                "h-1 flex-1 rounded-full transition-colors " +
                                (pwScore > i
                                  ? pwScore === 1
                                    ? "bg-amber-400/70"
                                    : pwScore === 2
                                    ? "bg-[#a78bfa]"
                                    : "bg-emerald-400"
                                  : "bg-white/10")
                              }
                            />
                          ))}
                        </div>
                        <p id="password-hint" className="ml-1 text-[10px] text-white/50">
                          De 6 a 15 caracteres. {pwScore < 2 ? "Misture letras e números para deixar mais forte." : "Boa senha!"}
                        </p>
                      </>
                    )}

                  </div>
                  {!isSignup && (
                    <label className="ml-1 flex cursor-pointer select-none items-center gap-2 text-[11px] text-white/70 transition-colors hover:text-white/90">
                      <input
                        type="checkbox"
                        checked={keepSignedIn}
                        onChange={(e) => setKeepSignedInState(e.target.checked)}
                        className="h-3.5 w-3.5 accent-[#a78bfa]"
                      />
                      <span>Manter-me conectado neste dispositivo</span>
                    </label>
                  )}
                </>
              )}

              {captchaRequired && (
                <div className="mt-1">
                  <Turnstile siteKey={captcha!.siteKey} onToken={setCaptchaToken} theme="dark" />
                </div>
              )}


              <button type="submit" disabled={loading} className="auth-cta group mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#a78bfa] py-2.5 font-display text-sm font-bold uppercase tracking-widest text-black shadow-[0_0_30px_-4px_rgba(167,139,250,0.55)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60">
                {loading ? (
                  "Aguarde…"
                ) : (
                  <>
                    {isSignup ? "Criar minha conta" : "Acessar painel"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/30">
              <Check className="h-3 w-3 text-[#a78bfa]" /> Criptografia ativa · SSL
            </div>

            <p className="mt-2 text-center text-[10px] leading-relaxed text-white/40">
              Ao continuar você concorda com os{" "}
              <a href="/termos" target="_blank" rel="noopener noreferrer" className="underline decoration-[#a78bfa]/40 underline-offset-2 hover:text-white/70">
                Termos de uso
              </a>{" "}
              e a{" "}
              <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="underline decoration-[#a78bfa]/40 underline-offset-2 hover:text-white/70">
                Política de privacidade
              </a>
              .
            </p>


          </div>
        </div>
      </div>
    </div>
  );
}
