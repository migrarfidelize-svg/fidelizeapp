import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AudioLines, Play, Square, Save, Sparkles, Zap, Globe, Loader2, 
  CheckCircle2, AlertCircle, RefreshCw, Trash2, History, Activity, ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  getVoiceStudio, 
  saveVoiceStudio 
} from "@/lib/voice-studio.functions";
import { 
  getElevenLabsVoices, 
  testElevenLabsConnection 
} from "@/lib/elevenlabs.functions";
import { speakGlobal } from "@/lib/tts-global.functions";
import { stopSpeaking, speakWithBrowser } from "@/components/GreetingVoice";

type Props = {
  scope: "merchant" | "admin";
  establishmentId?: string;
};

export function VoiceStudioCard({ scope, establishmentId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [fetchingVoices, setFetchingVoices] = useState(false);
  const [voices, setVoices] = useState<any[]>([]);
  
  const [prefs, setPrefs] = useState({
    enabled: true,
    provider: "auto" as "native" | "elevenlabs" | "auto",
    fallback_enabled: true,
    voice_id: "onyx",
    eleven_voice_id: "21m0pOTjCwobq1Wnu3pd",
    eleven_model_id: "eleven_multilingual_v2",
    texts: { 
      welcome: "Olá, bem-vindo ao nosso estabelecimento!", 
      call: "Atenção cliente {{nome}}, seu pedido está pronto.", 
      ready: "Pedido número {{numero}} concluído.", 
      notify: "Nova notificação recebida." 
    },
    params: { rate: 1, volume: 1, stability: 0.5, similarity: 0.75 }
  });

  const getStudio = useServerFn(getVoiceStudio);
  const saveStudio = useServerFn(saveVoiceStudio);
  const getVoices = useServerFn(getElevenLabsVoices);
  const testConn = useServerFn(testElevenLabsConnection);
  const doSpeak = useServerFn(speakGlobal);

  useEffect(() => {
    if (establishmentId) {
      loadData();
    }
  }, [establishmentId]);

  async function loadData() {
    try {
      setLoading(true);
      const res = await getStudio({ data: { establishment_id: establishmentId! } });
      if (res.prefs) {
        setPrefs(prev => ({ ...prev, ...res.prefs }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const update = (patch: any) => setPrefs(prev => ({ ...prev, ...patch }));
  const updateParam = (k: string, v: number) => setPrefs(prev => ({ ...prev, params: { ...prev.params, [k]: v } }));
  const updateText = (k: string, v: string) => setPrefs(prev => ({ ...prev, texts: { ...prev.texts, [k]: v } }));

  async function onSave() {
    if (!establishmentId) return;
    setSaving(true);
    try {
      await saveStudio({ data: { establishment_id: establishmentId, prefs } });
      toast.success("Configurações do Studio salvas!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function fetchElevenVoices() {
    setFetchingVoices(true);
    try {
      const list = await getVoices();
      setVoices(list);
      toast.success(`${list.length} vozes carregadas.`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setFetchingVoices(false);
    }
  }

  async function handleTest(textType: string) {
    const text = (prefs.texts as any)[textType];
    if (!text) return toast.error("Texto vazio!");
    
    setPlaying(true);
    try {
      const res = await doSpeak({
        data: {
          text,
          provider: prefs.provider,
          voice_id: prefs.eleven_voice_id,
          model_id: prefs.eleven_model_id,
          fallback_enabled: prefs.fallback_enabled,
          params: prefs.params
        }
      });

      if (res.audio) {
        const audio = new Audio(`data:${res.mime};base64,${res.audio}`);
        await audio.play();
        toast.success(`Reproduzindo via ${res.provider}`);
      } else if (res.fallback === "native") {
        await speakWithBrowser(text, scope === "admin" ? "male" : "female", prefs.params);
        toast.info("Usando fallback: Voz nativa");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPlaying(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-6">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="provider">Provedor</TabsTrigger>
              <TabsTrigger value="texts">Textos</TabsTrigger>
              <TabsTrigger value="eleven">ElevenLabs</TabsTrigger>
              <TabsTrigger value="diag" className="hidden lg:flex">Diagnóstico</TabsTrigger>
              <TabsTrigger value="history" className="hidden lg:flex">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configuração de Voz Ativa</CardTitle>
                  <CardDescription>Resumo dos controles de locução do seu dashboard.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10">
                    <div className="space-y-1">
                      <p className="font-medium">Status do Studio</p>
                      <p className="text-xs text-muted-foreground">Ative ou desative todas as locuções.</p>
                    </div>
                    <Switch checked={prefs.enabled} onCheckedChange={v => update({ enabled: v })} />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Provedor</p>
                      <p className="font-bold capitalize">{prefs.provider}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Fallback</p>
                      <p className="font-bold">{prefs.fallback_enabled ? "Ativo" : "Off"}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Voz Nativa</p>
                      <p className="font-bold">OK</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Qualidade</p>
                      <p className="font-bold">Premium</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-4">
                <Card className="card-icon">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" /> Web Speech API
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">Voz nativa do navegador. Gratuita e rápida, porém menos realista.</p>
                  </CardContent>
                </Card>
                <Card className="card-icon">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" /> ElevenLabs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">Vozes neurais ultrarrealistas. Requer API Key e consome créditos.</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="provider" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Seleção de Provedor</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Button 
                      variant={prefs.provider === "auto" ? "default" : "outline"}
                      className="h-auto py-4 flex-col gap-1"
                      onClick={() => update({ provider: "auto" })}
                    >
                      <Activity className="h-5 w-5" />
                      <span>Automático</span>
                      <span className="text-[10px] opacity-60">Recomendado</span>
                    </Button>
                    <Button 
                      variant={prefs.provider === "elevenlabs" ? "default" : "outline"}
                      className="h-auto py-4 flex-col gap-1"
                      onClick={() => update({ provider: "elevenlabs" })}
                    >
                      <Zap className="h-5 w-5" />
                      <span>ElevenLabs</span>
                      <span className="text-[10px] opacity-60">Alta Qualidade</span>
                    </Button>
                    <Button 
                      variant={prefs.provider === "native" ? "default" : "outline"}
                      className="h-auto py-4 flex-col gap-1"
                      onClick={() => update({ provider: "native" })}
                    >
                      <Globe className="h-5 w-5" />
                      <span>Nativo</span>
                      <span className="text-[10px] opacity-60">Browser Only</span>
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-xl">
                    <div className="space-y-0.5">
                      <Label>Ativar Fallback Inteligente</Label>
                      <p className="text-xs text-muted-foreground">Usa voz nativa se o provedor principal falhar.</p>
                    </div>
                    <Switch checked={prefs.fallback_enabled} onCheckedChange={v => update({ fallback_enabled: v })} />
                  </div>

                  <div className="space-y-4 pt-2">
                    <Label>Ajustes de Reprodução</Label>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs">Velocidade ({prefs.params.rate}x)</span>
                        </div>
                        <Slider value={[prefs.params.rate]} min={0.5} max={2} step={0.1} onValueChange={([v]) => updateParam("rate", v)} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs">Volume ({Math.round(prefs.params.volume * 100)}%)</span>
                        </div>
                        <Slider value={[prefs.params.volume]} min={0} max={1} step={0.1} onValueChange={([v]) => updateParam("volume", v)} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="texts" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Modelos de Mensagem</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Mensagem de Boas-vindas</Label>
                      <Textarea 
                        value={prefs.texts.welcome} 
                        onChange={e => updateText("welcome", e.target.value)}
                        placeholder="Ex: Olá, seja bem-vindo!"
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleTest("welcome")} disabled={playing}>
                          <Play className="h-3 w-3 mr-2" /> Testar
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Chamada de Cliente (Dashboard)</Label>
                      <Textarea 
                        value={prefs.texts.call} 
                        onChange={e => updateText("call", e.target.value)}
                        placeholder="Use {{nome}} para o nome do cliente"
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleTest("call")} disabled={playing}>
                          <Play className="h-3 w-3 mr-2" /> Testar
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Notificação Genérica</Label>
                      <Textarea 
                        value={prefs.texts.notify} 
                        onChange={e => updateText("notify", e.target.value)}
                        placeholder="Texto para alertas do sistema"
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleTest("notify")} disabled={playing}>
                          <Play className="h-3 w-3 mr-2" /> Testar
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="eleven" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Configuração ElevenLabs</CardTitle>
                  <CardDescription>A API Key deve ser definida no servidor (.env).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="py-2 px-4 gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" /> API KEY: PROTEGIDA NO SERVIDOR
                    </Badge>
                    <Button variant="outline" size="sm" onClick={async () => {
                      const res = await testConn();
                      if (res.ok) toast.success("Conexão validada!");
                      else toast.error(res.message);
                    }}>Testar Conexão</Button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Selecione a Voz</Label>
                        <Button variant="link" size="sm" className="h-auto p-0" onClick={fetchElevenVoices} disabled={fetchingVoices}>
                          {fetchingVoices ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                          Carregar vozes
                        </Button>
                      </div>
                      <Select value={prefs.eleven_voice_id} onValueChange={v => update({ eleven_voice_id: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha uma voz..." />
                        </SelectTrigger>
                        <SelectContent>
                          {voices.length > 0 ? voices.map((v: any) => (
                            <SelectItem key={v.voice_id} value={v.voice_id}>{v.name} ({v.category})</SelectItem>
                          )) : (
                            <SelectItem value="21m0pOTjCwobq1Wnu3pd">Rachel (Padrão)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Estabilidade ({prefs.params.stability})</Label>
                        <Slider value={[prefs.params.stability]} min={0} max={1} step={0.05} onValueChange={([v]) => updateParam("stability", v)} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Similaridade ({prefs.params.similarity})</Label>
                        <Slider value={[prefs.params.similarity]} min={0} max={1} step={0.05} onValueChange={([v]) => updateParam("similarity", v)} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="diag" className="mt-4 space-y-4">
              <Card>
                <CardHeader><CardTitle>Diagnóstico de Sistema</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Compatibilidade Browser</span>
                      <Badge>OK</Badge>
                    </div>
                    <Progress value={100} className="h-1" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Serviço ElevenLabs</span>
                      <Badge variant="outline">Configurado</Badge>
                    </div>
                    <Progress value={100} className="h-1" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Latência Média</span>
                      <span className="text-xs font-mono">1.2s</span>
                    </div>
                    <Progress value={85} className="h-1" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4 space-y-4">
              <Card>
                <CardHeader><CardTitle>Log de Atividade</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground text-center py-8">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    Nenhum teste registrado nesta sessão.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card className="bg-primary/5 border-primary/20 sticky top-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Play className="h-4 w-4" /> Preview Rápido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-background rounded-xl border border-dashed text-center space-y-3">
                <p className="text-xs text-muted-foreground italic">"Testar a voz agora irá usar o provedor <strong>{prefs.provider}</strong> com as configurações atuais."</p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" onClick={() => handleTest("welcome")} disabled={playing}>
                    {playing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { stopSpeaking(); setPlaying(false); }}>
                    <Square className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs">Dica do Especialista</Label>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Utilize variáveis como {"{{nome}}"} em suas mensagens. Nosso motor de voz irá substituir automaticamente pelos dados reais do cliente no momento da locução.
                </p>
              </div>

              <Button className="w-full gap-2 mt-4" onClick={onSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Studio
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
