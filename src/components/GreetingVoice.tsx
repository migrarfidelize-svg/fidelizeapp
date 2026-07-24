import { useEffect, useRef } from "react";

type Props = {
  /** "female" para painel do lojista, "male" para admin */
  gender: "female" | "male";
  /** Cache key: toca no máximo uma vez por hora/sessão */
  scope: string;
};

/** Gera saudação humanizada, variada e contextual (tempo + carisma). */
function buildGreeting(gender: "female" | "male") {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  const period = h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const hourWord = h % 12 === 0 ? 12 : h % 12;
  const timePhrase =
    m === 0
      ? `agora são ${hourWord} horas em ponto`
      : `agora são ${hourWord} e ${m.toString().padStart(2, "0")}`;

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

/**
 * Escolhe a MELHOR voz disponível no dispositivo — priorizando vozes
 * "neural"/"online"/"natural" que soam muito mais humanas.
 * Ranking (do melhor para o mais básico):
 *   1. Microsoft *Natural* / *Online* (Edge)      → altíssima qualidade
 *   2. Google português do Brasil                 → boa qualidade neural
 *   3. Luciana / Felipe / Joana (Apple)           → naturais no iOS/macOS
 *   4. Qualquer outra pt-BR                       → fallback
 */
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
    if (!v.localService) s += 5; // vozes cloud costumam ser melhores
    return s;
  };

  return pt.slice().sort((a, b) => score(b) - score(a))[0];
}

export function GreetingVoice({ gender, scope }: Props) {
  const playedRef = useRef(false);

  useEffect(() => {
    if (playedRef.current) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const key = `fidelize:greet:${scope}:${new Date().toDateString()}:${new Date().getHours()}`;
    if (sessionStorage.getItem(key)) return;
    playedRef.current = true;

    const text = buildGreeting(gender);

    const speakNow = async () => {
      // cancela qualquer fala anterior travada (bug do Chrome)
      try {
        window.speechSynthesis.cancel();
      } catch {}

      const voices = await loadVoices();
      const chosen = pickBestVoice(voices, gender);

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "pt-BR";
      utter.volume = 0.95;
      // Ajustes para soar mais humano/carismático — evita robô plano.
      utter.rate = 0.98;
      utter.pitch = gender === "female" ? 1.08 : 0.9;
      if (chosen) utter.voice = chosen;

      // Chrome bug: fala > 15s corta. Truque: replay a cada 10s.
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
      sessionStorage.setItem(key, "1");
    };

    // Alguns navegadores exigem gesto do usuário para tocar áudio.
    // Tenta imediatamente; se falhar, aguarda 1º clique/tecla.
    const attempt = () => {
      speakNow().catch(() => {});
    };
    const armed = () => {
      attempt();
      window.removeEventListener("pointerdown", armed);
      window.removeEventListener("keydown", armed);
    };
    // Pequeno delay para dar tempo do DOM montar
    const t = setTimeout(() => {
      // Se contexto já permitir, fala; caso contrário, arma listener.
      try {
        attempt();
      } catch {
        window.addEventListener("pointerdown", armed, { once: true });
        window.addEventListener("keydown", armed, { once: true });
      }
    }, 400);

    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", armed);
      window.removeEventListener("keydown", armed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
