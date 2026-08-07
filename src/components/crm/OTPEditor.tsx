import React, { useState, useEffect } from "react";
import { Smartphone, Save, Send, Eye, Code, CheckCircle2, XCircle, ExternalLink, RefreshCw, Zap, Clock, ShieldCheck, ChevronRight, Plus, Loader2, Settings2 } from "lucide-react";
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
    onSuccess: () => toast.success("Mensagem de teste enviada!"),
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
    
    // Focus back and set cursor position
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

  if (isLoading) return <div className="p-12 text-center opacity-50">Carregando configurações...</div>;

  const previewText = template
    .replace(/{{code}}/g, "482913")
    .replace(/{{minutes}}/g, configs.validity_minutes.toString())
    .replace(/{{brand}}/g, "Afidelize");

  const providerStatus = otpData?.provider?.enabled ? "ATIVO" : "INATIVO";
  const isConnected = !!otpData?.provider;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight uppercase">AUTENTICAÇÃO VIA WHATSAPP</h2>
          <p className="text-sm text-muted-foreground">Controle a mensagem de código enviada aos clientes no acesso à Carteira.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="h-9 text-xs gap-2" onClick={restoreDefault}>
             <RefreshCw className="h-3.5 w-3.5" /> Restaurar Padrão
           </Button>
           <Button className="h-9 text-xs gradient-brand gap-2" onClick={() => saveMutation.mutate({ text: template, configs })} disabled={saveMutation.isPending}>
             {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
             Salvar Alterações
           </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* COLUNA ESQUERDA: Status e Editor */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="dash-card border-l-4 border-l-primary">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Smartphone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">WHATSAPP OTP</CardTitle>
                    <CardDescription className="text-xs">Motor de autenticação passwordless</CardDescription>
                  </div>
                </div>
                <Badge className={cn(otpData?.provider?.enabled ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" : "bg-red-500/10 text-red-600")}>
                  {providerStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 flex items-center justify-between border-t bg-muted/30 py-3 px-6">
              <div className="flex items-center gap-6">
                <div className="space-y-0.5">
                  <div className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Provider atual</div>
                  <div className="text-xs font-bold">{otpData?.provider?.name || "Nenhum configurado"}</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Estado</div>
                  <div className="flex items-center gap-1.5">
                    {isConnected ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        <span className="text-xs font-bold text-green-600">Conectado</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 text-red-500" />
                        <span className="text-xs font-bold text-red-600">Desconectado / Erro</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" asChild className="h-8 text-[10px] uppercase font-bold tracking-tight">
                <Link to="/hash/integracoes">
                  Abrir Integrações <ExternalLink className="h-3 w-3 ml-1.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="dash-card">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Code className="h-4 w-4 text-primary" /> MENSAGEM DO CÓDIGO DE ACESSO
              </CardTitle>
              <CardDescription className="text-xs">Configure o texto que o cliente receberá no WhatsApp.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Textarea 
                  id="otp-template-editor"
                  value={template} 
                  onChange={e => setTemplate(e.target.value)} 
                  rows={6}
                  placeholder="Escreva sua mensagem aqui..."
                  className="font-mono text-sm resize-none focus-visible:ring-primary/30"
                />
                <div className="flex flex-wrap items-center gap-2">
                   <span className="text-[10px] font-bold uppercase text-muted-foreground mr-2">Variáveis:</span>
                   {[
                     { label: "{{code}}", value: "{{code}}" },
                     { label: "{{minutes}}", value: "{{minutes}}" },
                     { label: "{{brand}}", value: "{{brand}}" }
                   ].map(v => (
                     <button 
                       key={v.value}
                       onClick={() => insertVariable(v.value)}
                       className="bg-muted hover:bg-primary/10 hover:text-primary transition-colors text-[10px] font-mono px-2 py-1 rounded-md border border-border flex items-center gap-1"
                     >
                       {v.label} <Plus className="h-2.5 w-2.5" />
                     </button>
                   ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dash-card">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> CONFIGURAÇÕES DE SEGURANÇA
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Validade do código (min)</Label>
                <Input 
                  type="number" 
                  value={configs.validity_minutes} 
                  onChange={e => setConfigs({...configs, validity_minutes: parseInt(e.target.value)})}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cooldown de reenvio (seg)</Label>
                <Input 
                  type="number" 
                  value={configs.cooldown_seconds} 
                  onChange={e => setConfigs({...configs, cooldown_seconds: parseInt(e.target.value)})}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Máximo de tentativas</Label>
                <Input 
                  type="number" 
                  value={configs.max_attempts} 
                  onChange={e => setConfigs({...configs, max_attempts: parseInt(e.target.value)})}
                  className="h-9 text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COLUNA DIREITA: Preview e Teste */}
        <div className="lg:col-span-5 space-y-6">
          <div className="sticky top-8 space-y-6">
            <Card className="dash-card overflow-hidden">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" /> PREVIEW WHATSAPP
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 bg-[#E5DDD5] min-h-[250px] relative flex flex-col justify-end">
                {/* Visual Estilo WhatsApp */}
                <div className="bg-white rounded-2xl p-3 shadow-sm relative max-w-[85%] animate-in slide-in-from-left-4">
                  <div className="absolute -left-2 top-2 w-0 h-0 border-t-[6px] border-t-transparent border-r-[10px] border-r-white border-b-[6px] border-b-transparent"></div>
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{previewText}</p>
                  <div className="text-[9px] text-muted-foreground mt-1 text-right">10:42</div>
                </div>
              </CardContent>
            </Card>

            <Card className="dash-card">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" /> TESTAR MENSAGEM
                </CardTitle>
                <CardDescription className="text-xs">Envie uma mensagem de teste real para o seu número.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">WhatsApp de teste</Label>
                  <Input 
                    placeholder="Ex: 5511999999999" 
                    value={testPhone} 
                    onChange={e => setTestPhone(e.target.value)} 
                    className="h-10 text-sm"
                  />
                </div>
                <Button 
                  variant="outline" 
                  className="w-full h-10 text-xs font-bold gap-2 hover:bg-primary hover:text-white transition-all" 
                  onClick={() => sendTestMutation.mutate()} 
                  disabled={sendTestMutation.isPending || !testPhone || !otpData?.provider?.enabled}
                >
                  {sendTestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {otpData?.provider?.enabled ? "Enviar teste" : "Provider inativo"}
                </Button>
              </CardContent>
            </Card>

            <Card className="dash-card border-none bg-primary/5">
              <CardContent className="p-6">
                 <h4 className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                   <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Fluxo Informativo
                 </h4>
                 <div className="space-y-3">
                   {[
                     { label: "Cliente informa WhatsApp", icon: Smartphone },
                     { label: "Afidelize gera código", icon: Zap },
                     { label: "WhatsApp envia OTP", icon: Send },
                     { label: "Cliente informa código", icon: ShieldCheck },
                     { label: "Backend valida", icon: CheckCircle2 },
                     { label: "Sessão Supabase", icon: Clock },
                     { label: "/carteira", icon: ChevronRight }
                   ].map((step, i) => (
                     <div key={i} className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-background border flex items-center justify-center text-[10px] font-bold shadow-sm">
                           <step.icon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="text-xs font-medium">{step.label}</span>
                        {i < 6 && <ChevronRight className="h-3 w-3 ml-auto opacity-20 rotate-90 sm:rotate-0" />}
                     </div>
                   ))}
                 </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
