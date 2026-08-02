/**
 * Configuração global da voz do painel (controlada apenas pelo Super Admin).
 * Browser-safe: só tipos, padrões e normalização.
 */
import { DEFAULT_STYLE, defaultVoicePrefs, type VoicePrefs } from "@/lib/voice-prefs";

export type VoiceSettings = {
  merchant: VoicePrefs;
  admin: VoicePrefs;
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  merchant: defaultVoicePrefs("merchant"),
  admin: defaultVoicePrefs("admin"),
};

function normalizeOne(raw: unknown, scope: "merchant" | "admin"): VoicePrefs {
  const base = defaultVoicePrefs(scope);
  const d = (raw ?? {}) as Partial<VoicePrefs>;
  return {
    enabled: typeof d.enabled === "boolean" ? d.enabled : base.enabled,
    voice: (typeof d.voice === "string" ? d.voice : base.voice) as VoicePrefs["voice"],
    text: typeof d.text === "string" ? d.text.slice(0, 400) : "",
    style: (typeof d.style === "string" && d.style.trim() ? d.style : DEFAULT_STYLE).slice(0, 600),
  };
}

export function normalizeVoiceSettings(raw: unknown): VoiceSettings {
  const d = (raw ?? {}) as Partial<VoiceSettings>;
  return {
    merchant: normalizeOne(d.merchant, "merchant"),
    admin: normalizeOne(d.admin, "admin"),
  };
}
