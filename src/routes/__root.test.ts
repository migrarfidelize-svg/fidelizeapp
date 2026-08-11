import { describe, it, expect } from 'vitest';
import { Route } from './__root';
import appCss from '../styles.css?url';

describe('Root Route SEO & Assets', () => {
  it('should include the mandatory global stylesheet', () => {
    const mockLoaderData = {
      title: 'Test',
      meta: [],
      links: []
    };
    
    const headResult = (Route.options.head as any)({ loaderData: mockLoaderData });
    
    const hasGlobalCss = headResult.links.some(
      (link: any) => link.rel === 'stylesheet' && link.href === appCss
    );
    
    expect(hasGlobalCss).toBe(true);
  });

  it('should include one canonical, one favicon, and one manifest from SEO data', () => {
    const seoLinks = [
      { rel: 'canonical', href: 'https://example.com' },
      { rel: 'icon', href: '/custom-favicon.ico' },
      { rel: 'manifest', href: '/api/public/manifest' }
    ];
    const mockLoaderData = {
      title: 'Test',
      meta: [],
      links: seoLinks
    };
    
    const headResult = (Route.options.head as any)({ loaderData: mockLoaderData });
    
    expect(headResult.links.filter((l: any) => l.rel === 'canonical')).toHaveLength(1);
    expect(headResult.links.filter((l: any) => l.rel === 'icon')).toHaveLength(1);
    expect(headResult.links.filter((l: any) => l.rel === 'manifest')).toHaveLength(1);
    expect(headResult.links.find((l: any) => l.rel === 'icon').href).toBe('/custom-favicon.ico');
  });

  it('should include at most one apple-touch-icon', () => {
    const seoLinks = [
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/custom-apple.png' }
    ];
    const mockLoaderData = {
      title: 'Test',
      meta: [],
      links: seoLinks
    };
    
    const headResult = (Route.options.head as any)({ loaderData: mockLoaderData });
    
    expect(headResult.links.filter((l: any) => l.rel === 'apple-touch-icon')).toHaveLength(1);
    expect(headResult.links.find((l: any) => l.rel === 'apple-touch-icon').href).toBe('/custom-apple.png');
  });

  it('should not duplicate the global stylesheet even if provided by SEO', () => {
    const mockLoaderData = {
      title: 'Test',
      meta: [],
      links: [{ rel: 'stylesheet', href: appCss }]
    };
    
    const headResult = (Route.options.head as any)({ loaderData: mockLoaderData });
    
    const cssLinks = headResult.links.filter(
      (link: any) => link.rel === 'stylesheet' && link.href === appCss
    );
    
    expect(cssLinks).toHaveLength(1);
  });
});
