import { useEffect, useRef } from "react";
import { synthesizeGreeting } from "@/lib/tts.functions";
import { loadVoicePrefs, type VoiceId, DEFAULT_STYLE } from "@/lib/voice-prefs";
import { useServerFn } from "@tanstack/react-start";
import { synthesizeElevenLabs } from "@/lib/elevenlabs.functions";

type Props = {
  /** "female" para painel do lojista, "male" para admin */
  gender: "female" | "male";
  /** Cache key: toca no máximo uma vez por hora/sessão */
  scope: string;
  /** Configuração da empresa (Aparência → voz de boas-vindas). Padrão: ligada. */
  enabled?: boolean;
};

/** Preferência local por dispositivo (silenciar só neste aparelho). */
export const GREETING_MUTE_KEY = "fidelize:greet:muted";
export function isGreetingMutedLocally() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(GREETING_MUTE_KEY) === "1";
}
export function setGreetingMutedLocally(muted: boolean) {
  if (typeof window === "undefined") return;
  if (muted) localStorage.setItem(GREETING_MUTE_KEY, "1");
  else localStorage.removeItem(GREETING_MUTE_KEY);
}

/** Gera saudação humanizada, variada e contextual (tempo + carisma). */
export function buildGreeting(gender: "female" | "male") {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  const period = h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";

  let timePhrase: string;
  if (h === 12) {
    timePhrase =
      m === 0 ? "agora é meio dia" : m === 30 ? "agora é meio dia e meia" : `agora é meio dia e ${m}`;
  } else if (h === 0) {
    timePhrase =
      m === 0 ? "agora é meia-noite" : m === 30 ? "agora é meia-noite e meia" : `agora é meia-noite e ${m}`;
  } else {
    const hourWord = h % 12 === 0 ? 12 : h % 12;
    const verb = hourWord === 1 ? "é" : "são";
    timePhrase =
      m === 0
        ? `agora ${verb} exatamente ${hourWord} ${hourWord === 1 ? "hora" : "horas"}`
        : m === 30
          ? `agora ${verb} exatamente ${hourWord} e meia`
          : `agora ${verb} exatamente ${hourWord} e ${m}`;
  }

  const closers =
    gender === "female"
      ? [
          "bora fazer dinheiro hoje, chefe.",
          "seus clientes já estão te esperando.",
          "vamos brilhar juntos, hein?",
          "hoje o dia é seu, chefe.",
        ]
      : [
          "vamos comandar o dia, chefe.",
          "hora de faturar alto, chefe.",
          "o mercado é seu hoje.",
          "bora dominar, chefe.",
        ];
  const closer = closers[Math.floor(Math.random() * closers.length)];
  return `${period}, chefe. ${timePhrase}, e ${closer}`;
}

/** Espera as vozes carregarem (Chrome carrega assíncrono). */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const cur = window.speechSynthesis.getVoices();
    if (cur.length) return resolve(cur);
    const timer = setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
    window.speechSynthesis.onvoiceschanged = () => {
      clearTimeout(timer);
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

const FEMALE_VOICES: VoiceId[] = ["nova", "shimmer", "coral", "sage"];

function pickBestVoice(voices: SpeechSynthesisVoice[], gender: "female" | "male") {
  const pt = voices.filter((v) => /^pt(-|_)?BR/i.test(v.lang) || v.lang.toLowerCase().startsWith("pt"));
  if (!pt.length) return null;

  const femaleNames = /(francisca|thalita|leticia|luciana|joana|helena|maria|ana|fernanda|female|mulher)/i;
  const maleNames = /(antonio|daniel|felipe|ricardo|bruno|thiago|male|homem)/i;
  const nameRe = gender === "female" ? femaleNames : maleNames;

  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    const n = v.name.toLowerCase();
    if (/natural|neural|online|studio|premium|enhanced/.test(n)) s += 100;
    if (n.includes("microsoft")) s += 40;
    if (n.includes("google")) s += 30;
    if (n.includes("apple") || /luciana|felipe|joana/.test(n)) s += 20;
    if (nameRe.test(v.name)) s += 50;
    if (/pt-br/i.test(v.lang)) s += 10;
    if (!v.localService) s += 5;
    return s;
  };

  return pt.slice().sort((a, b) => score(b) - score(a))[0];
}


let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking() {
  try {
    currentAudio?.pause();
    currentAudio = null;
  } catch {}
  try {
    window.speechSynthesis?.cancel();
  } catch {}
}

/**
 * Fala um texto usando a voz natural (TTS no servidor). Se indisponível,
 * cai para a voz nativa do navegador.
 * Retorna "natural" | "browser" | "failed".
 */
export async function speakText(opts: {
  text: string;
  voice: VoiceId;
  style?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}): Promise<"natural" | "browser" | "failed"> {
  const gender: "female" | "male" = FEMALE_VOICES.includes(opts.voice) ? "female" : "male";
  stopSpeaking();
  try {
    const res: any = await synthesizeGreeting({
      data: {
        text: opts.text.slice(0, 1000),
        voice: opts.voice,
        instructions: opts.style || DEFAULT_STYLE,
      },
    });
    if (res?.audio) {
      const audio = new Audio(`data:${res.mime ?? "audio/mpeg"};base64,${res.audio}`);
      currentAudio = audio;
      audio.volume = opts.volume ?? 1.0;
      await audio.play();
      return "natural";
    }
  } catch {
    // cai para o navegador
  }
  const ok = await speakWithBrowser(opts.text, gender, { rate: opts.rate, pitch: opts.pitch, volume: opts.volume });
  return ok ? "browser" : "failed";
}

export async function speakWithBrowser(text: string, gender: "female" | "male", params?: { rate?: number; pitch?: number; volume?: number }) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  try {
    window.speechSynthesis.cancel();
  } catch {}
  const voices = await loadVoices();
  const chosen = pickBestVoice(voices, gender);
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "pt-BR";
  utter.volume = params?.volume ?? 0.95;
  utter.rate = params?.rate ?? 0.98;
  utter.pitch = params?.pitch ?? (gender === "female" ? 1.08 : 0.9);
  if (chosen) utter.voice = chosen;

  let killer: ReturnType<typeof setInterval> | null = null;
  utter.onstart = () => {
    killer = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  };
  utter.onend = utter.onerror = () => {
    if (killer) clearInterval(killer);
  };
  window.speechSynthesis.speak(utter);
  return true;
}

export function GreetingVoice({ gender, scope, enabled = true }: Props) {
  const playedRef = useRef(false);
  const synthEleven = useServerFn(synthesizeElevenLabs);

  useEffect(() => {
    if (!enabled) return;
    if (playedRef.current) return;
    if (typeof window === "undefined") return;
    if (isGreetingMutedLocally()) return;

    const prefs = loadVoicePrefs(scope);
    if (!prefs.enabled) return;

    const key = `fidelize:greet:${scope}:${new Date().toDateString()}:${new Date().getHours()}`;
    if (sessionStorage.getItem(key)) return;
    playedRef.current = true;

    const text = prefs.text.trim() || buildGreeting(gender);

    let spoke = false;
    const attempt = async () => {
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
            spoke = true;
          }
        } else {
          const r = await speakText({ 
            text, 
            voice: prefs.voice, 
            style: prefs.style,
            rate: prefs.rate,
            pitch: prefs.pitch,
            volume: prefs.volume
          });
          if (r !== "failed") spoke = true;
        }
        if (spoke) sessionStorage.setItem(key, "1");
      } catch (err) {
        // Fallback para speakText se for elevenlabs e falhar
        if (prefs.provider === "elevenlabs") {
          const r = await speakText({ text, voice: prefs.voice });
          if (r !== "failed") {
            spoke = true;
            sessionStorage.setItem(key, "1");
          }
        }
      }
    };
    const armed = () => {
      if (!spoke) attempt();
      window.removeEventListener("pointerdown", armed);
      window.removeEventListener("keydown", armed);
    };
    const t = setTimeout(() => {
      attempt();
      window.addEventListener("pointerdown", armed, { once: true });
      window.addEventListener("keydown", armed, { once: true });
    }, 400);

    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", armed);
      window.removeEventListener("keydown", armed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, scope]);

  return null;
}
