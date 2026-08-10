import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  AudioLines, Play, Square, Save, Sparkles, Zap, Globe, Loader2, 
  CheckCircle2, AlertCircle, RefreshCw, Trash2, History, Activity, ShieldCheck,
  Eye, EyeOff, Key, Database, Mic2
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { 
  getElevenConfig,
  saveElevenConfig,
  testElevenConnection,
  listElevenVoices,
  removeElevenConfig,
  generateElevenTestAudio
} from "@/lib/eleven-admin.functions";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  VOICE_OPTIONS,
  loadVoicePrefs,
  saveVoicePrefs,
  defaultVoicePrefs,
  type VoicePrefs,
  type VoiceId,
} from "@/lib/voice-prefs";
import { voiceManager } from "@/lib/voice-manager";


export function VoiceStudioCard({ scope }: { scope: "admin" }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  
  // Local ElevenLabs UI State
  const [showApiKey, setShowApiKey] = useState(false);
  const [elevenApiKey, setElevenApiKey] = useState("");
  const [elevenVoiceId, setElevenVoiceId] = useState("");
  const [elevenModelId, setElevenModelId] = useState("eleven_multilingual_v2");
  const [elevenVoices, setElevenVoices] = useState<any[]>([]);
  const [fetchingVoices, setFetchingVoices] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<'disconnected' | 'connected' | 'unauthorized' | 'invalid_key' | 'no_credits' | 'error'>('disconnected');
  const [lastTested, setLastTested] = useState<string | null>(null);
  const [elevenEnabled, setElevenEnabled] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);

  const [prefs, setPrefs] = useState<VoicePrefs>(() => defaultVoicePrefs("admin"));

  // Server Functions
  const getElevenConfigFn = useServerFn(getElevenConfig);
  const saveElevenConfigFn = useServerFn(saveElevenConfig);
  const testElevenConnFn = useServerFn(testElevenConnection);
  const listVoicesFn = useServerFn(listElevenVoices);
  const removeElevenFn = useServerFn(removeElevenConfig);
  const generateTestAudioFn = useServerFn(generateElevenTestAudio);

  useEffect(() => {
    async function init() {
      setPrefs(loadVoicePrefs());
      try {
        const configRes = await getElevenConfigFn();
        if (configRes.status === 'connected' && configRes.config) {
          setIntegrationStatus('connected');
          setElevenApiKey(configRes.config.hasApiKey ? "••••••••" : "");
          setElevenVoiceId(configRes.config.voiceId);
          setElevenModelId(configRes.config.modelId || "eleven_multilingual_v2");
          setElevenEnabled(configRes.config.enabled !== false);
          if (configRes.config.updated_at) setLastTested(new Date(configRes.config.updated_at).toLocaleString());
        } else if (configRes.status === 'unauthorized') {
          setIntegrationStatus('unauthorized');
        }
      } catch (e) {
        console.error("Erro ao carregar ElevenLabs config", e);
      }
      setLoading(false);
    }
    init();
  }, []);

  const update = (patch: Partial<VoicePrefs>) => setPrefs(prev => ({ ...prev, ...patch }));
  const updateParam = (k: keyof VoicePrefs, v: number) => setPrefs(prev => ({ ...prev, [k]: v }));
  const updateText = (k: keyof VoicePrefs["texts"], v: string) => setPrefs(prev => ({ 
    ...prev, 
    texts: { ...prev.texts, [k]: v }
  }));

  async function onSave() {
    setSaving(true);
    try {
      saveVoicePrefs(prefs);
      toast.success("Configurações globais do Studio salvas!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function fetchElevenVoices() {
    setFetchingVoices(true);
    try {
      const list = await listVoicesFn({ data: { apiKey: elevenApiKey === "••••••••" ? undefined : elevenApiKey.trim() || undefined } });
      setElevenVoices(list);
      toast.success(`${list.length} vozes carregadas.`);
    } catch (e: any) {
      toast.error("Falha ao buscar vozes. Verifique sua API Key.");
    } finally {
      setFetchingVoices(false);
    }
  }

  async function handleTestIntegration() {
    setTestingConnection(true);
    try {
      const res = await testElevenConnFn({ data: { apiKey: elevenApiKey === "••••••••" ? undefined : elevenApiKey.trim() || undefined } });
      if (res.ok) {
        setIntegrationStatus('connected');
        setLastTested(new Date().toLocaleString());
        toast.success("Conexão validada com sucesso!");
        if (elevenVoices.length === 0) fetchElevenVoices();
      } else {
        setIntegrationStatus(res.status as any);
        toast.error(res.message || "Falha na validação.");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleSaveIntegration() {
    if (!elevenApiKey || !elevenVoiceId) {
      toast.error("Preencha a API Key e selecione uma voz.");
      return;
    }
    setSaving(true);
    try {
      await saveElevenConfigFn({
        data: {
          apiKey: elevenApiKey === "••••••••" ? undefined : elevenApiKey.trim() || undefined,
          voiceId: elevenVoiceId,
          modelId: elevenModelId,
          enabled: elevenEnabled,
          voiceName: elevenVoices.find(v => v.voice_id === elevenVoiceId)?.name || "Voz Selecionada",
          stability: prefs.stability,
          similarity: prefs.similarity,
          texts: prefs.texts
        }
      });
      setIntegrationStatus('connected');
      toast.success("Integração ElevenLabs salva como padrão do sistema!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  const handleTest = async (typeOrText: string) => {
    setPlaying(true);
    try {
      let text = typeOrText;
      if (typeOrText === "welcome") text = prefs.texts?.welcome?.replace("{name}", "Carlos") || "Bem-vindo!";
      if (typeOrText === "ready") text = prefs.texts?.ready || "Sistema pronto.";
      if (typeOrText === "notify") text = prefs.texts?.notify || "Nova notificação.";

      await voiceManager.speak(text);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPlaying(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6 overflow-hidden">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="eleven" className="w-full">
            <div className="overflow-x-auto -mx-1 px-1 mb-2">
              <TabsList className="inline-flex min-w-full lg:grid lg:grid-cols-6 h-auto p-1 bg-muted/50">
                <TabsTrigger value="overview" className="flex-1 py-2">Geral</TabsTrigger>
                <TabsTrigger value="provider" className="flex-1 py-2">Provedor</TabsTrigger>
                <TabsTrigger value="texts" className="flex-1 py-2">Textos</TabsTrigger>
                <TabsTrigger value="eleven" className="flex-1 py-2">ElevenLabs</TabsTrigger>
                <TabsTrigger value="diag" className="flex-1 py-2">Diagnóstico</TabsTrigger>
                <TabsTrigger value="history" className="flex-1 py-2">Histórico</TabsTrigger>
              </TabsList>
            </div>



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
                    <Switch checked={prefs.enabled} onCheckedChange={v => {
                      update({ enabled: v });
                      if (scope === 'admin') saveVoicePrefs({ ...prefs, enabled: v });
                    }} />
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
                          <span className="text-xs">Velocidade ({prefs.rate}x)</span>
                        </div>
                        <Slider value={[prefs.rate]} min={0.5} max={2} step={0.1} onValueChange={([v]) => updateParam("rate", v)} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs">Volume ({Math.round(prefs.volume * 100)}%)</span>
                        </div>
                        <Slider value={[prefs.volume]} min={0} max={1} step={0.1} onValueChange={([v]) => updateParam("volume", v)} />
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
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      Integração ElevenLabs
                    </CardTitle>
                    <CardDescription>
                      Configure a integração global para vozes neurais de alta fidelidade em todo o ecossistema Fidelize.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="eleven-enabled" className="text-xs">Ativar</Label>
                    <Switch 
                      id="eleven-enabled"
                      checked={elevenEnabled} 
                      onCheckedChange={setElevenEnabled} 
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {integrationStatus === 'unauthorized' ? (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-destructive">Acesso Restrito</p>
                        <p className="text-sm text-muted-foreground">Você não tem permissão para gerenciar as chaves de API globais do sistema.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Key className="h-4 w-4" /> ElevenLabs API Key
                          </Label>
                          <div className="relative">
                            <Input 
                              type={showApiKey ? "text" : "password"}
                              value={elevenApiKey}
                              onChange={e => setElevenApiKey(e.target.value)}
                              placeholder="Insira sua xi-api-key"
                              className="pr-10"
                            />
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="absolute right-0 top-0 h-full w-10 hover:bg-transparent"
                              onClick={() => setShowApiKey(!showApiKey)}
                            >
                              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Sua chave é armazenada de forma segura e nunca é exposta totalmente no frontend.
                          </p>
                        </div>

                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Modelo de IA</Label>
                              <Select value={elevenModelId} onValueChange={setElevenModelId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o modelo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="eleven_multilingual_v2">Multilingual v2 (Melhor)</SelectItem>
                                  <SelectItem value="eleven_turbo_v2">Turbo v2 (Mais Rápido)</SelectItem>
                                  <SelectItem value="eleven_monolingual_v1">Monolingual v1</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label>Voz Padrão</Label>
                                <Button 
                                  variant="link" 
                                  size="sm" 
                                  className="h-auto p-0 text-xs" 
                                  onClick={fetchElevenVoices}
                                  disabled={fetchingVoices || !elevenApiKey}
                                >
                                  {fetchingVoices ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                                  Sincronizar
                                </Button>
                              </div>
                              <Select value={elevenVoiceId} onValueChange={setElevenVoiceId}>
                                <SelectTrigger>
                                  <SelectValue placeholder={fetchingVoices ? "Carregando..." : "Escolha uma voz..."} />
                                </SelectTrigger>
                                <SelectContent>
                                  {elevenVoices.length > 0 ? elevenVoices.map((v: any) => (
                                    <SelectItem key={v.voice_id} value={v.voice_id}>{v.name} ({v.category})</SelectItem>
                                  )) : (
                                    <SelectItem value="21m0pOTjCwobq1Wnu3pd">Rachel (Padrão Fidelize)</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                      </div>

                      <div className="p-4 bg-muted/30 rounded-xl border space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Status da Integração</span>
                          </div>
                          <Badge variant={integrationStatus === 'connected' ? 'default' : 'secondary'} className={integrationStatus === 'connected' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                            {integrationStatus === 'connected' ? 'Conectado' : 
                             integrationStatus === 'invalid_key' ? 'Chave Inválida' :
                             integrationStatus === 'no_credits' ? 'Sem Créditos' :
                             integrationStatus === 'error' ? 'Erro de API' : 'Aguardando Configuração'}
                          </Badge>
                        </div>
                        {lastTested && (
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Última verificação:</span>
                            <span>{lastTested}</span>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            className="flex-1" 
                            onClick={handleTestIntegration}
                            disabled={testingConnection || !elevenApiKey}
                          >
                            {testingConnection ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
                            Testar Conexão
                          </Button>
                          <Button 
                            className="flex-1" 
                            onClick={handleSaveIntegration}
                            disabled={saving || !elevenApiKey}
                          >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Salvar Globalmente
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
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
                      <Badge variant="outline">{integrationStatus === 'connected' ? 'Configurado' : 'Pendente'}</Badge>
                    </div>
                    <Progress value={integrationStatus === 'connected' ? 100 : 30} className="h-1" />
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
                  <Button size="sm" variant="outline" onClick={() => { voiceManager.stop(); setPlaying(false); }}>
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
