# Plan: CRM Bootstrap and Engine Robustness

Correction of structural errors in CRM flow steps and establishment resolution in the WhatsApp webhook.

## User Review Required

> [!IMPORTANT]
> The `crm_flow_steps` table has a UNIQUE constraint on `(flow_id, step_key)`. The current bootstrap was violating this by creating multiple steps with the same `step_key`.

- **Step Keys**: We will use unique identifiers: `welcome`, `main_menu`, `agent_loyalty`, `agent_promotions`, `agent_access`, `agent_general`, `human_handoff`.
- **Multi-tenant resolution**: We are fixing the webhook to resolve the `establishment_id` directly from the integration record, ensuring the WhatsApp flow works correctly for the "Fidelize" tenant (f406351f-...).

## Proposed Changes

### CRM Core Logic
- **Bootstrap (`src/lib/crm/bootstrap.server.ts`)**: 
    - Use specific, unique `step_key` values.
    - Robust idempotency: if steps are 0, create; if 7, preserve; otherwise, throw `CRM_DEFAULT_FLOW_PARTIAL`.
- **Flow Engine (`src/lib/crm/flow-engine.server.ts`)**:
    - Decouple `step_key` from "functional type".
    - Use `getStepType(step)` helper to check `payload.type || step_key`.
    - Fix global command detection (handoff/menu) to use the type-based lookup.
- **Agent Engine (`src/lib/crm/agent-engine.server.ts`)**:
    - Incorporate `payload.context` into the system prompt.
    - Ensure global keywords (menu/handoff) are consistently handled.

### Integrations & Webhooks
- **OTP Functions (`src/lib/otp.functions.ts`)**: 
    - Update `getActiveWhatsAppProvider` to return `establishmentId` resolved from the database record.
- **WhatsApp Webhook (`src/routes/api/public/webhooks/whatsapp.ts`)**:
    - Use the resolved `establishmentId` from `getActiveWhatsAppProvider`.
    - Explicit validation: fail early if `establishmentId` is missing.
    - Improved logging for stages (Provider, Establishment, Contact, Conversation, Flow).
    - Ensure `crm_contacts` and `crm_conversations` queries/inserts use the correct `establishment_id`.
- **UAZAPI Provider (`src/lib/integrations/otp/uazapi.ts`)**:
    - No changes needed to the core logic, but ensure full response data is returned on fallback.

### UI & CRUD
- **Flows Functions (`src/lib/atendimento.functions.ts`)**:
    - Ensure `saveCRMFlow` generates unique `step_key` values (e.g., `type_uuid`) when saving from the editor.
- **Flow Editor (`src/components/crm/FlowEditor.tsx`)**:
    - (Audit) Ensure it doesn't break unique constraint by allowing duplicate keys.

## Verification Plan

### Automated Tests
- Run `bunx vitest src/lib/crm/__tests__`.
- Validate unique `step_key` constraint (7 distinct keys).
- Validate `establishment_id` resolution for Fidelize UUID.
- Validate flow auto-advancement and menu command logic.

### Manual Verification
- **Bootstrap**: Open CRM UI -> Verify 7 steps are created with unique keys.
- **Webhook**: Simulate inbound message -> Verify log "establishment resolved: f406351f-..." -> Verify conversation status "bot" -> Verify Welcome + Menu response.
- **Flow**: Respond "1" -> Verify Agent Loyalty context -> Send "menu" -> Verify return to main menu.
