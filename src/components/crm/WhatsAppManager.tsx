import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getWhatsAppInstanceStatus, 
  disconnectWhatsAppInstance,
  getCRMWhatsAppWebhookUrl,
} from "@/lib/atendimento.functions";
import { 
  Smartphone, 
  RefreshCcw, 
  Unlink, 
  ShieldCheck, 
  ShieldAlert, 
  Loader2,
  AlertCircle,
  ExternalLink,
  Webhook,
  Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export function WhatsAppManager({ establishmentId }: { establishmentId: string }) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: status, isLoading: isLoadingStatus, error: statusError } = useQuery({
    queryKey: ["whatsapp-status", establishmentId],
    queryFn: () => getWhatsAppInstanceStatus({ data: { establishmentId } }),
    refetchInterval: (query) => {
      const data = query.state.data as any;
      return (data?.status === "QRCODE" || data?.status === "DISCONNECTED") ? 10000 : 30000;
    },
  });
  const webhookUrl = useQuery({
    queryKey: ["whatsapp-webhook-url", establishmentId],
    queryFn: () => getCRMWhatsAppWebhookUrl({ data: { establishmentId } }),
    enabled: !!establishmentId,
    staleTime: Infinity,
  });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectWhatsAppInstance({ data: { establishmentId } }),
    onSuccess: () => {
      toast.success("Instância desconectada com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao desconectar: ${err.message}`);
    }
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const isConnected = status?.status === "CONNECTED";
  const hasQR = status?.status === "QRCODE" && status.qrcode;
  const isError = status?.status === "ERROR" || !!statusError;

  return (
    <div className="bg-background min-h-full p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground uppercase">WhatsApp Business</h2>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
            Gerencie a conexão CRM exclusiva do estabelecimento selecionado.
          </p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="crm-button-secondary h-9"
            onClick={handleRefresh} 
            disabled={isLoadingStatus || isRefreshing}
          >
            {isLoadingStatus || isRefreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCcw className="w-4 h-4 mr-2" />
            )}
            Atualizar Status
          </Button>
        </div>

        {!status?.provider && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Nenhum Provedor Ativo</AlertTitle>
            <AlertDescription>
              Não há nenhum provedor de WhatsApp configurado em Sistema &gt; Integrações. 
              Vá até lá para configurar o Evolution, Z-API ou UAZAPI antes de conectar.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <Card className="md:col-span-3 crm-card border-none shadow-none bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                Status da Conexão
              </CardTitle>
              <CardDescription>
                Provedor Atual: <span className="font-semibold text-foreground">{status?.provider?.name || "Nenhum"}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-6 rounded-2xl border bg-muted/20 border-border/40">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center shadow-sm",
                    isConnected ? "bg-emerald-500/10 text-emerald-600" : 
                    hasQR ? "bg-amber-500/10 text-amber-600" :
                    "bg-slate-500/10 text-slate-600"
                  )}>
                    {isConnected ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">
                        {isConnected ? "Instância Conectada" : hasQR ? "Aguardando Pareamento" : isError ? "Falha na Conexão" : "Instância Desconectada"}
                      </span>
                      <Badge variant={isConnected ? "secondary" : hasQR ? "outline" : "secondary"}>
                        {status?.status || "OFFLINE"}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground mt-0.5">
                      Última verificação: {status?.updatedAt ? new Date(status.updatedAt).toLocaleTimeString() : "Nunca"}
                    </p>
                  </div>
                </div>

                {isConnected && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if(confirm("Tem certeza que deseja desconectar esta instância do WhatsApp?")) {
                        disconnectMutation.mutate();
                      }
                    }}
                    disabled={disconnectMutation.isPending}
                  >
                    <Unlink className="w-4 h-4 mr-2" />
                    Desconectar
                  </Button>
                )}
              </div>

              {hasQR && (
                <div className="flex flex-col items-center justify-center py-6 bg-white rounded-xl border space-y-4">
                  <div className="p-4 bg-white rounded-lg shadow-inner border-2 border-primary/20">
                    <QRCodeSVG value={status.qrcode!} size={240} level="H" includeMargin />
                  </div>
                  <div className="text-center max-w-xs">
                    <p className="text-sm font-medium">Escaneie o QR Code no seu WhatsApp</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Abra o WhatsApp &gt; Aparelhos Conectados &gt; Conectar um aparelho.
                    </p>
                  </div>
                </div>
              )}

              {isError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro de Comunicação</AlertTitle>
                  <AlertDescription>
                    Não foi possível obter o status da instância. Verifique se as credenciais no menu Integrações estão corretas e se o servidor do provedor está online.
                  </AlertDescription>
                </Alert>
              )}

              {!isConnected && !hasQR && !isError && status?.provider && (
                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl bg-muted/5 border-border/40">
                  <Smartphone className="w-12 h-12 mb-4 text-muted-foreground opacity-20" />
                  <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Instância Pronta</p>
                  <Button 
                    className="mt-6 crm-button-primary"
                    onClick={handleRefresh}
                  >
                    Conectar WhatsApp
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="md:col-span-2 space-y-6">
            <Card className="crm-card border-none shadow-none bg-card/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-primary" />
                  Configuração de Webhook
                </CardTitle>
                <CardDescription>
                  Necessário para o UAZAPI/Evolution/Z-API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    URL do Webhook <Badge variant="outline" className="text-[8px] h-4">POST</Badge>
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate text-xs bg-muted px-2 py-2 rounded border font-mono">
                      {webhookUrl.data || "Configurando URL autenticada..."}
                    </code>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        if (!webhookUrl.data) return;
                        navigator.clipboard.writeText(webhookUrl.data);
                        toast.success("URL do webhook copiada!");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-[11px] space-y-2">
                  <p className="font-semibold text-primary">Instruções para UAZAPI:</p>
                  <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                    <li>Copie a URL acima</li>
                    <li>No painel UAZAPI, acesse sua instância</li>
                    <li>Vá em <b>Webhooks</b></li>
                    <li>Cole em <b>Webhook URL</b></li>
                    <li>Selecione <b>MESSAGES_UPSERT</b> (ou eventos de mensagem)</li>
                    <li>Salve as alterações</li>
                  </ol>
                </div>

                <p className="text-[10px] text-muted-foreground italic">
                  O sistema usa <b>idempotência</b> via <code>provider_message_id</code> para evitar duplicidade de mensagens no CRM.
                </p>
              </CardContent>
            </Card>

            <Card className="crm-card border-none shadow-none bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Configuração Global</CardTitle>
              <CardDescription>
                Dados da API central
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ID do Provedor</label>
                <div className="text-sm font-mono truncate bg-muted px-2 py-1 rounded">
                  {status?.provider?.id || "---"}
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-4">
                  As credenciais de API são vinculadas somente a este estabelecimento e não são reutilizadas pelo OTP global.
                </p>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <a href="/hash/integracoes">
                    Configurar Credenciais
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
}
