// Preferências da voz de boas-vindas (por dispositivo/escopo).
// Escopo: "merchant" (lojista) ou "admin" (super admin).

export const VOICE_OPTIONS = [
  { id: "nova", label: "Nova", hint: "Feminina, suave e acolhedora" },
  { id: "shimmer", label: "Shimmer", hint: "Feminina, clara e energética" },
  { id: "coral", label: "Coral", hint: "Feminina, calorosa e expressiva" },
  { id: "sage", label: "Sage", hint: "Feminina, madura e serena" },
  { id: "alloy", label: "Alloy", hint: "Neutra, equilibrada" },
  { id: "ash", label: "Ash", hint: "Masculina, grave e confiante" },
  { id: "onyx", label: "Onyx", hint: "Masculina, profunda e premium" },
  { id: "verse", label: "Verse", hint: "Masculina, natural e conversacional" },
] as const;

export type VoiceId = (typeof VOICE_OPTIONS)[number]["id"];

export type VoicePrefs = {
  enabled: boolean;
  voice: VoiceId;
  /** Texto personalizado. Vazio = saudação automática (hora + carisma). */
  text: string;
  /** Instruções de estilo enviadas ao motor de voz natural. */
  style: string;
};

export const DEFAULT_STYLE =
  "Fale em português brasileiro, tom natural e humano, acolhedor, ritmo calmo, com carisma e leve sorriso na voz.";

export function defaultVoicePrefs(scope: string): VoicePrefs {
  return {
    enabled: true,
    voice: scope === "admin" ? "onyx" : "nova",
    text: "",
    style: DEFAULT_STYLE,
  };
}

const key = (scope: string) => `fidelize:voice:prefs:${scope}`;

export function loadVoicePrefs(scope: string): VoicePrefs {
  const base = defaultVoicePrefs(scope);
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(key(scope));
    if (!raw) return base;
    return { ...base, ...(JSON.parse(raw) as Partial<VoicePrefs>) };
  } catch {
    return base;
  }
}

export function saveVoicePrefs(scope: string, prefs: VoicePrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(scope), JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent("fidelize:voice-prefs", { detail: { scope } }));
}
