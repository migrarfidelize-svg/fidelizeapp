import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureDefaultWhatsAppFlow } from '../bootstrap.server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('CRM Bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bootstrap 0 -> 1 flow + 7 steps', async () => {
    const mockFlow = { id: 'flow-123' };

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'crm_flows') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }),
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: mockFlow, error: null }) }) })
        };
      }
      if (table === 'crm_flow_steps') {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
          insert: () => Promise.resolve({ error: null })
        };
      }
      if (table === 'system_settings') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { value: {} }, error: null }) }) }) }),
          upsert: () => Promise.resolve({ error: null })
        };
      }
      if (table === 'integrations') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { provider: 'openai' }, error: null }) }) }) })
        };
      }
    });

    const result = await ensureDefaultWhatsAppFlow();
    expect(result.flowId).toBe('flow-123');
    expect(result.stepsCount).toBe(7);
  });

  it('bootstrap steps 1-6 -> erro explícito', async () => {
    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'crm_flows') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'flow-123' }, error: null }) }) }) })
        };
      }
      if (table === 'crm_flow_steps') {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [{ id: '1' }], error: null }) })
        };
      }
    });

    await expect(ensureDefaultWhatsAppFlow()).rejects.toThrow('CRM_DEFAULT_FLOW_PARTIAL:1');
  });
});
