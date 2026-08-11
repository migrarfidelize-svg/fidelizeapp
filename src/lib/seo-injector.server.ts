import { getSeoMetadata } from "./seo-utils.server";

export async function injectSeo(pathname: string) {
  const metadata = await getSeoMetadata(pathname);
  return {
    title: metadata.title,
    meta: metadata.meta,
    links: metadata.links
  };
}
