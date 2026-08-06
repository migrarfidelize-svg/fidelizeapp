import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { synthesizeElevenLabs, testElevenLabsConnection, getElevenLabsVoices } from "./elevenlabs.functions";
import { synthesizeGreeting } from "./tts.functions";
import { loadVoicePrefs, type VoicePrefs } from "./voice-prefs";
import { getGlobalVoiceConfig, synthesizeGlobalEleven } from "./voice-system.functions";

function loadNativeVoices(): Promise<SpeechSynthesisVoice[]> {
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

function pickBestNativeVoice(voices: SpeechSynthesisVoice[], providerVoice: string) {
  const pt = voices.filter((v) => /^pt(-|_)?BR/i.test(v.lang) || v.lang.toLowerCase().startsWith("pt"));
  if (!pt.length) return null;

  const isFemale = ["nova", "shimmer", "coral", "sage"].includes(providerVoice);
  const femaleNames = /(francisca|thalita|leticia|luciana|joana|helena|maria|ana|fernanda|female|mulher)/i;
  const maleNames = /(antonio|daniel|felipe|ricardo|bruno|thiago|male|homem)/i;
  const nameRe = isFemale ? femaleNames : maleNames;

  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    const n = v.name.toLowerCase();
    if (/natural|neural|online|studio|premium|enhanced/.test(n)) s += 100;
    if (n.includes("microsoft")) s += 40;
    if (n.includes("google")) s += 30;
    if (n.includes("apple") || /luciana|felipe|joana/.test(n)) s += 20;
    if (nameRe.test(v.name)) s += 50;
    if (/pt-br/i.test(v.lang)) s += 10;
    return s;
  };

  return pt.slice().sort((a, b) => score(b) - score(a))[0];
}

/**
 * VoiceManager: Serviço centralizado de voz para o Fidelize.
 * Gerencia reprodução, provedores, fallbacks e auditoria.
 */
class VoiceManager {
  private currentAudio: HTMLAudioElement | null = null;
  private isMuted: boolean = false;
  private isElevenLabsGlobalActive: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.isMuted = localStorage.getItem("fidelize:voice:muted") === "1";
      this.checkGlobalConfig();
    }
  }

  async checkGlobalConfig() {
    try {
      const config = await getGlobalVoiceConfig();
      this.isElevenLabsGlobalActive = config.isConfigured;
    } catch (e) {
      console.warn("Falha ao verificar config global de voz", e);
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== "undefined") {
      localStorage.setItem("fidelize:voice:muted", muted ? "1" : "0");
    }
    if (muted) this.stop();
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  async speak(text: string) {
    const prefs = loadVoicePrefs();
    if (!prefs.enabled || this.isMuted || !text) return;
    this.stop();

    try {
      if (prefs.provider === "elevenlabs") {
        await this.playElevenLabs(text, prefs);
        return;
      }
      
      if (prefs.provider === "native") {
        await this.playNative(text, prefs);
        return;
      }
      
      // Default: AI/Native fallback logic (auto)
      await this.playNatural(text, prefs);
    } catch (err) {
      console.error("VoiceManager Error:", err);
      if (prefs.fallback_enabled) {
        await this.playNative(text, prefs);
      }
    }
  }

  private async playElevenLabs(text: string, prefs: VoicePrefs) {
    try {
      // 1. Tentar síntese global (se configurada e no modo auto/elevenlabs)
      const globalConfig = await getGlobalVoiceConfig();
      
      if (globalConfig.isConfigured) {
        const res: any = await synthesizeGlobalEleven({
          data: { text }
        });
        if (res.audio) {
          await this.playBase64(res.audio, res.mime, prefs.volume);
          return;
        }
      }

      // 2. Fallback para síntese legada (individual) se a global não existir
      const res: any = await synthesizeElevenLabs({
        data: {
          text,
          voice_id: prefs.elevenVoiceId,
          model_id: prefs.elevenModelId,
          stability: prefs.stability,
          similarity_boost: prefs.similarity,
        }
      });
      if (res.audio) {
        await this.playBase64(res.audio, res.mime, prefs.volume);
      }
    } catch (err) {
      console.warn("ElevenLabs Error, falling back to next provider...", err);
      throw err;
    }
  }

  private async playNatural(text: string, prefs: VoicePrefs) {
    const res: any = await synthesizeGreeting({
      data: {
        text,
        voice: prefs.voice,
        instructions: prefs.style,
      }
    });
    if (res.audio) {
      await this.playBase64(res.audio, res.mime, prefs.volume);
    }
  }

  private async playNative(text: string, prefs: VoicePrefs) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    
    const voices = await loadNativeVoices();
    const chosen = pickBestNativeVoice(voices, prefs.voice);
    const utter = new SpeechSynthesisUtterance(text);
    utter.volume = prefs.volume;
    utter.rate = prefs.rate;
    utter.pitch = prefs.pitch;
    utter.lang = "pt-BR";
    if (chosen) utter.voice = chosen;
    
    window.speechSynthesis.speak(utter);
  }

  private playBase64(base64: string, mime: string, volume: number) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(`data:${mime};base64,${base64}`);
      this.currentAudio = audio;
      audio.volume = volume;
      audio.onended = resolve;
      audio.onerror = reject;
      audio.play().catch(reject);
    });
  }
}

export const voiceManager = new VoiceManager();
