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
  private globalConfig: any = null;
  private speechGeneration = 0;

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
      this.globalConfig = config;
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

  private stopCurrentPlayback() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = "";
      } catch {}
      this.currentAudio = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  stop() {
    this.speechGeneration += 1;
    this.stopCurrentPlayback();
  }

  async speak(text: string, event?: string) {
    const prefs = loadVoicePrefs();
    if (!prefs.enabled || this.isMuted || !text) return;
    
    // Check global enable flag
    if (this.globalConfig && this.globalConfig.enabled === false) return;

    this.stop();

    try {
      if (prefs.provider === "elevenlabs" || (prefs.provider === "auto" && this.isElevenLabsGlobalActive)) {
        await this.playElevenLabs(text, prefs, event);
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

  async speakDashboard(event: string = "welcome") {
    const generation = ++this.speechGeneration;

    // O dashboard não usa mute/provider/textos do VoicePrefs.
    // Interrompe qualquer áudio ou speechSynthesis legado em execução.
    this.stopCurrentPlayback();

    try {
      const config: any = await getGlobalVoiceConfig();

      if (generation !== this.speechGeneration) return;

      this.globalConfig = config;
      this.isElevenLabsGlobalActive = !!config?.isConfigured;

      // enabled global do Studio é soberano.
      // getGlobalVoiceConfig retorna isConfigured=false
      // quando system_settings.enabled=false ou a integração não existe.
      if (!config?.isConfigured) {
        return;
      }

      const configuredText =
        typeof config?.texts?.[event] === "string"
          ? config.texts[event].trim()
          : "";

      // NÃO utilizar texto padrão/local caso o Studio não tenha esse evento.
      if (!configuredText) {
        console.warn(
          `Dashboard Voice: texto global "${event}" não configurado no Voice Studio.`
        );
        return;
      }

      const res: any = await synthesizeGlobalEleven({
        data: {
          text: configuredText,
          event,
        },
      });

      if (generation !== this.speechGeneration) return;

      if (!res?.audio) {
        console.error(
          "Dashboard Voice: ElevenLabs não retornou áudio."
        );
        return;
      }

      const audio = new Audio(
        `data:${res.mime || "audio/mpeg"};base64,${res.audio}`
      );

      if (generation !== this.speechGeneration) return;

      this.currentAudio = audio;

      // Não utilizar prefs.volume/localStorage no dashboard.
      audio.volume = 1;

      audio.onended = () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
      };

      audio.onerror = () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }

        console.error(
          "Dashboard Voice: erro ao reproduzir ElevenLabs."
        );
      };

      if (generation !== this.speechGeneration) return;

      await audio.play();

      if (generation !== this.speechGeneration) {
        try {
          audio.pause();
          audio.currentTime = 0;
          audio.src = "";
        } catch {}

        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
      }
    } catch (err) {
      if (generation !== this.speechGeneration) return;

      console.error(
        "Dashboard Voice: falha no ElevenLabs global.",
        err
      );

      // SEM FALLBACK.
      // NÃO chamar playNative.
      // NÃO chamar playNatural.
      // NÃO chamar synthesizeGreeting.
      // NÃO chamar synthesizeElevenLabs.
      // NÃO chamar speechSynthesis.
    }
  }

  private async playElevenLabs(text: string, prefs: VoicePrefs, event?: string) {
    try {
      // 1. Tentar síntese global (se configurada)
      if (this.isElevenLabsGlobalActive) {
        const res: any = await synthesizeGlobalEleven({
          data: { text, event }
        });
        if (res.audio) {
          await this.playBase64(res.audio, res.mime, prefs.volume);
          return;
        }
      }

      // 2. Fallback para síntese legada (individual) se a global não estiver disponível
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
