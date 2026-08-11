import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActiveWhatsAppProvider } from '../../otp.functions';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

const createMockChain = (data: any = null, error: any = null) => {
    const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data, error })),
        single: vi.fn().mockImplementation(() => Promise.resolve({ data, error })),
        then: (onfulfilled: any) => Promise.resolve({ data, error }).then(onfulfilled),
    };
    return chain;
};

vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock('../../integrations/registry', () => ({
  getProvider: vi.fn().mockReturnValue({ meta: { id: 'uazapi' } }),
}));

vi.mock('../../integrations/crypt.server', () => ({
  decryptSecret: vi.fn().mockImplementation((val) => Promise.resolve(val)),
}));

describe('Multi-tenant Provider Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar establishmentId real da integração', async () => {
    const mockIntegration = {
      id: 'int-123',
      provider: 'uazapi',
      category: 'otp',
      enabled: true,
      establishment_id: 'f406351f-487b-47db-b0d3-bd5cb918b6c3',
      credentials: { token: 'abc' },
      config: {},
      mode: 'production'
    };

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
        if (table === 'integrations') return createMockChain(mockIntegration);
        return createMockChain();
    });

    const active = await getActiveWhatsAppProvider();
    
    expect(active).not.toBeNull();
    expect(active?.establishmentId).toBe('f406351f-487b-47db-b0d3-bd5cb918b6c3');
    // Invariante: não deve usar runtime para o tenant ID
    expect((active?.runtime as any).establishment_id).toBeUndefined();
  });
});
