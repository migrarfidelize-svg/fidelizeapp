import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

/**
 * Rede de segurança contra "tela travada" no mobile.
 *
 * Modais (Radix Dialog/Sheet/Drawer) bloqueiam o scroll e o toque do body
 * enquanto estão abertos. Se um deles for desmontado durante uma troca de
 * rota (muito comum ao navegar pelo menu lateral no celular), o cleanup não
 * roda e o body fica com `pointer-events: none` / `overflow: hidden` para
 * sempre — a página fica visível, mas nada responde ao dedo.
 *
 * Este guardião verifica se ainda existe algum overlay realmente aberto.
 * Se não existir, remove qualquer bloqueio residual.
 */
function hasOpenOverlay(): boolean {
  return !!document.querySelector(
    '[data-radix-popper-content-wrapper], [data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"], [data-vaul-drawer][data-state="open"], [data-radix-focus-guard] ~ [data-state="open"]',
  );
}

function releaseIfStale() {
  if (hasOpenOverlay()) return;
  const body = document.body;
  const html = document.documentElement;
  for (const el of [body, html]) {
    if (el.style.pointerEvents === "none") el.style.pointerEvents = "";
    if (el.style.overflow === "hidden" || el.style.overflowY === "hidden") {
      el.style.overflow = "";
      el.style.overflowY = "";
    }
    if (el.style.position === "fixed") {
      el.style.position = "";
      el.style.top = "";
      el.style.left = "";
      el.style.right = "";
      el.style.width = "";
    }
    if (el.style.touchAction === "none") el.style.touchAction = "";
  }
  if (body.hasAttribute("data-scroll-locked")) body.removeAttribute("data-scroll-locked");
}

export function ScrollLockGuard() {
  const router = useRouter();

  useEffect(() => {
    // Depois de cada navegação resolvida (e um tick para os portais fecharem).
    const unsub = router.subscribe("onResolved", () => {
      setTimeout(releaseIfStale, 150);
      setTimeout(releaseIfStale, 600);
    });

    // Observa mudanças de style/atributo no body causadas por modais.
    const obs = new MutationObserver(() => {
      window.setTimeout(releaseIfStale, 120);
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ["style", "data-scroll-locked"] });

    releaseIfStale();
    return () => {
      unsub();
      obs.disconnect();
    };
  }, [router]);

  return null;
}
