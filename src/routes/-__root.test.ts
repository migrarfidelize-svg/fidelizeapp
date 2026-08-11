import { describe, it, expect, vi } from 'vitest';
import { Route } from './__root';
import { getSeoMetadata } from '@/lib/seo-utils.server';
import { getSeoConfig } from '@/lib/seo.server';

// Mock appCss since it's a Vite-specific import
vi.mock('../styles.css?url', () => ({
  default: '/src/styles.css'
}));

// Mock the SEO server module
vi.mock('@/lib/seo.server', () => ({
  getSeoConfig: vi.fn(),
}));

// Mock Supabase Admin
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

// Mock Auth Middleware
vi.mock('@/integrations/supabase/auth-middleware', () => ({
  requireSupabaseAuth: (fn: any) => fn
}));

// Mock Admin Functions
vi.mock('./admin.functions', () => ({
  assertSuperAdmin: vi.fn().mockResolvedValue(true)
}));

const mockConfigBase = {
  platformName: "Test",
  defaultTitle: "Default",
  defaultDescription: "Desc",
  shortName: "T",
  siteUrl: "https://test.com",
  faviconUrl: "/favicon.ico",
  logoUrl: "/logo.svg",
  socialImageUrl: "/og.png",
  themeColor: "#000000",
  routes: {}
};

describe('SEO Engine & Security', () => {
  it('should always include the global stylesheet in head links', async () => {
    vi.mocked(getSeoConfig).mockResolvedValue(mockConfigBase as any);

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
    vi.mocked(getSeoConfig).mockResolvedValue({
      ...mockConfigBase,
      routes: {
        "/cardapio/*": { title: "Cardapio Template" }
      }
    } as any);

    const metadata = await getSeoMetadata('/cardapio/my-store');
    expect(metadata.title).toBe("Cardapio Template");
  });

  it('should include noindex for sensitive prefixes (/app, /hash, /carteira)', async () => {
    vi.mocked(getSeoConfig).mockResolvedValue(mockConfigBase as any);

    for (const path of ['/app', '/app/dashboard', '/hash', '/hash/seo', '/carteira', '/carteira/card']) {
      const seo = await getSeoMetadata(path);
      const robots = seo.meta.find((m: any) => m.name === 'robots');
      expect(robots?.content).toContain('noindex');
      expect(robots?.content).toContain('noarchive');
    }
  });

  it('should verify security in saveSeoConfig', async () => {
    const { saveSeoConfig } = await import('@/lib/seo.functions');
    const { assertSuperAdmin } = await import('@/lib/admin.functions');
    
    // Simulate lojista trying to save
    vi.mocked(assertSuperAdmin).mockRejectedValueOnce(new Error("Unauthorized"));
    
    await expect(saveSeoConfig({ 
      data: { ...mockConfigBase, siteUrl: "https://test.com" } 
    })).rejects.toThrow("Unauthorized");
  });
});