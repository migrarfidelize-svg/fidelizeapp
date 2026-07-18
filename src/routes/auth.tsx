import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

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
        // Best-effort persist on profile
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
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-10 gradient-brand text-primary-foreground">
        <Link to="/"><Logo className="text-primary-foreground" /></Link>
        <div>
          <h1 className="font-display text-4xl font-bold leading-tight">Transforme visitantes em clientes fiéis.</h1>
          <p className="mt-4 opacity-80">Cartão fidelidade digital, QR Code e painel de análise no mesmo lugar.</p>
        </div>
        <div className="text-xs opacity-60">© {new Date().getFullYear()} Fidelize</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-8"><Link to="/"><Logo /></Link></div>
          <h2 className="font-display text-2xl font-bold">{isSignup ? "Crie sua conta" : "Entre na sua conta"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{isSignup ? "Comece grátis. Sem cartão de crédito." : "Bem-vindo de volta ao Fidelize."}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {isSignup && (
              <div>
                <Label htmlFor="name">Seu nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
              </div>
            )}
            {isSignup && (
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(11) 91234-5678"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">Usaremos para avisos importantes e suporte.</p>
              </div>
            )}
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                {!isSignup && <Link to="/auth/recuperar" className="text-xs text-primary hover:underline">Esqueci minha senha</Link>}
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={isSignup ? "new-password" : "current-password"} />
            </div>
            <Button type="submit" disabled={loading} className="w-full gradient-brand text-primary-foreground">
              {loading ? "Aguarde…" : isSignup ? "Criar conta" : "Entrar"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isSignup ? (
              <>Já tem conta? <Link to="/auth" search={{ mode: "signin" }} className="font-medium text-primary hover:underline">Entrar</Link></>
            ) : (
              <>Novo por aqui? <Link to="/auth" search={{ mode: "signup" }} className="font-medium text-primary hover:underline">Criar conta grátis</Link></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
