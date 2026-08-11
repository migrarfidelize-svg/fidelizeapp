import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureDefaultWhatsAppFlow } from '../bootstrap.server';
import { executeFlow } from '../flow-engine.server';
import { processAgentMessage } from '../agent-engine.server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { generateAgentResponse } from '../ai-adapter.server';

const createMockChain = (data: any = null, error: any = null) => {
    const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data, error })),
        single: vi.fn().mockImplementation(() => Promise.resolve({ data, error })),
        insert: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockImplementation(() => Promise.resolve({ error })),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        then: (onfulfilled: any) => Promise.resolve({ data, error }).then(onfulfilled),
    };
    return chain;
};

vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('../ai-adapter.server', () => ({
  generateAgentResponse: vi.fn().mockResolvedValue({ action: 'reply', text: 'IA Response' }),
}));

vi.mock('../../otp.functions', () => ({
  getActiveWhatsAppProvider: vi.fn().mockResolvedValue({
    provider: { 
        meta: { id: 'uazapi', label: 'UAZAPI' }, 
        sendTestMessage: vi.fn().mockResolvedValue({ ok: true, providerMessageId: 'msg-123' }) 
    },
    runtime: { establishment_id: 'f406351f-487b-47db-b0d3-bd5cb918b6c3' }
  }),
}));

describe('CRM End-to-End Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bootstrap e fluxo inicial', async () => {
    (supabaseAdmin.from as any).mockImplementation((table: string) => {
        if (table === 'crm_flows') return createMockChain({ id: 'flow-123' });
        if (table === 'crm_flow_steps') return createMockChain([]);
        if (table === 'system_settings') return createMockChain({ enabled: true });
        if (table === 'integrations') return createMockChain({ provider: 'openai' });
        return createMockChain();
    });

    const boot = await ensureDefaultWhatsAppFlow();
    expect(boot.flowId).toBe('flow-123');

    const steps = [
        { id: 's0', flow_id: 'flow-123', step_key: 'message', sort_order: 0, payload: { type: 'message', text: 'Welcome' } },
        { id: 's1', flow_id: 'flow-123', step_key: 'options', sort_order: 1, payload: { type: 'options', text: 'Menu', options: [{ value: '1', nextStepId: 's2' }] } }
    ];
    const conv = { id: 'c1', status: 'bot', customer_phone: '5511999999999', establishment_id: 'f406351f-487b-47db-b0d3-bd5cb918b6c3', metadata: {} };

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
        if (table === 'crm_conversations') return createMockChain(conv);
        if (table === 'crm_flows') return createMockChain({ steps });
        if (table === 'crm_messages') return createMockChain();
        if (table === 'system_settings') return createMockChain({ enabled: true, behavior: { mainFlowId: 'flow-123' } });
        return createMockChain();
    });

    const flowResult = await executeFlow('c1', 'oi');
    expect(flowResult.action).toBe('menu');
  });

  it('agent engine recebe contexto do step', async () => {
    const conv = { id: 'c1', status: 'bot', customer_phone: '5511', contact: { name: 'João' }, metadata: { flow_state: { mode: 'agent', flowId: 'f1', stepId: 's2' } } };
    const step = { id: 's2', payload: { context: 'Contexto Especial Fidelidade' } };
    
    (supabaseAdmin.from as any).mockImplementation((table: string) => {
        if (table === 'crm_conversations') return createMockChain(conv);
        if (table === 'crm_flow_steps') return createMockChain(step);
        if (table === 'system_settings') return createMockChain({ enabled: true, provider_id: 'openai' });
        if (table === 'crm_messages') return createMockChain([]);
        return createMockChain();
    });

    await processAgentMessage({ conversationId: 'c1', customerPhone: '5511', inboundText: 'Quero meus pontos', stepId: 's2' });
    
    expect(generateAgentResponse).toHaveBeenCalledWith(expect.objectContaining({
        systemPrompt: expect.stringContaining('Contexto Especial Fidelidade')
    }));
  });
});
