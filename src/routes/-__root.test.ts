import { describe, it, expect } from 'vitest';
import { Route } from './__root';
import { getSeoMetadata } from '@/lib/seo-utils.server';

describe('Root Route (SEO & Style Regression)', () => {
  it('should always include the global stylesheet in head links', async () => {
    const mockSeoData = await getSeoMetadata('/');
    const head = Route.options.head!({ 
      loaderData: mockSeoData,
      params: {},
      location: {} as any,
      match: {} as any,
      matches: [],
      matchRoute: {} as any,
      staticData: {},
      search: {}
    } as any);

    const links = head.links || [];
    const appCssLink = links.find(l => l.rel === 'stylesheet' && l.href?.includes('styles.css'));
    
    expect(appCssLink).toBeDefined();
    expect(appCssLink?.rel).toBe('stylesheet');
  });

  it('should deduplicate metadata links correctly', async () => {
    const mockSeoData = await getSeoMetadata('/');
    const head = Route.options.head!({ 
      loaderData: mockSeoData,
      params: {},
      location: {} as any,
      match: {} as any,
      matches: [],
      matchRoute: {} as any,
      staticData: {},
      search: {}
    } as any);

    const links = head.links || [];
    
    // Check for unique critical links
    const canonicals = links.filter(l => l.rel === 'canonical');
    const icons = links.filter(l => l.rel === 'icon');
    const manifests = links.filter(l => l.rel === 'manifest');
    const appleIcons = links.filter(l => l.rel === 'apple-touch-icon');

    expect(canonicals.length).toBe(1);
    expect(icons.length).toBe(1);
    expect(manifests.length).toBe(1);
    expect(appleIcons.length).toBeLessThanOrEqual(1);
  });

  it('should include noindex for sensitive routes (/app, /hash)', async () => {
    const appSeo = await getSeoMetadata('/app');
    const hashSeo = await getSeoMetadata('/hash/users');
    const clientsSeo = await getSeoMetadata('/app/clientes');

    const appRobots = appSeo.meta.find(m => (m as any).name === 'robots');
    const hashRobots = hashSeo.meta.find(m => (m as any).name === 'robots');
    const clientsRobots = clientsSeo.meta.find(m => (m as any).name === 'robots');

    expect(appRobots?.content).toContain('noindex');
    expect(hashRobots?.content).toContain('noindex');
    expect(clientsRobots?.content).toContain('noindex');
  });

  it('should resolve wildcard routes correctly', async () => {
    const cardapioSeo = await getSeoMetadata('/cardapio/test-slug');
    const catalogSeo = await getSeoMetadata('/catalogo/test-slug');
    
    expect(cardapioSeo.title).toBeDefined();
    expect(catalogSeo.title).toBeDefined();
  });
});