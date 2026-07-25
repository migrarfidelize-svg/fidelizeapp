import { logAppEngagement } from "@/lib/engagement.functions";

export type EngagementAudience = "merchant" | "customer";
export type EngagementEvent =
  | "install_prompt_shown"
  | "install_accepted"
  | "install_dismissed"
  | "install_manual_guide"
  | "push_enabled"
  | "push_denied"
  | "push_blocked"
  | "push_dismissed"
  | "push_disabled"
  | "push_failed";

function platformName(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/Android/.test(ua)) return "android";
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Macintosh/.test(ua)) return "macos";
  if (/Windows/.test(ua)) return "windows";
  if (/Linux/.test(ua)) return "linux";
  return "unknown";
}

function browserName(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/EdgA?\//.test(ua)) return "edge";
  if (/OPR\//.test(ua)) return "opera";
  if (/SamsungBrowser/.test(ua)) return "samsung";
  if (/FxiOS|Firefox\//.test(ua)) return "firefox";
  if (/CriOS/.test(ua)) return "chrome-ios";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "outro";
}

function standalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Fire-and-forget: nunca bloqueia nem quebra o fluxo de instalação/push.
 */
export function trackEngagement(
  audience: EngagementAudience,
  event: EngagementEvent,
  meta?: Record<string, string | number | boolean | null>,
): void {
  if (typeof window === "undefined") return;
  try {
    void logAppEngagement({
      data: {
        audience,
        event_type: event,
        platform: platformName(),
        browser: browserName(),
        standalone: standalone(),
        ua: navigator.userAgent.slice(0, 300),
        ...(meta ? { meta } : {}),
      },
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
