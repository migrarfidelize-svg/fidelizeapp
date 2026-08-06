import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { AudioLines, Play, Square, Save, Sparkles, Zap, Globe, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  VOICE_OPTIONS,
  loadVoicePrefs,
  saveVoicePrefs,
  defaultVoicePrefs,
  type VoicePrefs,
  type VoiceId,
} from "@/lib/voice-prefs";
import { buildGreeting, speakText, stopSpeaking } from "@/components/GreetingVoice";
import { synthesizeElevenLabs, testElevenLabsConnection } from "@/lib/elevenlabs.functions";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";

type Props = {
  scope: "merchant" | "admin";
};

export function VoiceStudioCard({ scope }: Props) {
  const [prefs, setPrefs] = useState<VoicePrefs>(() => defaultVoicePrefs(scope));
  const [playing, setPlaying] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ ok: boolean; message?: string } | null>(null);
  
  const testConn = useServerFn(testElevenLabsConnection);
  const synthEleven = useServerFn(synthesizeElevenLabs);

  const gender: "female" | "male" = scope === "admin" ? "male" : "female";

  useEffect(() => {
    setPrefs(loadVoicePrefs(scope));
  }, [scope]);

  const update = (patch: Partial<VoicePrefs>) => setPrefs((p) => ({ ...p, ...patch }));

  const onTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await testConn();
      setConnectionStatus(res);
      if (res.ok) toast.success("Conexão com ElevenLabs estabelecida!");
      else toast.error(res.message || "Falha na conexão.");
    } catch (err: any) {
      setConnectionStatus({ ok: false, message: err.message });
      toast.error("Erro ao testar conexão.");
    } finally {
      setTestingConnection(false);
    }
  };

  const preview = async () => {
    const text = (prefs.text.trim() || buildGreeting(gender)).slice(0, 1000);
    setPlaying(true);
    
    try {
      if (prefs.provider === "elevenlabs") {
        const res = await synthEleven({
          data: {
            text,
            voice_id: prefs.elevenVoiceId,
            model_id: prefs.elevenModelId,
            stability: prefs.stability,
            similarity_boost: prefs.similarity,
          }
        });
        if (res.audio) {
          const audio = new Audio(`data:${res.mime};base64,${res.audio}`);
          await audio.play();
          toast.success("Reproduzindo via ElevenLabs");
        }
      } else {
        const result = await speakText({ 
          text, 
          voice: prefs.voice, 
          style: prefs.style,
          // Adicionando suporte a rate/pitch/volume na speakText se necessário, 
          // mas por enquanto mantemos a interface estável.
        });
        if (result === "failed") toast.error("Não foi possível reproduzir.");
        else if (result === "browser") toast.info("Usando voz nativa do navegador.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro na reprodução.");
    } finally {
      setPlaying(false);
    }
  };

  const save = () => {
    saveVoicePrefs(scope, prefs);
    toast.success("Configurações de voz salvas com sucesso!");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="card-icon overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AudioLines className="h-5 w-5 text-primary" />
              Controle de Voz
            </CardTitle>
            <CardDescription>Gerencie a experiência auditiva do {scope === 'admin' ? 'painel administrativo' : 'PDV'}.</CardDescription>
          </div>
          <Switch
            checked={prefs.enabled}
            onCheckedChange={(v) => update({ enabled: v })}
          />
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Provedor de Voz Principal</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant={prefs.provider === 'native' ? 'default' : 'outline'}
                  className="justify-start gap-2"
                  onClick={() => update({ provider: 'native' })}
                >
                  <Globe className="h-4 w-4" /> Nativo / Browser
                </Button>
                <Button 
                  variant={prefs.provider === 'elevenlabs' ? 'default' : 'outline'}
                  className="justify-start gap-2"
                  onClick={() => update({ provider: 'elevenlabs' })}
                >
                  <Zap className="h-4 w-4" /> ElevenLabs
                </Button>
              </div>
            </div>

            {prefs.provider === 'native' ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                <div className="space-y-2">
                  <Label>Voz do Sistema</Label>
                  <Select value={prefs.voice} onValueChange={(v) => update({ voice: v as VoiceId })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_OPTIONS.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.label} — {v.hint}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Velocidade ({prefs.rate}x)</Label>
                    <Slider value={[prefs.rate]} min={0.5} max={2} step={0.1} onValueChange={([v]) => update({ rate: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Volume ({Math.round(prefs.volume * 100)}%)</Label>
                    <Slider value={[prefs.volume]} min={0} max={1} step={0.1} onValueChange={([v]) => update({ volume: v })} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                <div className="space-y-2">
                  <Label>Voice ID (ElevenLabs)</Label>
                  <Input value={prefs.elevenVoiceId} onChange={e => update({ elevenVoiceId: e.target.value })} placeholder="Ex: 21m0pOTjCwobq1Wnu3pd" />
                </div>
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Select value={prefs.elevenModelId} onValueChange={v => update({ elevenModelId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eleven_multilingual_v2">Multilingual v2 (Melhor)</SelectItem>
                      <SelectItem value="eleven_turbo_v2">Turbo v2 (Mais rápido)</SelectItem>
                      <SelectItem value="eleven_monolingual_v1">English v1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Estabilidade ({prefs.stability})</Label>
                    <Slider value={[prefs.stability]} min={0} max={1} step={0.05} onValueChange={([v]) => update({ stability: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Similaridade ({prefs.similarity})</Label>
                    <Slider value={[prefs.similarity]} min={0} max={1} step={0.05} onValueChange={([v]) => update({ similarity: v })} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={onTestConnection} disabled={testingConnection}>
                    {testingConnection ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                    Testar Conexão
                  </Button>
                  {connectionStatus && (
                    <Badge variant={connectionStatus.ok ? "default" : "destructive"} className="gap-1">
                      {connectionStatus.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      {connectionStatus.ok ? "Conectado" : "Erro"}
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground italic">Nota: A API Key deve ser configurada no arquivo .env do servidor como ELEVENLABS_API_KEY para segurança.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Mensagem Personalizada</Label>
              <Textarea 
                value={prefs.text} 
                onChange={e => update({ text: e.target.value })}
                placeholder="Vazio para saudação automática..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={preview} disabled={playing || !prefs.enabled} className="gap-2">
              {playing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Testar Voz
            </Button>
            <Button variant="ghost" onClick={() => { stopSpeaking(); setPlaying(false); }} className="gap-2">
              <Square className="h-4 w-4" /> Parar
            </Button>
            <Button variant="secondary" onClick={save} className="ml-auto gap-2">
              <Save className="h-4 w-4" /> Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Status do Serviço</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Voz do Painel:</span>
              <Badge variant={prefs.enabled ? "default" : "secondary"}>
                {prefs.enabled ? "Ativado" : "Desativado"}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Provedor Ativo:</span>
              <span className="font-medium capitalize">{prefs.provider === 'native' ? 'Nativo' : 'ElevenLabs'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Saudação contextua:</span>
              <span className="font-medium">Ligada</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Dica Pro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground leading-relaxed">
              O modo ElevenLabs oferece vozes ultrarrealistas e expressivas. 
              Para uma melhor experiência, utilize o modelo <strong>Multilingual v2</strong>. 
              Lembre-se que o uso da ElevenLabs consome caracteres do seu plano contratado diretamente com eles.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
