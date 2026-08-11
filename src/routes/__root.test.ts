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

  it('should merge SEO links with base structural links', () => {
    const seoLink = { rel: 'canonical', href: 'https://example.com' };
    const mockLoaderData = {
      title: 'Test',
      meta: [],
      links: [seoLink]
    };
    
    const headResult = (Route.options.head as any)({ loaderData: mockLoaderData });
    
    expect(headResult.links).toContainEqual(seoLink);
    expect(headResult.links.some((l: any) => l.rel === 'stylesheet')).toBe(true);
  });

  it('should not duplicate the global stylesheet if already present in SEO data', () => {
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
