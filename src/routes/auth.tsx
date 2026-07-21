import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Coffee, Check, ArrowRight, Sparkles } from "lucide-react";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).default("signin") });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  head: () => ({ meta: [{ title: "Entrar — Fidelize" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const isSignup = mode === "signup";

  function formatWhatsapp(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
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
        const { data: signUpData, error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { full_name: name, phone: whatsapp, whatsapp },
            emailRedirectTo: window.location.origin + "/app",
          },
        });
        if (error) throw error;
        const uid = signUpData.user?.id;
        if (uid) {
          await supabase.from("profiles").upsert({ id: uid, full_name: name, phone: whatsapp }, { onConflict: "id" });
        }
        toast.success("Conta criada! Vamos configurar seu cartão.");
        navigate({ to: "/onboarding" });
      } else {
        let { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const msg = (error.message || "").toLowerCase();
          const code = (error as { code?: string }).code ?? "";
          if (msg.includes("not confirmed") || msg.includes("email not confirmed") || code === "email_not_confirmed") {
            const { confirmEmailByAddress } = await import("@/lib/auth-confirm.functions");
            const res = await confirmEmailByAddress({ data: { email } });
            if (res.ok) {
              const retry = await supabase.auth.signInWithPassword({ email, password });
              error = retry.error;
            }
          }
          if (error) throw error;
        }
        toast.success("Bem-vindo de volta!");
        navigate({ to: "/app" });
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
          <div className="group [perspective:2000px]">
            <div className="auth-loyalty-card relative h-[300px] w-[440px] max-w-full transform-gpu shadow-[0_60px_120px_-30px_rgba(0,0,0,0.7)] transition-transform duration-700 [transform:rotateY(-14deg)_rotateX(9deg)] group-hover:[transform:rotateY(-4deg)_rotateX(3deg)]">
              {/* Card body */}
              <div className="relative h-full w-full overflow-hidden rounded-[28px] border border-white/10 bg-[oklch(0.16_0.03_235)]">
                {/* Circuit dot pattern */}
                <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #00ffff 1px, transparent 0)", backgroundSize: "22px 22px" }} />
                {/* Corner glow */}
                <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-[#00ffff]/25 blur-3xl" />
                <div className="absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-[oklch(0.78_0.19_330)]/25 blur-3xl" />

                {/* Header */}
                <div className="relative flex items-start justify-between px-7 pt-6">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.28em] text-white/40">Cartão fidelidade</div>
                    <div className="font-display text-2xl font-bold tracking-tight text-white">
                      Café <span className="text-[#00ffff]">Aurora</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#00ffff]/30 bg-[#00ffff]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#00ffff]">
                    <Sparkles className="mr-1 inline h-3 w-3" /> ouro
                  </div>
                </div>

                {/* Stamp grid */}
                <div className="relative mt-6 grid grid-cols-5 gap-3 px-7">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const filled = i < 7;
                    return (
                      <div
                        key={i}
                        className={
                          "relative flex aspect-square items-center justify-center rounded-full border " +
                          (filled
                            ? "border-[#00ffff]/60 bg-[#00ffff]/15 text-[#00ffff] shadow-[0_0_18px_rgba(0,255,255,0.35)]"
                            : "border-dashed border-white/15 text-white/20")
                        }
                      >
                        {filled ? <Coffee className="h-4 w-4" /> : <span className="text-[10px]">{i + 1}</span>}
                        {filled && i === 6 && (
                          <span className="absolute inset-0 animate-ping rounded-full bg-[#00ffff]/30" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="relative mt-5 flex items-end justify-between px-7 pb-6">
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.24em] text-white/40">Faltam</div>
                    <div className="font-display text-lg font-bold text-white">3 carimbos · <span className="text-[oklch(0.78_0.19_330)]">1 café grátis</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-[0.24em] text-white/40">Membro</div>
                    <div className="font-display text-sm font-semibold text-white">Ana R.</div>
                  </div>
                </div>

                {/* Sheen */}
                <div className="pointer-events-none absolute -inset-full rotate-45 bg-gradient-to-tr from-transparent via-white/5 to-transparent transition-transform duration-1000 group-hover:translate-x-1/2" />
              </div>
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
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl">
            {/* Sliding switch toggle */}
            <div className="relative mb-8 grid grid-cols-2 rounded-full border border-white/10 bg-black/40 p-1">
              <span
                className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-[#00ffff] shadow-[0_0_24px_rgba(0,255,255,0.45)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: isSignup ? "translateX(100%)" : "translateX(0%)" }}
              />
              <Link
                to="/auth"
                search={{ mode: "signin" }}
                className={"relative z-10 rounded-full py-2 text-center font-display text-sm font-semibold transition-colors duration-300 " + (isSignup ? "text-white/60" : "text-black")}
              >
                Entrar
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className={"relative z-10 rounded-full py-2 text-center font-display text-sm font-semibold transition-colors duration-300 " + (isSignup ? "text-black" : "text-white/60")}
              >
                Criar conta
              </Link>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignup && (
                <div className="animate-fade-in space-y-1.5">
                  <label htmlFor="name" className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#00ffff]">Seu nome</label>
                  <input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className="auth-input" />
                </div>
              )}
              {isSignup && (
                <div className="animate-fade-in space-y-1.5">
                  <label htmlFor="whatsapp" className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#00ffff]">WhatsApp</label>
                  <input id="whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 91234-5678" value={whatsapp} onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))} required className="auth-input" />
                </div>
              )}
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

              <button type="submit" disabled={loading} className="auth-cta group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00ffff] py-4 font-display text-sm font-bold uppercase tracking-widest text-black shadow-[0_0_30px_-4px_rgba(0,255,255,0.55)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60">
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

            <div className="mt-6 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/30">
              <Check className="h-3 w-3 text-[#00ffff]" /> Criptografia ativa · SSL
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
