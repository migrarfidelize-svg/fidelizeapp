import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Route } from './__root';
import { getSeoMetadata } from '@/lib/seo-utils.server';
import { getSeoConfig } from '@/lib/seo.server';

// Mock appCss since it's a Vite-specific import
vi.mock('../styles.css?url', () => ({
  default: '/src/styles.css'
}));

// Mock Supabase Admin to avoid environment variable errors during tests
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { value: {} }, error: null })
          })
        })
      })
    })
  }
}));

describe('SEO Engine & Global CSS logic', () => {
  it('should always include the global stylesheet in head links', async () => {
    const mockSeoData = await getSeoMetadata('/');
    const headResult = Route.options.head!({ 
      loaderData: mockSeoData,
      params: {},
      location: {} as any,
      match: {} as any,
      matches: [],
      matchRoute: {} as any,
      staticData: {},
      search: {}
    } as any);

    const head = headResult instanceof Promise ? await headResult : headResult;
    const links = head.links || [];
    const appCssLink = links.find((l: any) => l.rel === 'stylesheet' && l.href?.includes('styles.css'));
    
    expect(appCssLink).toBeDefined();
    expect(appCssLink?.rel).toBe('stylesheet');
    expect(appCssLink?.href).toBe('/src/styles.css');
  });

  it('should resolve wildcard routes correctly (e.g. /cardapio/*)', async () => {
    // Mock getSeoConfig to return a config with wildcards
    vi.mocked(getSeoConfig).mockResolvedValueOnce({
      platformName: "Test",
      defaultTitle: "Default",
      defaultDescription: "Desc",
      shortName: "T",
      siteUrl: "https://test.com",
      faviconUrl: "/favicon.ico",
      logoUrl: "/logo.svg",
      socialImageUrl: "/og.png",
      themeColor: "#000000",
      routes: {
        "/cardapio/*": { title: "Cardapio Template" }
      }
    });

    const metadata = await getSeoMetadata('/cardapio/my-store');
    expect(metadata.title).toBe("Cardapio Template");
  });

  it('should prioritize exact match over wildcard', async () => {
    vi.mocked(getSeoConfig).mockResolvedValueOnce({
      platformName: "Test",
      defaultTitle: "Default",
      defaultDescription: "Desc",
      shortName: "T",
      siteUrl: "https://test.com",
      faviconUrl: "/favicon.ico",
      logoUrl: "/logo.svg",
      socialImageUrl: "/og.png",
      themeColor: "#000000",
      routes: {
        "/cardapio/*": { title: "Wildcard" },
        "/cardapio/special": { title: "Exact" }
      }
    });

    const metadata = await getSeoMetadata('/cardapio/special');
    expect(metadata.title).toBe("Exact");
  });

  it('should include noindex for sensitive prefixes (/app, /hash)', async () => {
    const appSeo = await getSeoMetadata('/app/dashboard');
    const hashSeo = await getSeoMetadata('/hash/seo');

    const appRobots = appSeo.meta.find((m: any) => m.name === 'robots');
    const hashRobots = hashSeo.meta.find((m: any) => m.name === 'robots');

    expect(appRobots?.content).toBe('noindex, nofollow');
    expect(hashRobots?.content).toBe('noindex, nofollow');
  });
});