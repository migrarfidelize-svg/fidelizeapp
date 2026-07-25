import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Download, Smartphone, Apple, Monitor, Copy, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { usePWAInstall } from "@/lib/pwa-installation";

/**
 * Card unificado de instalação PWA — adapta o fluxo para Android/iOS/Windows.
 * Preserva o registro do SW atual. Não solicita permissão de push aqui.
 */
export function PWAInstallCard({ compact = false }: { compact?: boolean }) {
  const { state, canInstall, installApp, refreshState } = usePWAInstall();
  const [busy, setBusy] = useState(false);
  const [installedFlash, setInstalledFlash] = useState(false);

  if (state.isStandalone) {
    if (compact) return null;
    return (
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <div className="text-sm">
            <p className="font-medium">Aplicativo instalado</p>
            <p className="text-xs text-muted-foreground">Você está usando o Fidelize em modo aplicativo.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  async function handleInstall() {
    setBusy(true);
    try {
      const r = await installApp();
      if (r.outcome === "accepted") {
        setInstalledFlash(true);
        toast.success("Instalação autorizada.");
      } else if (r.outcome === "dismissed") {
        toast.info("Instalação cancelada. Você pode tentar novamente quando o navegador oferecer.");
      } else {
        toast.message(
          "Abra o menu do navegador e toque em 'Instalar aplicativo' ou 'Adicionar à tela inicial'.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Endereço copiado. Cole no Safari.");
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente da barra de endereços.");
    }
  }

  const isInApp = state.isInAppBrowser;

  return (
    <Card className="overflow-hidden border-primary/40 bg-gradient-to-br from-primary/10 via-background to-background">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
            {state.isIOS ? (
              <Apple className="h-5 w-5" />
            ) : state.isAndroid ? (
              <Smartphone className="h-5 w-5" />
            ) : (
              <Monitor className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-tight">Instale o aplicativo</CardTitle>
            <CardDescription className="text-xs">
              Instale para receber notificações, acessar pelo ícone e abrir em tela cheia.
            </CardDescription>
          </div>
          {installedFlash ? (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">
              Instalando
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Android + Desktop Chrome/Edge */}
        {!state.isIOS && !isInApp ? (
          <div className="space-y-2">
            {canInstall ? (
              <Button onClick={handleInstall} disabled={busy} size="lg" className="w-full gap-2">
                <Download className="h-4 w-4" />
                {state.isAndroid ? "Instalar aplicativo" : "Instalar no computador"}
              </Button>
            ) : (
              <>
                <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                  O navegador ainda não disponibilizou a instalação automática. Abra o menu
                  {" "}({state.browser === "Edge" ? "Edge" : "Chrome"}) e toque em
                  {" "}<strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                </p>
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={refreshState}>
                  <RefreshCw className="h-4 w-4" />
                  Já instalei, verificar novamente
                </Button>
              </>
            )}
          </div>
        ) : null}

        {/* iPhone / iPad */}
        {state.isIOS ? (
          <div className="space-y-2">
            {isInApp ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Abra este endereço no Safari
                </div>
                <p className="text-muted-foreground">
                  Você está em um navegador embutido. Só é possível instalar pelo Safari do iPhone/iPad.
                </p>
                <Button variant="outline" size="sm" className="mt-2 w-full gap-2" onClick={copyLink}>
                  <Copy className="h-4 w-4" /> Copiar endereço
                </Button>
              </div>
            ) : (
              <ol className="space-y-1.5 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                <li>1. Toque no botão <strong>Compartilhar</strong> do Safari.</li>
                <li>2. Escolha <strong>"Adicionar à Tela de Início"</strong>.</li>
                <li>3. Confirme em <strong>"Adicionar"</strong>.</li>
                <li>4. Abra o Fidelize pelo <strong>ícone criado</strong>.</li>
                <li>5. Volte aqui e ative as notificações.</li>
              </ol>
            )}
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={refreshState}>
              <RefreshCw className="h-4 w-4" />
              Já instalei, verificar novamente
            </Button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5"><Bell className="h-3 w-3" /> Receba notificações</div>
          <div className="flex items-center gap-1.5"><Smartphone className="h-3 w-3" /> Ícone na tela inicial</div>
          <div className="flex items-center gap-1.5"><Monitor className="h-3 w-3" /> Uso em tela cheia</div>
          <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> Abertura direta</div>
        </div>
      </CardContent>
    </Card>
  );
}
