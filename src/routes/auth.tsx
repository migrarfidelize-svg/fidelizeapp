import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Coffee, Check, ArrowRight, Sparkles, Wifi, Store, User } from "lucide-react";
import { claimCustomerByToken, attachEstablishmentBySlug } from "@/lib/my-wallet.functions";

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

async function completeAuthRedirect(to: string, type: "SIGNED_IN" | "SIGNED_UP") {
  notifyAuthSync(type);
  await supabase.auth.getSession();
  const url = new URL(to, window.location.origin);
  window.location.assign(url.toString());
}

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).default("signin"),
  as: z.enum(["customer", "establishment"]).optional(),
  claim: z.string().optional(),
  est_slug: z.string().optional(),
  next: z.string().optional(),
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
    if (data === "super_admin") return { to: "/admin" };
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
  head: () => ({ meta: [{ title: "Entrar — Fidelize" }] }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const { mode } = search;
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  // Sem claim/est_slug (cadastro vindo do site institucional) o padrão é "estabelecimento".
  // Fluxos de cliente final sempre chegam com `claim` ou `est_slug` (QR/scan) ou `as=customer`.
  const [role, setRole] = useState<"customer" | "establishment">(
    search.as ?? (search.claim || search.est_slug ? "customer" : "establishment"),
  );


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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        const digits = whatsapp.replace(/\D/g, "");
        if (digits.length < 10) {
          toast.error("Informe um WhatsApp válido com DDD.");
          setLoading(false);
          return;
        }
        const creds = walletFlow ? walletCredentials(digits) : { email, password };
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: creds.email,
          password: creds.password,
          options: {
            data: { full_name: name, phone: whatsapp, whatsapp },
            emailRedirectTo: window.location.origin + "/auth",
          },
        });
        if (error) {
          const msg = (error.message || "").toLowerCase();
          if (walletFlow && (msg.includes("already") || msg.includes("registered") || msg.includes("exists"))) {
            const retry = await supabase.auth.signInWithPassword(creds);
            if (retry.error) throw new Error("Este WhatsApp já tem cadastro. Toque em Entrar.");
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
          toast.success("Conta criada! Vamos configurar seu cartão.");
          await completeAuthRedirect("/onboarding", "SIGNED_UP");
        } else {
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
          if (error) {
            if (walletFlow && ((error.message || "").toLowerCase().includes("invalid"))) {
              throw new Error("WhatsApp não cadastrado. Toque em Criar conta.");
            }
            throw error;
          }
        }
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
    <div className="auth-cinema relative min-h-screen w-full overflow-hidden bg-[oklch(0.14_0.02_230)] px-6 py-10">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00ffff]/5 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-[oklch(0.78_0.19_330)]/10 blur-[100px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(#00ffff 1px, transparent 1px), linear-gradient(90deg, #00ffff 1px, transparent 1px)", backgroundSize: "100px 100px" }} />

      {/* Top bar */}
      <div className="relative z-10 mx-auto flex max-w-6xl items-center justify-between">
        <Link to="/" className="text-white"><Logo className="text-white" /></Link>
        <Link to="/" className="text-xs uppercase tracking-[0.2em] text-white/40 hover:text-[#00ffff]">← Voltar</Link>
      </div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl grid-cols-1 items-center gap-16 lg:grid-cols-2">
        {/* Protagonist: Premium loyalty stamp card */}
        <div className="flex flex-col items-center space-y-8 lg:items-start">
          <div className="auth-card-stage group [perspective:2200px]">
            {/* Floating ambient chips behind card */}
            <div className="pointer-events-none absolute -left-8 -top-6 h-24 w-24 rounded-full bg-[#00ffff]/20 blur-2xl animate-[auth-float_9s_ease-in-out_infinite]" />
            <div className="pointer-events-none absolute -bottom-10 -right-6 h-32 w-32 rounded-full bg-[oklch(0.78_0.19_330)]/25 blur-3xl animate-[auth-float_11s_ease-in-out_infinite_reverse]" />

            <div className="auth-loyalty-card relative aspect-[1.6/1] w-[min(320px,70vw)] sm:w-[min(460px,88vw)] transform-gpu transition-transform duration-700 will-change-transform [transform:rotateY(-14deg)_rotateX(9deg)] group-hover:[transform:rotateY(-4deg)_rotateX(3deg)]">
              {/* Card body */}
              <div className="auth-card-body relative h-full w-full overflow-hidden rounded-[26px] border border-white/12">
                {/* Layered background */}
                <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,oklch(0.22_0.06_235)_0%,oklch(0.14_0.03_235)_55%,oklch(0.11_0.02_240)_100%)]" />
                <div className="absolute inset-0 opacity-[0.14]" style={{ backgroundImage: "radial-gradient(circle at 1.5px 1.5px, #00ffff 1px, transparent 0)", backgroundSize: "18px 18px" }} />
                {/* Corner glows */}
                <div className="absolute -top-24 -right-20 h-56 w-56 rounded-full bg-[#00ffff]/22 blur-3xl" />
                <div className="absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-[oklch(0.78_0.19_330)]/22 blur-3xl" />

                {/* Content grid — locks alignment */}
                <div className="relative grid h-full grid-rows-[auto_1fr_auto] gap-3 p-5 sm:p-6">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Holo chip */}
                      <div className="relative h-9 w-11 shrink-0 overflow-hidden rounded-md border border-[#00ffff]/40 bg-gradient-to-br from-[#00ffff]/30 via-white/10 to-[oklch(0.78_0.19_330)]/30">
                        <div className="absolute inset-0 animate-[auth-holo_3s_linear_infinite] bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.55)_50%,transparent_65%)]" />
                        <div className="absolute inset-1 rounded-[3px] border border-white/30" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] uppercase tracking-[0.28em] text-white/45">Cartão fidelidade</div>
                        <div className="font-display text-lg font-bold leading-tight tracking-tight text-white truncate">
                          Café <span className="text-[#00ffff]">Aurora</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-[#00ffff]/35 bg-[#00ffff]/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#00ffff]">
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
                              ? "auth-stamp-filled border-[#00ffff]/55 bg-[#00ffff]/12 text-[#00ffff]"
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
                      <Wifi className="h-3 w-3 rotate-90 text-[#00ffff]/70" />
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
            <h1 className="font-display text-4xl font-bold leading-tight text-white">
              Onde a lealdade vira <span className="text-[#00ffff]">experiência.</span>
            </h1>
            <p className="mt-3 text-white/50">Cartão fidelidade digital, carimbos em tempo real e clientes que voltam sempre.</p>
          </div>
        </div>


        {/* Form panel */}
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-7">
            {/* Sliding switch toggle */}
            <div className="relative mb-5 grid grid-cols-2 rounded-full border border-white/10 bg-black/40 p-1">
              <span
                className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-[#00ffff] shadow-[0_0_24px_rgba(0,255,255,0.45)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
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

            <form onSubmit={handleSubmit} className={isSignup ? "space-y-3" : "space-y-4"}>

              {/* Toggle Cliente / Estabelecimento — disponível em signup e signin */}
              <div className="animate-fade-in">
                <div className="mb-1 ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#00ffff]">Sou</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("customer")}
                    className={
                      "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all " +
                      (role === "customer"
                        ? "border-[#00ffff] bg-[#00ffff]/10 text-white shadow-[0_0_20px_-6px_rgba(0,255,255,0.6)]"
                        : "border-white/10 bg-white/5 text-white/60 hover:text-white")
                    }
                  >
                    <User className="h-3.5 w-3.5" /> Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("establishment")}
                    className={
                      "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all " +
                      (role === "establishment"
                        ? "border-[#00ffff] bg-[#00ffff]/10 text-white shadow-[0_0_20px_-6px_rgba(0,255,255,0.6)]"
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

              {isSignup && (
                <div className="animate-fade-in space-y-1.5">
                  <label htmlFor="name" className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#00ffff]">Seu nome</label>
                  <input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className="auth-input" />
                </div>
              )}

              {/* WhatsApp: obrigatório para cliente (sempre) e para estabelecimento no signup */}
              {(walletFlow || isEstablishmentSignup) && (
                <div className="animate-fade-in space-y-1.5">
                  <label htmlFor="whatsapp" className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#00ffff]">WhatsApp</label>
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
                    <label htmlFor="email" className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#00ffff]">E-mail</label>
                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="voce@empresa.com" className="auth-input" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="password" className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#00ffff]">Senha</label>
                      {!isSignup && (
                        <Link to="/auth/recuperar" className="text-[10px] uppercase tracking-widest text-[oklch(0.78_0.19_330)] hover:underline">Esqueci</Link>
                      )}
                    </div>
                    <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={isSignup ? "new-password" : "current-password"} placeholder="••••••••" className="auth-input" />
                  </div>
                </>
              )}

              <button type="submit" disabled={loading} className="auth-cta group mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00ffff] py-3 font-display text-sm font-bold uppercase tracking-widest text-black shadow-[0_0_30px_-4px_rgba(0,255,255,0.55)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60">
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

            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/30">
              <Check className="h-3 w-3 text-[#00ffff]" /> Criptografia ativa · SSL
            </div>

            <p className="mt-3 text-center text-[10px] leading-relaxed text-white/40">
              Ao continuar você concorda com os{" "}
              <a href="/termos" target="_blank" rel="noopener noreferrer" className="underline decoration-[#00ffff]/40 underline-offset-2 hover:text-white/70">
                Termos de uso
              </a>{" "}
              e a{" "}
              <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="underline decoration-[#00ffff]/40 underline-offset-2 hover:text-white/70">
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
