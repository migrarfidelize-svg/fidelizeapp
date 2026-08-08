import React, { useState, useEffect } from "react";
import { Smartphone, Save, Send, Eye, Code, CheckCircle2, XCircle, ExternalLink, RefreshCw, Zap, Clock, ShieldCheck, ChevronRight, Plus, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getOTPSettingsDetailed, saveOTPTemplate, sendOTPTestMessage } from "@/lib/atendimento.functions";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { Label } from "@/components/ui/label";

export function OTPEditor() {
  const queryClient = useQueryClient();

  const { data: otpData, isLoading } = useQuery({ 
    queryKey: ["crm-otp-settings"], 
    queryFn: () => getOTPSettingsDetailed() 
  });
  
  const [template, setTemplate] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [configs, setConfigs] = useState({
    validity_minutes: 10,
    cooldown_seconds: 60,
    max_attempts: 5
  });

  useEffect(() => {
    if (otpData) {
      setTemplate(otpData.template);
      setConfigs(otpData.configs);
    }
  }, [otpData]);

  const saveMutation = useMutation({
    mutationFn: (vars: { text: string; configs: typeof configs }) => 
      saveOTPTemplate({ data: { template: vars.text, configs: vars.configs } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-otp-settings"] });
      toast.success("Configurações OTP salvas com sucesso!");
    },
    onError: (err: any) => toast.error(err.message)
  });

  const sendTestMutation = useMutation({
    mutationFn: () => sendOTPTestMessage({ 
      data: { 
        phone: testPhone, 
        message: template
          .replace(/{{code}}/g, "482913")
          .replace(/{{minutes}}/g, configs.validity_minutes.toString())
          .replace(/{{brand}}/g, "Afidelize") 
      } 
    }),
    onSuccess: (res) => {
      if (res && res.ok) {
        toast.success("Mensagem de teste enviada!");
      } else {
        toast.error(res?.message || "Falha no envio da mensagem.");
      }
    },
    onError: (err: any) => toast.error(err.message)
  });

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById("otp-template-editor") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    const newTemplate = before + variable + after;
    setTemplate(newTemplate);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const restoreDefault = () => {
    if (confirm("Deseja restaurar o template para o padrão oficial?")) {
      const defaultTemplate = "Afidelize\n\nSeu código de acesso é {{code}}.\n\nEle expira em {{minutes}} minutos.\n\nNão compartilhe este código.";
      setTemplate(defaultTemplate);
      toast.info("Template restaurado. Não esqueça de salvar.");
    }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-full opacity-40 py-20">
      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
      <span className="text-sm font-bold uppercase tracking-widest">Sincronizando Gateway OTP...</span>
    </div>
  );

  const previewText = template
    .replace(/{{code}}/g, "482913")
    .replace(/{{minutes}}/g, configs.validity_minutes.toString())
    .replace(/{{brand}}/g, "Afidelize");

  const providerStatus = otpData?.provider?.enabled ? "ATIVO" : "INATIVO";
  const isConnected = !!otpData?.provider;

  return (
    <div className="bg-background min-h-full p-6 lg:p-8">
      {/* Header Central OTP */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 bg-card p-6 border rounded-xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
            <Smartphone className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">Central de Autenticação OTP</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={cn(
                "text-[10px] font-black tracking-widest px-2 py-0.5 border-none",
                otpData?.provider?.enabled ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
              )}>
                GATEWAY {providerStatus}
              </Badge>
              <span className="text-xs text-muted-foreground">• Responsável pelo login passwordless da Carteira</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="crm-button-secondary px-6" onClick={restoreDefault}>
            <RefreshCw className="h-4 w-4" /> Restaurar Padrão
          </button>
          <button 
            className="crm-button-primary px-8" 
            onClick={() => saveMutation.mutate({ text: template, configs })} 
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Configurações
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* COLUNA ESQUERDA: Configuração */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Status do Provider */}
          <div className="crm-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Conectividade do Sistema</h4>
              <button className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1" onClick={() => window.location.href='/hash/integracoes'}>
                <Link to="/hash/integracoes">Geral Integracoes <ExternalLink className="h-3 w-3" /></Link>
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-muted-foreground opacity-60">Provedor Ativo</div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-lg">{otpData?.provider?.name || "Nenhum"}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-muted-foreground opacity-60">Status de Rede (API)</div>
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-black text-lg text-green-600">OPERACIONAL</span>
                    </>
                  ) : (
                    <>
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="font-black text-lg text-red-600">DESCONECTADO</span>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-muted-foreground opacity-60">WhatsApp Logado</div>
                <div className="flex items-center gap-2">
                  {otpData?.provider?.status === "CONNECTED" ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="font-black text-lg text-green-600">CONECTADO</span>
                    </>
                  ) : (
                    <>
                      <div className="h-2 w-2 rounded-full bg-orange-500" />
                      <span className="font-black text-lg text-orange-600">AGUARDANDO PAREAMENTO</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Editor de Template */}
          <div className="crm-card">
            <div className="p-6 border-b flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <Code className="h-4 w-4" /> Template da Mensagem
              </h4>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <Textarea 
                  id="otp-template-editor"
                  value={template} 
                  onChange={e => setTemplate(e.target.value)} 
                  rows={8}
                  placeholder="Escreva a mensagem que o cliente receberá..."
                  className="font-mono text-sm resize-none bg-muted/20 border-border/50 focus-visible:ring-primary/20 leading-relaxed"
                />
                <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/40">
                   <div className="flex items-center gap-2 mr-4">
                     <Info className="h-3.5 w-3.5 text-muted-foreground" />
                     <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Variáveis</span>
                   </div>
                   {[
                     { label: "{{code}}", value: "{{code}}", desc: "Token de 6 dígitos" },
                     { label: "{{minutes}}", value: "{{minutes}}", desc: "Tempo de validade" },
                     { label: "{{brand}}", value: "{{brand}}", desc: "Nome da marca" }
                   ].map(v => (
                     <button 
                       key={v.value}
                       onClick={() => insertVariable(v.value)}
                       title={v.desc}
                       className="bg-card hover:bg-primary hover:text-white transition-all text-[11px] font-mono px-3 py-1.5 rounded-md border border-border flex items-center gap-2 shadow-sm"
                     >
                       {v.label} <Plus className="h-3 w-3" />
                     </button>
                   ))}
                </div>
              </div>
            </div>
          </div>

          {/* Segurança */}
          <div className="crm-card">
            <div className="p-6 border-b">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Parâmetros de Segurança
              </h4>
            </div>
            <div className="p-6 grid sm:grid-cols-3 gap-8">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Validade do Token</Label>
                <div className="relative">
                  <Input 
                    type="number" 
                    value={configs.validity_minutes} 
                    onChange={e => setConfigs({...configs, validity_minutes: parseInt(e.target.value)})}
                    className="h-11 font-bold pl-4 pr-12 bg-muted/20"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">MIN</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Intervalo Reenvio</Label>
                <div className="relative">
                  <Input 
                    type="number" 
                    value={configs.cooldown_seconds} 
                    onChange={e => setConfigs({...configs, cooldown_seconds: parseInt(e.target.value)})}
                    className="h-11 font-bold pl-4 pr-12 bg-muted/20"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">SEG</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Tentativas Máximas</Label>
                <div className="relative">
                  <Input 
                    type="number" 
                    value={configs.max_attempts} 
                    onChange={e => setConfigs({...configs, max_attempts: parseInt(e.target.value)})}
                    className="h-11 font-bold pl-4 pr-12 bg-muted/20"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">QTD</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: Preview */}
        <div className="lg:col-span-5 space-y-8">
          <div className="sticky top-8 space-y-8">
            
            {/* Preview WhatsApp */}
            <div className="crm-card overflow-hidden bg-[#E5DDD5]">
              <div className="p-4 border-b bg-card flex items-center justify-between shrink-0">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <Eye className="h-4 w-4" /> Simulador de Recebimento
                </h4>
              </div>
              <div className="p-8 min-h-[300px] flex flex-col justify-end">
                <div className="bg-white rounded-2xl rounded-tl-none p-4 shadow-md relative max-w-[90%] animate-in slide-in-from-left-4">
                  <div className="absolute -left-2 top-0 w-0 h-0 border-t-[8px] border-t-white border-l-[8px] border-l-transparent"></div>
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-[#111]">{previewText}</p>
                  <div className="text-[10px] text-[#667781] mt-2 text-right flex items-center justify-end gap-1">
                    10:45 <span className="text-[#53bdeb]">✓✓</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Teste de Envio */}
            <div className="crm-card p-6">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-6 flex items-center gap-2">
                <Send className="h-4 w-4" /> Homologação de Envio
              </h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Número para teste (DDI+DDD+NÚMERO)</Label>
                  <Input 
                    placeholder="Ex: 5511999999999" 
                    value={testPhone} 
                    onChange={e => setTestPhone(e.target.value)} 
                    className="h-11 font-bold bg-muted/20"
                  />
                </div>
                <button 
                  className="crm-button-primary w-full h-11 text-xs font-black tracking-[0.1em] uppercase" 
                  onClick={() => sendTestMutation.mutate()} 
                  disabled={sendTestMutation.isPending || !testPhone || !otpData?.provider?.enabled}
                >
                  {sendTestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Disparar Mensagem de Teste
                </button>
                {!otpData?.provider?.enabled && (
                  <p className="text-[10px] text-destructive font-bold text-center uppercase tracking-widest animate-pulse">
                    Gateway inativo. Verifique as integrações.
                  </p>
                )}
              </div>
            </div>

            {/* Dica de Segurança */}
            <div className="p-6 bg-primary/5 rounded-xl border border-primary/10 flex gap-4">
              <ShieldCheck className="h-6 w-6 text-primary shrink-0" />
              <div className="space-y-1">
                <h5 className="text-[11px] font-black uppercase tracking-widest text-primary">Protocolo Afidelize</h5>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Utilize <strong>{"{{code}}"}</strong> em uma linha isolada para facilitar a leitura do cliente. O tempo de validade <strong>{"{{minutes}}"}</strong> ajuda a reduzir chamados de suporte por tokens expirados.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
