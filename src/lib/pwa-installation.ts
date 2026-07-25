/**
 * Módulo central de detecção e instalação da PWA.
 * Preserva o registro do Service Worker existente (src/lib/pwa-register.ts)
 * e não altera VAPID, subscriptions ou backend de push.
 */
import { useCallback, useEffect, useState } from "react";

export type PWAPlatform =
  | "android"
  | "ios"
  | "windows"
  | "macos"
  | "linux"
  | "unknown";

export type PWAState = {
  platform: PWAPlatform;
  browser: string;
  isMobile: boolean;
  isDesktop: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isInAppBrowser: boolean;
  isStandalone: boolean;
  isInstalled: boolean;
  canUseBeforeInstallPrompt: boolean;
  supportsServiceWorker: boolean;
  supportsNotifications: boolean;
  supportsPushManager: boolean;
  notificationPermission: NotificationPermission | "unsupported";
  hostname: string;
  isHTTPS: boolean;
  /** motivo curto se instalação/push não estiverem disponíveis */
  reason: string | null;
};

// ------- utils ---------------------------------------------------------------
function ua(): string {
  return typeof navigator !== "undefined" ? navigator.userAgent : "";
}

function detectBrowser(): string {
  const u = ua();
  if (/EdgA?\//.test(u)) return "Edge";
  if (/OPR\//.test(u)) return "Opera";
  if (/SamsungBrowser/.test(u)) return "Samsung Internet";
  if (/FxiOS|Firefox\//.test(u)) return "Firefox";
  if (/CriOS/.test(u)) return "Chrome iOS";
  if (/Chrome\//.test(u)) return "Chrome";
  if (/Safari\//.test(u)) return "Safari";
  return "Outro";
}

function detectPlatform(): PWAPlatform {
  const u = ua();
  if (/Android/.test(u)) return "android";
  if (/iPhone|iPad|iPod/.test(u)) return "ios";
  if (
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { platform?: string }).platform === "MacIntel" &&
    (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints &&
    (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1
  ) {
    return "ios"; // iPadOS
  }
  if (/Windows/.test(u)) return "windows";
  if (/Mac OS X/.test(u)) return "macos";
  if (/Linux/.test(u)) return "linux";
  return "unknown";
}

function detectInAppBrowser(): boolean {
  const u = ua();
  return /(FBAN|FBAV|Instagram|Line|MicroMessenger|WhatsApp|Snapchat|TikTok|LinkedInApp)/i.test(u);
}

export function isStandaloneNow(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
    if (window.matchMedia?.("(display-mode: fullscreen)").matches) return true;
    if (window.matchMedia?.("(display-mode: minimal-ui)").matches) return true;
  } catch {
    /* noop */
  }
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  try {
    if (new URLSearchParams(window.location.search).get("source") === "pwa") return true;
  } catch {
    /* noop */
  }
  return false;
}

// ------- detectPWAState -----------------------------------------------------
export function detectPWAState(): PWAState {
  if (typeof window === "undefined") {
    return {
      platform: "unknown",
      browser: "server",
      isMobile: false,
      isDesktop: false,
      isIOS: false,
      isAndroid: false,
      isInAppBrowser: false,
      isStandalone: false,
      isInstalled: false,
      canUseBeforeInstallPrompt: false,
      supportsServiceWorker: false,
      supportsNotifications: false,
      supportsPushManager: false,
      notificationPermission: "unsupported",
      hostname: "",
      isHTTPS: false,
      reason: "ssr",
    };
  }

  const platform = detectPlatform();
  const browser = detectBrowser();
  const isIOS = platform === "ios";
  const isAndroid = platform === "android";
  const isMobile = isIOS || isAndroid;
  const isDesktop = !isMobile;
  const isInAppBrowser = detectInAppBrowser();
  const standalone = isStandaloneNow();

  const supportsServiceWorker = "serviceWorker" in navigator;
  const supportsPushManager = typeof window !== "undefined" && "PushManager" in window;
  const supportsNotifications = "Notification" in window;

  // beforeinstallprompt existe em Chromium (Android e Desktop). NUNCA no Safari/iOS.
  const canUseBeforeInstallPrompt =
    !isIOS && /Chrome|Edg|OPR|Samsung/.test(browser + " " + ua()) && !isInAppBrowser;

  const notificationPermission: NotificationPermission | "unsupported" =
    supportsNotifications ? Notification.permission : "unsupported";

  const hostname = window.location.hostname;
  const isHTTPS = window.location.protocol === "https:" || hostname === "localhost";

  let reason: string | null = null;
  if (!supportsServiceWorker) reason = "sem-service-worker";
  else if (!isHTTPS) reason = "sem-https";
  else if (isInAppBrowser) reason = "navegador-embutido";
  else if (isIOS && !standalone) reason = "ios-precisa-instalar";
  else if (!standalone && !canUseBeforeInstallPrompt) reason = "instalacao-manual";

  return {
    platform,
    browser,
    isMobile,
    isDesktop,
    isIOS,
    isAndroid,
    isInAppBrowser,
    isStandalone: standalone,
    isInstalled: standalone,
    canUseBeforeInstallPrompt,
    supportsServiceWorker,
    supportsNotifications,
    supportsPushManager,
    notificationPermission,
    hostname,
    isHTTPS,
    reason,
  };
}

// ------- beforeinstallprompt capture ---------------------------------------
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let cachedPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(e: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    cachedPrompt = event as BeforeInstallPromptEvent;
    promptListeners.forEach((l) => l(cachedPrompt));
  });
  window.addEventListener("appinstalled", () => {
    cachedPrompt = null;
    promptListeners.forEach((l) => l(null));
  });
}

// ------- hook ---------------------------------------------------------------
export function usePWAInstall() {
  const [state, setState] = useState<PWAState>(() => detectPWAState());
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => cachedPrompt,
  );

  const refreshState = useCallback(() => {
    setState(detectPWAState());
    setDeferredPrompt(cachedPrompt);
  }, []);

  useEffect(() => {
    const listener = (e: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(e);
      setState(detectPWAState());
    };
    promptListeners.add(listener);

    // watch display-mode changes
    const mm = window.matchMedia?.("(display-mode: standalone)");
    const onChange = () => setState(detectPWAState());
    mm?.addEventListener?.("change", onChange);

    // watch appinstalled
    const onInstalled = () => setState(detectPWAState());
    window.addEventListener("appinstalled", onInstalled);

    // watch visibility to refresh permission after user goes to settings
    const onVis = () => {
      if (document.visibilityState === "visible") setState(detectPWAState());
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      promptListeners.delete(listener);
      mm?.removeEventListener?.("change", onChange);
      window.removeEventListener("appinstalled", onInstalled);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const installApp = useCallback(async (): Promise<
    { outcome: "accepted" | "dismissed" | "unavailable" }
  > => {
    if (!deferredPrompt) return { outcome: "unavailable" };
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      cachedPrompt = null;
      setDeferredPrompt(null);
      promptListeners.forEach((l) => l(null));
      return { outcome: choice.outcome };
    } catch {
      return { outcome: "unavailable" };
    }
  }, [deferredPrompt]);

  return {
    state,
    deferredPrompt,
    canInstall: !!deferredPrompt,
    installApp,
    refreshState,
  };
}
