import { describe, it, expect, vi } from 'vitest';
import { normalizeQrDest, resolveQrTarget } from './qr-target.server';

describe('QR Flow Diagnostic', () => {
  it('should normalize destinations correctly', () => {
    expect(normalizeQrDest('MENU')).toBe('menu');
    expect(normalizeQrDest('INVALID')).toBe('reviews');
    expect(normalizeQrDest(null)).toBe('reviews');
  });

  it('should resolve targets correctly for active establishments', async () => {
    const mockAdmin = {
      rpc: vi.fn().mockResolvedValue({ data: true }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { status: 'published' } })
      })
    };

    const result = await resolveQrTarget({
      admin: mockAdmin,
      origin: 'https://afidelize.app',
      slug: 'test-slug',
      establishmentId: 'uuid',
      dest: 'menu'
    });

    expect(result.url).toBe('https://afidelize.app/cardapio/test-slug');
    expect(result.dest).toBe('menu');
    expect(result.fellBack).toBe(false);
  });

  it('should fallback to reviews if establishmentId is missing', async () => {
    const mockAdmin = {};
    const result = await resolveQrTarget({
      admin: mockAdmin,
      origin: 'https://afidelize.app',
      slug: 'test-slug',
      establishmentId: null,
      dest: 'menu'
    });

    expect(result.url).toBe('https://afidelize.app/avaliar/test-slug');
    expect(result.dest).toBe('reviews');
    expect(result.fellBack).toBe(true);
  });
});
