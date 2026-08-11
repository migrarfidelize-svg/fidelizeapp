import { describe, it, expect, vi } from 'vitest';
import { Route } from './__root';

// Mock appCss since it's a Vite-specific import
vi.mock('../styles.css?url', () => ({
  default: '/src/styles.css'
}));

describe('Root Route (SEO & Style Regression)', () => {
  it('should always include the global stylesheet in head links', async () => {
    const mockSeoData = {
      title: 'Test Title',
      meta: [],
      links: [
        { rel: 'canonical', href: 'https://example.com' },
        { rel: 'icon', href: '/favicon.ico' }
      ]
    };

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

  it('should deduplicate metadata links correctly', async () => {
    const mockSeoData = {
      title: 'Test Title',
      meta: [],
      links: [
        { rel: 'canonical', href: 'https://example.com' },
        { rel: 'icon', href: '/favicon.ico' },
        { rel: 'manifest', href: '/manifest.json' },
        { rel: 'apple-touch-icon', href: '/apple.png' },
        // Simulate a duplicate stylesheet coming from SEO (though it shouldn't)
        { rel: 'stylesheet', href: '/src/styles.css' }
      ]
    };

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
    
    // Check for unique critical links
    const stylesheets = links.filter((l: any) => l.rel === 'stylesheet' && l.href?.includes('styles.css'));
    const canonicals = links.filter((l: any) => l.rel === 'canonical');
    const icons = links.filter((l: any) => l.rel === 'icon');
    const manifests = links.filter((l: any) => l.rel === 'manifest');
    const appleIcons = links.filter((l: any) => l.rel === 'apple-touch-icon');

    expect(stylesheets.length).toBe(1);
    expect(canonicals.length).toBe(1);
    expect(icons.length).toBe(1);
    expect(manifests.length).toBe(1);
    expect(appleIcons.length).toBe(1);
  });
});