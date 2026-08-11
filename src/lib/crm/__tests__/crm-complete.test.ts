import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureDefaultWhatsAppFlow } from '../bootstrap.server';
import { executeFlow } from '../flow-engine.server';
import { processAgentMessage } from '../agent-engine.server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { generateAgentResponse } from '../ai-adapter.server';

vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
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
    // 1. Mock bootstrap tables
    (supabaseAdmin.from as any).mockImplementation((table: string) => {
        if (table === 'crm_flows') return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }), insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'flow-123' } }) }) }) };
        if (table === 'crm_flow_steps') return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }), insert: () => Promise.resolve({ error: null }) };
        if (table === 'system_settings') return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { value: {} } }) }) }) }), upsert: () => Promise.resolve({ error: null }) };
        if (table === 'integrations') return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { provider: 'openai' } }) }) }) }) };
        return { insert: () => Promise.resolve({ error: null }) };
    });

    const boot = await ensureDefaultWhatsAppFlow();
    expect(boot.flowId).toBe('flow-123');

    // 2. Mock Flow Execution
    const steps = [
        { id: 's0', flow_id: 'flow-123', step_key: 'message', sort_order: 0, payload: { type: 'message', text: 'Welcome' } },
        { id: 's1', flow_id: 'flow-123', step_key: 'options', sort_order: 1, payload: { type: 'options', text: 'Menu', options: [{ value: '1', nextStepId: 's2' }] } }
    ];
    const conv = { id: 'c1', status: 'bot', customer_phone: '5511999999999', establishment_id: 'f406351f-487b-47db-b0d3-bd5cb918b6c3', metadata: {} };

    (supabaseAdmin.from as any).mockImplementation((table: string) => {
        if (table === 'crm_conversations') return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: conv }) }) }), update: () => Promise.resolve({ error: null }) };
        if (table === 'crm_flows') return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { steps } }) }) }) };
        if (table === 'crm_messages') return { insert: () => Promise.resolve({ error: null }) };
        if (table === 'system_settings') return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { value: { enabled: true, behavior: { mainFlowId: 'flow-123' } } } }) }) }) }) };
    });

    const flowResult = await executeFlow('c1', 'oi');
    expect(flowResult.action).toBe('menu');
  });

  it('agent engine recebe contexto do step', async () => {
    const conv = { id: 'c1', status: 'bot', customer_phone: '5511', contact: { name: 'João' }, metadata: { flow_state: { mode: 'agent', flowId: 'f1', stepId: 's2' } } };
    const step = { id: 's2', payload: { context: 'Contexto Especial Fidelidade' } };
    
    (supabaseAdmin.from as any).mockImplementation((table: string) => {
        if (table === 'crm_conversations') return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: conv }) }) }), update: () => Promise.resolve({ error: null }) };
        if (table === 'crm_flow_steps') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: step }) }) }) };
        if (table === 'system_settings') return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { value: { enabled: true, provider_id: 'openai' } } }) }) }) }) };
        if (table === 'crm_messages') return { select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }), insert: () => Promise.resolve({ error: null }) };
    });

    await processAgentMessage({ conversationId: 'c1', customerPhone: '5511', inboundText: 'Quero meus pontos', stepId: 's2' });
    
    expect(generateAgentResponse).toHaveBeenCalledWith(expect.objectContaining({
        systemPrompt: expect.stringContaining('Contexto Especial Fidelidade')
    }));
  });
});
