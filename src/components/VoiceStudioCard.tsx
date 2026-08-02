import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudioLines, Play, Square, Save, Sparkles, Loader2, Store, Shield } from "lucide-react";
import { toast } from "sonner";
import { VOICE_OPTIONS, type VoicePrefs, type VoiceId, saveVoicePrefs } from "@/lib/voice-prefs";
import { DEFAULT_VOICE_SETTINGS, type VoiceSettings } from "@/lib/voice-settings";
import { getVoiceSettings, saveVoiceSettings } from "@/lib/landing-content.functions";
import { buildGreeting, speakText, stopSpeaking } from "@/components/GreetingVoice";

type Scope = "merchant" | "admin";

/** Studio de voz — controle global (Super Admin) da voz falada nos painéis. */
export function VoiceStudioCard(_props: { scope?: Scope }) {
  const qc = useQueryClient();
  const load = useServerFn(getVoiceSettings);
  const persist = useServerFn(saveVoiceSettings);
  const { data, isLoading } = useQuery({
    queryKey: ["voice-settings"],
    queryFn: () => load(),
    retry: false,
    staleTime: 60_000,
  });


  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState<Scope | null>(null);

  useEffect(() => {
    if (data) setSettings(data as VoiceSettings);
  }, [data]);

  const update = (scope: Scope, patch: Partial<VoicePrefs>) =>
    setSettings((s) => ({ ...s, [scope]: { ...s[scope], ...patch } }));

  const preview = async (scope: Scope) => {
    const p = settings[scope];
    const gender: "female" | "male" = scope === "admin" ? "male" : "female";
    const text = (p.text.trim() || buildGreeting(gender)).slice(0, 400);
    setPlaying(scope);
    const result = await speakText({ text, voice: p.voice, style: p.style });
    setPlaying(null);
    if (result === "failed") toast.error("Não foi possível reproduzir a voz neste dispositivo.");
    else if (result === "browser") toast.info("Voz natural indisponível — usando a voz do navegador.");
  };

  const save = async () => {
    setSaving(true);
    try {
      await persist({ data: { voice: settings } });
      saveVoicePrefs("merchant", settings.merchant);
      saveVoicePrefs("admin", settings.admin);
      qc.invalidateQueries({ queryKey: ["voice-settings"] });
      toast.success("Voz do painel salva para todos os usuários.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar a voz.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid h-40 place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="card-icon overflow-hidden">
      <CardHeader className="gap-1 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AudioLines className="h-5 w-5 shrink-0 text-primary" />
          Studio de voz do painel
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configuração global: define a voz, o texto e o estilo da narração que toca ao abrir o painel do lojista e o painel
          do Super Admin. O lojista não escolhe a voz.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs defaultValue="merchant">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="merchant" className="gap-1.5">
              <Store className="h-4 w-4" />
              <span className="truncate">Lojista</span>
            </TabsTrigger>
            <TabsTrigger value="admin" className="gap-1.5">
              <Shield className="h-4 w-4" />
              <span className="truncate">Super Admin</span>
            </TabsTrigger>
          </TabsList>

          {(["merchant", "admin"] as Scope[]).map((scope) => (
            <TabsContent key={scope} value={scope} className="mt-4">
              <VoiceForm
                scope={scope}
                prefs={settings[scope]}
                onChange={(patch) => update(scope, patch)}
                onPreview={() => preview(scope)}
                playing={playing === scope}
              />
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="w-full sm:w-auto" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar voz do painel
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={() => {
              stopSpeaking();
              setPlaying(null);
            }}
          >
            <Square className="mr-2 h-4 w-4" />
            Parar áudio
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function VoiceForm({
  scope,
  prefs,
  onChange,
  onPreview,
  playing,
}: {
  scope: Scope;
  prefs: VoicePrefs;
  onChange: (patch: Partial<VoicePrefs>) => void;
  onPreview: () => void;
  playing: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3">
        <div className="min-w-0">
          <Label htmlFor={`voice-on-${scope}`} className="text-sm font-semibold">
            Voz de boas-vindas
          </Label>
          <p className="text-xs text-muted-foreground">{prefs.enabled ? "Ativa neste painel" : "Silenciada"}</p>
        </div>
        <Switch
          id={`voice-on-${scope}`}
          checked={prefs.enabled}
          onCheckedChange={(v) => onChange({ enabled: v })}
        />
      </div>

      <div className="space-y-2">
        <Label>Voz</Label>
        <Select value={prefs.voice} onValueChange={(v) => onChange({ voice: v as VoiceId })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione a voz" />
          </SelectTrigger>
          <SelectContent>
            {VOICE_OPTIONS.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.label} — {v.hint}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`voice-text-${scope}`}>Mensagem falada</Label>
        <Textarea
          id={`voice-text-${scope}`}
          rows={3}
          maxLength={400}
          placeholder="Deixe vazio para a saudação automática (bom dia, horário e frase motivacional)."
          value={prefs.text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{prefs.text.length}/400</span>
          {!prefs.text.trim() && <span>Usando saudação automática</span>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`voice-style-${scope}`} className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
          Estilo da narração
        </Label>
        <Textarea
          id={`voice-style-${scope}`}
          rows={2}
          maxLength={600}
          placeholder="Ex.: tom animado e rápido, como um locutor de rádio."
          value={prefs.style}
          onChange={(e) => onChange({ style: e.target.value })}
        />
      </div>

      <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onPreview} disabled={playing}>
        <Play className="mr-2 h-4 w-4" />
        {playing ? "Reproduzindo…" : "Ouvir prévia"}
      </Button>
    </div>
  );
}
