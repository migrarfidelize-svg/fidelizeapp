import React, { useState, useEffect } from "react";
import { Smartphone, Save, Send, Eye, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getOTPTemplate, saveOTPTemplate, sendOTPTestMessage } from "@/lib/atendimento.functions";
import { toast } from "sonner";

export function OTPEditor() {
  const queryClient = useQueryClient();
  const { data: templateData } = useQuery({ queryKey: ["crm-otp-template"], queryFn: () => getOTPTemplate() });
  
  const [template, setTemplate] = useState("");
  const [testPhone, setTestPhone] = useState("");

  useEffect(() => {
    if (templateData?.template) setTemplate(templateData.template);
  }, [templateData]);

  const saveMutation = useMutation({
    mutationFn: (text: string) => saveOTPTemplate({ data: { template: text } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-otp-template"] });
      toast.success("Template OTP salvo!");
    }
  });

  const sendTestMutation = useMutation({
    mutationFn: () => sendOTPTestMessage({ data: { phone: testPhone, message: template.replace("{{code}}", "123456").replace("{{minutes}}", "10") } }),
    onSuccess: () => toast.success("Mensagem de teste enviada!"),
    onError: (err: any) => toast.error(err.message)
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="dash-card">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Code className="h-4 w-4" /> Editor de Template</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Conteúdo do WhatsApp</label>
            <Textarea 
              value={template} 
              onChange={e => setTemplate(e.target.value)} 
              rows={8}
              placeholder="Use {{code}} e {{minutes}}"
              className="font-mono text-xs"
            />
            <div className="flex gap-2 text-[9px] text-muted-foreground italic">
               <span>Variáveis: {"{{code}}"}, {"{{minutes}}"}</span>
            </div>
          </div>
          <Button className="w-full gradient-brand" onClick={() => saveMutation.mutate(template)} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" /> Salvar Alterações
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="dash-card bg-primary/5 border-primary/20">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4" /> Preview do Cliente</CardTitle></CardHeader>
          <CardContent>
            <div className="bg-card border rounded-2xl p-4 shadow-sm relative">
              <div className="absolute -left-2 top-4 w-0 h-0 border-t-[8px] border-t-transparent border-r-[10px] border-r-card border-b-[8px] border-b-transparent"></div>
              <p className="text-xs whitespace-pre-wrap">{template.replace("{{code}}", "123456").replace("{{minutes}}", "10")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="dash-card">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4" /> Enviar Teste Real</CardTitle></CardHeader>
          <CardContent className="space-y-3">
             <Input 
               placeholder="Seu WhatsApp (Ex: 5511999999999)" 
               value={testPhone} 
               onChange={e => setTestPhone(e.target.value)} 
               className="h-9 text-xs"
             />
             <Button variant="outline" className="w-full h-9 text-xs" onClick={() => sendTestMutation.mutate()} disabled={sendTestMutation.isPending || !testPhone}>
               {sendTestMutation.isPending ? "Enviando..." : "Testar no meu WhatsApp"}
             </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
