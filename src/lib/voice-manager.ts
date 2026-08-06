import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { synthesizeElevenLabs, testElevenLabsConnection, getElevenLabsVoices } from "./elevenlabs.functions";
import { synthesizeGreeting } from "./tts.functions";
import { loadVoicePrefs, type VoicePrefs } from "./voice-prefs";

/**
 * VoiceManager: Serviço centralizado de voz para o Fidelize.
 * Gerencia reprodução, provedores, fallbacks e auditoria.
 */
class VoiceManager {
  private currentAudio: HTMLAudioElement | null = null;
  private isMuted: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.isMuted = localStorage.getItem("fidelize:voice:muted") === "1";
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

  async speak(text: string, prefs: VoicePrefs) {
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
    
    const utter = new SpeechSynthesisUtterance(text);
    utter.volume = prefs.volume;
    utter.rate = prefs.rate;
    utter.pitch = prefs.pitch;
    utter.lang = "pt-BR";
    
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
