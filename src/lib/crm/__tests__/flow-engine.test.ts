import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeFlow } from '../flow-engine.server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  },
}));

vi.mock('../agent-engine.server', () => ({
  processAgentMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../bootstrap.server', () => ({
  ensureDefaultWhatsAppFlow: vi.fn().mockResolvedValue({ flowId: 'flow-123' }),
}));

vi.mock('../../otp.functions', () => ({
  getActiveWhatsAppProvider: vi.fn().mockResolvedValue({
    provider: { meta: { id: 'test' }, sendTestMessage: vi.fn().mockResolvedValue({ ok: true }) },
    runtime: {}
  }),
}));

describe('CRM Flow Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('primeira mensagem -> welcome + menu', async () => {
    const conv = { id: 'conv-123', status: 'bot', customer_phone: '12345', establishment_id: 'est-123', metadata: {} };
    const steps = [
      { id: 'step-0', flow_id: 'flow-123', step_key: 'message', sort_order: 0, payload: { type: 'message', text: 'Welcome' } },
      { id: 'step-1', flow_id: 'flow-123', step_key: 'options', sort_order: 1, payload: { type: 'options', text: 'Menu', options: [] } }
    ];

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'crm_conversations') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: conv }) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) })
        };
      }
      if (table === 'crm_flows') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { steps } }) }) })
        };
      }
      if (table === 'crm_messages') {
        return { insert: () => Promise.resolve({ error: null }) };
      }
      if (table === 'system_settings') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { value: { enabled: true } } }) }) }) }) };
      }
    });

    const result = await executeFlow('conv-123', 'oi');
    expect(result.ok).toBe(true);
    expect(result.action).toBe('welcome_menu');
  });

  it('comando menu -> volta para o menu', async () => {
    const conv = { id: 'conv-123', status: 'bot', metadata: { flow_state: { flowId: 'flow-123', stepId: 'step-agent', mode: 'agent' } } };
    const steps = [
      { id: 'step-0', flow_id: 'flow-123', step_key: 'message', sort_order: 0, payload: { type: 'message' } },
      { id: 'step-1', flow_id: 'flow-123', step_key: 'options', sort_order: 1, payload: { type: 'options', text: 'Menu' } }
    ];

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'crm_conversations') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: conv }) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) })
        };
      }
      if (table === 'crm_flows') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { steps } }) }) })
        };
      }
      if (table === 'crm_messages') {
        return { insert: () => Promise.resolve({ error: null }) };
      }
      if (table === 'system_settings') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { value: { enabled: true } } }) }) }) }) };
      }
    });

    const result = await executeFlow('conv-123', 'menu');
    expect(result.action).toBe('menu');
  });

  it('handoff por palavra-chave -> waiting', async () => {
    const conv = { id: 'conv-123', status: 'bot', metadata: {} };
    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === 'crm_conversations') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: conv }) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) })
        };
      }
      if (table === 'system_settings') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { value: { enabled: true } } }) }) }) }) };
      }
      if (table === 'crm_messages') {
        return { insert: () => Promise.resolve({ error: null }) };
      }
    });

    const result = await executeFlow('conv-123', 'falar com atendente');
    expect(result.action).toBe('handoff');
  });
});
