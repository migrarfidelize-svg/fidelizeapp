import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { synthesizeGreeting } from "@/lib/tts.functions";

type Props = {
  /** "female" for merchant panel, "male" for admin */
  gender: "female" | "male";
  /** Cache key so we play at most once per session per panel */
  scope: string;
};

function buildGreeting(gender: "female" | "male") {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  const period = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";

  const hourWord = h % 12 === 0 ? 12 : h % 12;
  const timePhrase =
    m === 0
      ? `agora são ${hourWord} horas em ponto`
      : `agora são ${hourWord} e ${m.toString().padStart(2, "0")}`;

  const closers =
    gender === "female"
      ? [
          "vamos faturar, chefe.",
          "bora fazer dinheiro hoje, chefe.",
          "seus clientes já estão te esperando.",
        ]
      : [
          "vamos comandar o dia, chefe.",
          "hora de faturar alto, chefe.",
          "o mercado é seu hoje, chefe.",
        ];
  const closer = closers[Math.floor(Math.random() * closers.length)];

  return `${period}, chefe. ${timePhrase}, e ${closer}`;
}

export function GreetingVoice({ gender, scope }: Props) {
  const speak = useServerFn(synthesizeGreeting);
  const playedRef = useRef(false);

  useEffect(() => {
    if (playedRef.current) return;
    const key = `fidelize:greet:${scope}:${new Date().toDateString()}:${new Date().getHours()}`;
    if (sessionStorage.getItem(key)) return;
    playedRef.current = true;

    const voice = gender === "female" ? "nova" : "onyx";
    const instructions =
      gender === "female"
        ? "Fale em português brasileiro com voz feminina, tom suave, charmoso, sensual e acolhedor. Ritmo calmo, íntimo, quase sussurrado, com bastante carisma e leveza."
        : "Fale em português brasileiro com voz masculina, tom firme mas suave, elegante e confiante. Ritmo calmo, grave, com presença e sofisticação.";

    const text = buildGreeting(gender);

    (async () => {
      try {
        const res = await speak({ data: { text, voice, instructions } });
        const audio = new Audio(`data:${res.mime};base64,${res.audio}`);
        audio.volume = 0.9;
        await audio.play().catch(() => {
          // autoplay blocked — play on next user interaction
          const resume = () => {
            audio.play().catch(() => {});
            window.removeEventListener("pointerdown", resume);
            window.removeEventListener("keydown", resume);
          };
          window.addEventListener("pointerdown", resume, { once: true });
          window.addEventListener("keydown", resume, { once: true });
        });
        sessionStorage.setItem(key, "1");
      } catch {
        /* silent */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
