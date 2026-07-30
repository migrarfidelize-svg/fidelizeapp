import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicMetaPixel, logPixelEvent } from "@/lib/integrations/marketing/pixel.functions";

/** Prefixos autenticados / sensíveis onde o Pixel NUNCA é carregado. */
const BLOCKED_PREFIXES = ["/app", "/carteira", "/hash", "/auth", "/onboarding", "/api"];

function isPublicPath(pathname: string) {
  return !BLOCKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Identificador anônimo de sessão (nenhum dado pessoal). */
function sessionHash() {
  if (typeof window === "undefined") return null;
  try {
    let id = sessionStorage.getItem("fx_px_sid");
    if (!id) {
      id = Math.random().toString(36).slice(2, 12);
      sessionStorage.setItem("fx_px_sid", id);
    }
    return id;
  } catch {
    return null;
  }
}

function deviceKind(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

/** Dispara um evento no Pixel (se carregado) e registra no monitoramento. */
export function trackPixelEvent(name: string, props?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  const w = window as any;
  try {
    w.fbq?.("track", name, props ?? {});
  } catch { /* pixel opcional */ }
  try {
    w.__fxLogPixel?.(name, props);
  } catch { /* telemetria best-effort */ }
}

/**
 * Carrega o Meta Pixel apenas em páginas públicas, e apenas quando o Super Admin
 * ativou a integração em /hash/integracoes → Marketing & Pixel.
 */
export function MetaPixel() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const publicPage = isPublicPath(pathname);
  const fetchPixel = useServerFn(getPublicMetaPixel);
  const logEvent = useServerFn(logPixelEvent);
  const loadedFor = useRef<string | null>(null);

  const { data } = useQuery({
    queryKey: ["meta-pixel-public"],
    queryFn: () => fetchPixel(),
    enabled: publicPage,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const pixelId = data?.pixelId ?? null;

  // Telemetria — registra o evento no painel de monitoramento.
  const log = useRef<(name: string, props?: Record<string, string | number | boolean>) => void>(() => {});
  log.current = (name, props) => {
    if (!pixelId) return;
    void logEvent({
      data: {
        event_name: name,
        pixel_id: pixelId,
        path: window.location.pathname,
        referrer: document.referrer || null,
        session_hash: sessionHash(),
        device: deviceKind(),
        props: props ?? {},
      },
    }).catch(() => {});
  };

  useEffect(() => {
    (window as any).__fxLogPixel = (n: string, p?: Record<string, string | number | boolean>) => log.current(n, p);
    return () => { delete (window as any).__fxLogPixel; };
  }, []);

  // Injeção do snippet (uma única vez por pixel).
  useEffect(() => {
    if (!publicPage || !pixelId || typeof window === "undefined") return;
    if (!/^\d{14,17}$/.test(pixelId)) return;
    if (loadedFor.current === pixelId) return;
    loadedFor.current = pixelId;

    const w = window as any;
    if (!w.fbq) {
      const n: any = (w.fbq = function (...args: unknown[]) {
        n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
      });
      if (!w._fbq) w._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }
    w.fbq("init", pixelId);
    w.fbq("track", "PageView");
    log.current("PageView");
  }, [publicPage, pixelId]);

  // PageView a cada navegação client-side dentro da área pública.
  useEffect(() => {
    if (!publicPage || !pixelId) return;
    const w = window as any;
    if (loadedFor.current !== pixelId || !w.fbq) return;
    w.fbq("track", "PageView");
    log.current("PageView");
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
