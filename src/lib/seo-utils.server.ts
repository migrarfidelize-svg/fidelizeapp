import { getSeoConfig, type SeoConfig } from "./seo.server";

export async function getSeoMetadata(pathname: string) {
  const config = await getSeoConfig();
  
  // Find matching route or fallback to defaults
  const routeData = config.routes[pathname] || {};
  
  const title = routeData.title || config.defaultTitle;
  const description = routeData.description || config.defaultDescription;
  const noindex = routeData.noindex || pathname.startsWith("/app") || pathname.startsWith("/hash");
  const canonical = routeData.canonical || `${config.siteUrl}${pathname}`;
  
  return {
    title,
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: noindex ? "noindex, nofollow" : "index, follow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:image", content: config.socialImageUrl },
      { property: "og:url", content: canonical },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: config.platformName },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: config.socialImageUrl },
      { name: "theme-color", content: config.themeColor },
      { name: "apple-mobile-web-app-title", content: config.shortName },
    ],
    links: [
      { rel: "canonical", href: canonical },
      { rel: "icon", href: config.faviconUrl },
      { rel: "manifest", href: "/api/public/manifest" },
    ]
  };
}
