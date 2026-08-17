# Plan - Finalize CRM WhatsApp / Agent / Default Flow

Finalize the functional configuration of WhatsApp customer service, ensuring the default Agent and Flow are correctly persisted, visible in the UI, and respect multi-tenant isolation.

## Technical Details

### 1. Bootstrap Logic Refactoring (`src/lib/crm/bootstrap.server.ts`)
*   Implement `ensureDefaultAgentSettings` to create or update `crm_agent_settings` with:
    *   Name: "Assistente Fidelize"
    *   System Prompt, Presentation, and Handoff keywords (suporte, atendente, humano, etc.).
    *   Fallback logic (3 failures -> transfer to queue).
    *   Behavior settings (autoReply: true, welcomeNew: true, etc.).
*   Update `ensureDefaultWhatsAppFlow` to guarantee a 7-step structure:
    *   Steps: `welcome`, `main_menu`, `agent_loyalty`, `agent_promotions`, `agent_access`, `agent_general`, `human_handoff`.
    *   `main_menu` routes 1-5 to their respective agent/handoff steps.
*   Ensure idempotency: Fill missing fields but preserve user-customized ones.

### 2. Agent Engine Enhancements (`src/lib/crm/agent-engine.server.ts`)
*   Add logic to check for a valid AI provider before processing.
*   If no provider is found, log a warning and return `action: "ignored"`.
*   Integrate keyword detection for handoff directly in the agent message processing.

### 3. Flow Engine Fixes (`src/lib/crm/flow-engine.server.ts`)
*   Correct `handoff` function:
    *   Create or reuse `crm_support_ticket`.
    *   Set conversation status to `waiting`.
    *   Clear `assigned_to` and `assigned_at`.
    *   Silence bot and agent for this conversation.
*   Add keyword resolution for handoff terms (suporte, atendente, humano, etc.) at any point in the flow.

### 4. Server Functions & UI Integration (`src/lib/atendimento.functions.ts` & `src/components/crm/AgentConfig.tsx`)
*   Ensure `getAgentSettings` and `saveAgentSettings` are tenant-safe.
*   Update `getAgentSettings` to validate active AI providers and return a status flag.
*   Update `AgentConfig` UI:
    *   Display "Provider de IA pendente" instead of "ONLINE" if no provider is configured.
    *   Ensure all fields (name, prompt, presentation, etc.) load and persist correctly.

### 5. Tenant Validation
*   Strictly use `establishment_id` in all database operations (Agent settings, flows, messages, conversations, tickets).
*   Prevent cross-tenant access.

### 6. Verification
*   Run the complete build.
*   Execute existing CRM test suites and ensure all 91 tests pass.
*   Manually verify the "first message" flow via a mock webhook call if possible.

**Important:** No changes to Auth OTP, Wallet, Landing, or Payments modules.
