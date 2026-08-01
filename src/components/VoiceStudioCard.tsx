import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AudioLines, Play, Square, Save, Sparkles } from "lucide-react";
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

type Props = {
  /** "merchant" (lojista) ou "admin" (super admin) */
  scope: "merchant" | "admin";
};

export function VoiceStudioCard({ scope }: Props) {
  const [prefs, setPrefs] = useState<VoicePrefs>(() => defaultVoicePrefs(scope));
  const [playing, setPlaying] = useState(false);
  const gender: "female" | "male" = scope === "admin" ? "male" : "female";

  useEffect(() => {
    setPrefs(loadVoicePrefs(scope));
  }, [scope]);

  const update = (patch: Partial<VoicePrefs>) => setPrefs((p) => ({ ...p, ...patch }));

  const preview = async () => {
    const text = (prefs.text.trim() || buildGreeting(gender)).slice(0, 400);
    setPlaying(true);
    const result = await speakText({ text, voice: prefs.voice, style: prefs.style });
    setPlaying(false);
    if (result === "failed") toast.error("Não foi possível reproduzir a voz neste dispositivo.");
    else if (result === "browser") toast.info("Voz natural indisponível — usando a voz do navegador.");
  };

  const save = () => {
    saveVoicePrefs(scope, prefs);
    toast.success("Preferências de voz salvas.");
  };

  return (
    <Card className="card-icon overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <AudioLines className="h-5 w-5 text-primary" />
          Voz do painel
        </CardTitle>
        <div className="flex items-center gap-2">
          <Label htmlFor={`voice-on-${scope}`} className="text-xs text-muted-foreground">
            {prefs.enabled ? "Ativa" : "Silenciada"}
          </Label>
          <Switch
            id={`voice-on-${scope}`}
            checked={prefs.enabled}
            onCheckedChange={(v) => update({ enabled: v })}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Escolha a voz, escreva o que ela deve falar ao abrir o painel e ouça antes de salvar.
        </p>

        <div className="space-y-2">
          <Label>Voz</Label>
          <Select value={prefs.voice} onValueChange={(v) => update({ voice: v as VoiceId })}>
            <SelectTrigger>
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
            onChange={(e) => update({ text: e.target.value })}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{prefs.text.length}/400</span>
            {!prefs.text.trim() && <span>Usando saudação automática</span>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`voice-style-${scope}`} className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Estilo da narração
          </Label>
          <Textarea
            id={`voice-style-${scope}`}
            rows={2}
            maxLength={600}
            placeholder="Ex.: tom animado e rápido, como um locutor de rádio."
            value={prefs.style}
            onChange={(e) => update({ style: e.target.value })}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={preview} disabled={playing}>
            <Play className="mr-2 h-4 w-4" />
            {playing ? "Reproduzindo…" : "Ouvir prévia"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              stopSpeaking();
              setPlaying(false);
            }}
          >
            <Square className="mr-2 h-4 w-4" />
            Parar
          </Button>
          <Button type="button" onClick={save}>
            <Save className="mr-2 h-4 w-4" />
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
