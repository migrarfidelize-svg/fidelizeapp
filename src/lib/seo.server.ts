import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SeoConfig = {
  platformName: string;
  defaultTitle: string;
  defaultDescription: string;
  shortName: string;
  siteUrl: string;
  faviconUrl: string;
  logoUrl: string;
  socialImageUrl: string;
  appleTouchIconUrl?: string;
  themeColor: string;
  backgroundColor?: string;
  pwaIcon192Url?: string;
  pwaIcon512Url?: string;
  routes: Record<string, {
    title?: string;
    description?: string;
    noindex?: boolean;
    canonical?: string;
  }>;
};

const DEFAULT_SEO: SeoConfig = {
  platformName: "Afidelize",
  defaultTitle: "Afidelize — Fidelidade que conecta negócios e clientes",
  defaultDescription: "Crie seu cartão fidelidade digital, compartilhe por QR Code e faça seus clientes voltarem mais vezes.",
  shortName: "Afidelize",
  siteUrl: "https://afidelize.app",
  faviconUrl: "/favicon.ico",
  logoUrl: "/favicon-mark.svg",
  socialImageUrl: "https://i.imgur.com/PHNbTAi.png",
  themeColor: "#ffffff",
  backgroundColor: "#ffffff",
  pwaIcon192Url: "/icon-192.png",
  pwaIcon512Url: "/icon-512.png",
  routes: {
    "/": {
      title: "Afidelize — Cartão fidelidade digital para clientes fiéis",
      description: "Transforme visitantes em clientes fiéis. Sem app, sem cartão de papel.",
    },
    "/auth": {
      title: "Entrar — Afidelize",
      noindex: true,
    },
    "/app": {
      noindex: true,
    },
    "/hash": {
      noindex: true,
    },
    "/carteira": {
      title: "Minha Carteira — Afidelize",
      noindex: true,
    }
  }
};

export async function getSeoConfig(): Promise<SeoConfig> {
  try {
    if (!supabaseAdmin) return DEFAULT_SEO;
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("namespace", "seo")
      .eq("key", "config")
      .maybeSingle();

    if (error || !data?.value) {
      return DEFAULT_SEO;
    }

    // Merge with defaults to ensure all fields exist
    return {
      ...DEFAULT_SEO,
      ...(data.value as Partial<SeoConfig>),
      routes: {
        ...DEFAULT_SEO.routes,
        ...((data.value as any).routes || {}),
      }
    };
  } catch (e) {
    console.error("[getSeoConfig] Error:", e);
    return DEFAULT_SEO;
  }
}
