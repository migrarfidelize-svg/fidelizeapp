import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, CheckCircle2, XCircle, Loader2, RefreshCw, TerminalSquare } from "lucide-react";
import { testTurnstileKeys } from "@/lib/captcha.functions";

const MODE_LABEL: Record<string, { label: string; className: string; hint: string }> = {
  production: {
    label: "Produção",
    className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    hint: "Usando TURNSTILE_SITE_KEY e TURNSTILE_SECRET_KEY (chaves reais da Cloudflare).",
  },
  test: {
    label: "Teste",
    className: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    hint: "Usando as chaves públicas de teste da Cloudflare — o desafio sempre passa. Não use em produção.",
  },
  off: {
    label: "Desligado",
    className: "bg-muted text-muted-foreground border-border",
    hint: "O captcha não é exibido nem validado em nenhum ambiente.",
  },
};

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive shrink-0" />
      )}
      <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}

export function CaptchaPanel() {
  const run = useServerFn(testTurnstileKeys);
  const q = useQuery({ queryKey: ["turnstile-status"], queryFn: () => run({}) });

  const data = q.data as
    | (Awaited<ReturnType<typeof testTurnstileKeys>> & {
        mode?: string;
        siteKeyMasked?: string;
        secretKeyMasked?: string;
        usingCloudflareTestKeys?: boolean;
        productionKeysSet?: boolean;
      })
    | undefined;

  const mode = data?.mode ?? "production";
  const meta = MODE_LABEL[mode] ?? MODE_LABEL.production;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Captcha de login (Cloudflare Turnstile)
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={meta.className}>
              Modo: {meta.label}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
              {q.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1">Testar</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{meta.hint}</p>

          {q.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando chaves…
            </div>
          ) : data ? (
            <>
              <div
                className={`rounded-lg border p-3 text-sm ${
                  data.ok
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                    : "border-destructive/40 bg-destructive/5 text-destructive"
                }`}
              >
                {data.message}
              </div>

              <ul className="grid gap-2 sm:grid-cols-2">
                <Check ok={!!data.checks?.siteKeySet} label={`Site key definida ${data.siteKeyMasked ? `(${data.siteKeyMasked})` : ""}`} />
                <Check ok={!!data.checks?.secretSet} label={`Secret key definida ${data.secretKeyMasked ? `(${data.secretKeyMasked})` : ""}`} />
                <Check ok={!!data.checks?.siteKeyFormat} label="Formato da site key" />
                <Check ok={!!data.checks?.secretKeyFormat} label="Formato da secret key" />
                <Check ok={!!data.productionKeysSet} label="Chaves de produção cadastradas" />
              </ul>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TerminalSquare className="h-4 w-4 text-primary" />
            Como alternar entre teste e produção
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            A troca é feita apenas pela variável de ambiente <code className="rounded bg-muted px-1">TURNSTILE_MODE</code>, sem
            alterar código nem apagar suas chaves reais:
          </p>
          <div className="space-y-2">
            {[
              ["production", "Chaves reais (TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY). Valor padrão."],
              ["test", "Chaves públicas de teste da Cloudflare — o captcha sempre aprova."],
              ["off", "Captcha totalmente desativado (login sem desafio)."],
            ].map(([value, desc]) => (
              <div key={value} className="flex flex-col gap-1 rounded-lg border bg-background/60 p-3 sm:flex-row sm:items-center sm:gap-3">
                <code className="w-fit rounded bg-muted px-2 py-0.5 text-xs font-semibold">TURNSTILE_MODE={value}</code>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground">
            Opcionalmente você pode definir <code className="rounded bg-muted px-1">TURNSTILE_TEST_SITE_KEY</code> e{" "}
            <code className="rounded bg-muted px-1">TURNSTILE_TEST_SECRET_KEY</code> para usar um site de sandbox próprio no modo
            teste. As chaves de produção continuam salvas e intactas em qualquer modo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
