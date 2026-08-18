from pathlib import Path
from datetime import datetime
import shutil

ROOT = Path.cwd()
STAMP = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
BACKUP = ROOT / f'.crm-hotfix-backup-{STAMP}'

FILES = {
    'uazapi': ROOT / 'src/lib/integrations/otp/uazapi.ts',
    'bootstrap': ROOT / 'src/lib/crm/bootstrap.server.ts',
    'ai': ROOT / 'src/lib/crm/ai-adapter.server.ts',
    'webhook': ROOT / 'src/routes/api/public/webhooks/whatsapp.ts',
    'atendimento': ROOT / 'src/lib/atendimento.functions.ts',
}

for path in FILES.values():
    if not path.exists():
        raise SystemExit(f'ERRO: arquivo não encontrado: {path}')

BACKUP.mkdir(parents=True, exist_ok=True)
for path in FILES.values():
    target = BACKUP / path.relative_to(ROOT)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)


def replace_exact(path: Path, old: str, new: str, label: str, already_marker: str | None = None):
    text = path.read_text()
    if already_marker and already_marker in text:
        print(f'OK: {label} já aplicado')
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'ERRO: {label}: bloco esperado apareceu {count} vez(es). Backup: {BACKUP}')
    path.write_text(text.replace(old, new, 1))
    print(f'OK: {label}')

# 1) UAZAPI: nunca usar @lid como telefone de resposta. Prioriza chatid/JID real.
uazapi_old = '''    const rawChat =
      msg?.sender ||
      msg?.chatid ||
      msg?.chatId ||
      msg?.phone ||
      msg?.from ||
      root?.sender ||
      root?.chatid ||
      root?.chatId ||
      root?.phone ||
      root?.from ||
      body?.sender ||
      body?.chatid ||
      body?.chatId ||
      body?.phone ||
      body?.from ||
      key?.remoteJid ||
      "";
'''
uazapi_intermediate = '''    const chatCandidates = [
      msg?.chatid,
      msg?.chatId,
      root?.chatid,
      root?.chatId,
      body?.chatid,
      body?.chatId,
      key?.remoteJid,
      msg?.phone,
      root?.phone,
      body?.phone,
      msg?.from,
      root?.from,
      body?.from,
      msg?.sender,
      root?.sender,
      body?.sender,
    ]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => String(value).trim());

    const rawChat =
      chatCandidates.find((value) => value.includes("@s.whatsapp.net")) ||
      chatCandidates.find((value) => !value.includes("@lid")) ||
      "";
'''
uazapi_new = '''    const chatCandidates = [
      msg?.chatid,
      msg?.chatId,
      msg?.remoteJid,
      msg?.senderPn,
      msg?.senderPN,
      root?.chatid,
      root?.chatId,
      root?.remoteJid,
      root?.senderPn,
      root?.senderPN,
      body?.chatid,
      body?.chatId,
      body?.remoteJid,
      body?.senderPn,
      body?.senderPN,
      key?.remoteJid,
      msg?.phone,
      root?.phone,
      body?.phone,
      msg?.from,
      root?.from,
      body?.from,
      msg?.sender,
      root?.sender,
      body?.sender,
    ]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => String(value).trim());

    const isUsableDirectChat = (value: string) => {
      if (value.includes("@lid") || value.includes("@g.us")) return false;
      if (value.includes("@s.whatsapp.net")) return true;
      const digits = value.replace(/\\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    };

    const rawChat =
      chatCandidates.find((value) => value.includes("@s.whatsapp.net")) ||
      chatCandidates.find(isUsableDirectChat) ||
      "";
'''
text = FILES['uazapi'].read_text()
if uazapi_new in text:
    print('OK: parser UAZAPI anti-LID já aplicado')
elif uazapi_intermediate in text:
    FILES['uazapi'].write_text(text.replace(uazapi_intermediate, uazapi_new, 1))
    print('OK: parser UAZAPI anti-LID atualizado')
elif uazapi_old in text:
    FILES['uazapi'].write_text(text.replace(uazapi_old, uazapi_new, 1))
    print('OK: parser UAZAPI anti-LID aplicado')
else:
    raise SystemExit(f'ERRO: parser UAZAPI não corresponde à versão esperada. Backup: {BACKUP}')

# 2) Bootstrap: tolera duplicata histórica e herda Agent global automaticamente.
replace_exact(
    FILES['bootstrap'],
    '''  let { data: flow, error: flowError } = await (supabaseAdmin as any)\n    .from("crm_flows").select("id").eq("establishment_id", establishmentId).eq("name", FLOW_NAME).maybeSingle();\n''',
    '''  let { data: flow, error: flowError } = await (supabaseAdmin as any)\n    .from("crm_flows")\n    .select("id")\n    .eq("establishment_id", establishmentId)\n    .eq("name", FLOW_NAME)\n    .order("created_at", { ascending: true })\n    .limit(1)\n    .maybeSingle();\n''',
    'bootstrap não quebra com fluxo duplicado',
    '.order("created_at", { ascending: true })\n    .limit(1)'
)

bootstrap_defaults_old = '''  const defaults = {
    name: "Assistente Fidelize",
    systemPrompt: "Você é o Assistente Fidelize do estabelecimento. Atenda de forma objetiva, educada e útil. Utilize apenas informações disponíveis no contexto e no sistema. Não invente dados, saldo, promoções, regras ou informações do cliente. Quando não puder resolver com segurança, quando o cliente solicitar uma pessoa ou quando houver necessidade de ação humana, encaminhe para SUPORTE.",
    presentation: "Olá! 👋 Sou o assistente virtual. Como posso ajudar?",
    handoff: {
      keywords: [
        "suporte",
        "atendente",
        "humano",
        "falar com atendente",
        "falar com suporte",
        "quero falar com alguém",
        "preciso de ajuda humana"
      ],
      message: "Entendi. Vou encaminhar você para nossa equipe de suporte. 💜"
    },
    fallback: {
      message: "Não consegui resolver sua solicitação com segurança. Posso encaminhar você para o suporte.",
      maxFailures: 3,
      action: "transfer_to_queue"
    },
    behavior: {
      autoReply: true,
      welcomeNew: true,
      welcomeKnown: true,
      afterHuman: "stay_closed",
      timeoutMinutes: 10,
      timeoutAction: "transfer_to_queue",
      mainFlowId: flowId
    }
  };
'''
bootstrap_defaults_new = '''  // O Agent da plataforma é canônico. Cada tenant recebe o binding/flow isolado,
  // mas não precisa configurar provider, modelo, prompt ou comportamento manualmente.
  const { data: globalAgentRow, error: globalAgentError } = await (supabaseAdmin as any)
    .from("system_settings")
    .select("value")
    .eq("namespace", "crm")
    .eq("key", "agent_config")
    .maybeSingle();
  if (globalAgentError) throw globalAgentError;

  const globalAgentConfig = ((globalAgentRow as any)?.value || {}) as Record<string, any>;

  const { data: aiRows, error: aiRowsError } = await (supabaseAdmin as any)
    .from("integrations")
    .select("provider, establishment_id, config, updated_at")
    .eq("category", "ai")
    .eq("enabled", true)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (aiRowsError) throw aiRowsError;

  const aiCandidates = (aiRows || []) as any[];
  const selectedAi =
    aiCandidates.find((row) => row.establishment_id === establishmentId) ||
    aiCandidates.find((row) => row.establishment_id == null || row.config?.auth_scope === "global" || row.config?.use_for_crm === true) ||
    (aiCandidates.length === 1 ? aiCandidates[0] : null);

  const providerId = String(globalAgentConfig.provider_id || globalAgentConfig.provider || selectedAi?.provider || "");
  const defaultModels: Record<string, string> = {
    openai: "gpt-4o-mini",
    deepseek: "deepseek-chat",
    openrouter: "openai/gpt-4o-mini",
    grok: "grok-3-mini",
    groq: "llama-3.3-70b-versatile",
  };

  const defaults = {
    ...globalAgentConfig,
    name: globalAgentConfig.name || "Assistente Fidelize",
    provider_id: providerId,
    model: globalAgentConfig.model || selectedAi?.config?.default_model || defaultModels[providerId] || "",
    systemPrompt: globalAgentConfig.systemPrompt || "Você é o Assistente Fidelize do estabelecimento. Atenda de forma objetiva, educada e útil. Utilize apenas informações disponíveis no contexto e no sistema. Não invente dados, saldo, promoções, regras ou informações do cliente. Quando não puder resolver com segurança, quando o cliente solicitar uma pessoa ou quando houver necessidade de ação humana, encaminhe para SUPORTE.",
    presentation: globalAgentConfig.presentation || "Olá! 👋 Sou o assistente virtual. Como posso ajudar?",
    handoff: {
      keywords: ["suporte", "atendente", "humano", "falar com atendente", "falar com suporte", "quero falar com alguém", "preciso de ajuda humana"],
      message: "Entendi. Vou encaminhar você para nossa equipe de suporte. 💜",
      ...(globalAgentConfig.handoff || {}),
    },
    fallback: {
      message: "Não consegui resolver sua solicitação com segurança. Posso encaminhar você para o suporte.",
      maxFailures: 3,
      action: "transfer_to_queue",
      ...(globalAgentConfig.fallback || {}),
    },
    behavior: {
      autoReply: true,
      welcomeNew: true,
      welcomeKnown: true,
      afterHuman: "stay_closed",
      timeoutMinutes: 10,
      timeoutAction: "transfer_to_queue",
      ...(globalAgentConfig.behavior || {}),
      mainFlowId: flowId,
    }
  };
'''
replace_exact(FILES['bootstrap'], bootstrap_defaults_old, bootstrap_defaults_new, 'Agent padrão global aplicado automaticamente aos tenants', 'const globalAgentConfig = ((globalAgentRow as any)?.value || {})')

replace_exact(
    FILES['bootstrap'],
    '''    updatedConfig.handoff = { ...defaults.handoff, ...(currentConfig.handoff || {}) };\n    updatedConfig.fallback = { ...defaults.fallback, ...(currentConfig.fallback || {}) };\n    updatedConfig.behavior = { ...defaults.behavior, ...(currentConfig.behavior || {}) };\n''',
    '''    updatedConfig.handoff = { ...defaults.handoff, ...(currentConfig.handoff || {}) };\n    updatedConfig.fallback = { ...defaults.fallback, ...(currentConfig.fallback || {}) };\n    updatedConfig.behavior = { ...defaults.behavior, ...(currentConfig.behavior || {}) };\n    if (!updatedConfig.provider_id && defaults.provider_id) updatedConfig.provider_id = defaults.provider_id;\n    if (!updatedConfig.model && defaults.model) updatedConfig.model = defaults.model;\n''',
    'settings antigos recebem provider/model padrão',
    'if (!updatedConfig.provider_id && defaults.provider_id)'
)

# 3) IA: preferência tenant; fallback explícito/global ou único provider da plataforma.
ai_old = '''  // 2. Buscar Integração no Banco
  const { data: integration, error } = await supabaseAdmin
    .from("integrations")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("category", "ai")
    .eq("provider", providerId)
    .eq("enabled", true)
    .maybeSingle();

  if (error) throw error;
  if (!integration) return null;
'''
ai_new = '''  // 2. Buscar integração: tenant específico > global explícito > único provider da plataforma.
  // A credencial continua server-only e nunca é enviada ao tenant.
  const { data: integrations, error } = await supabaseAdmin
    .from("integrations")
    .select("*")
    .eq("category", "ai")
    .eq("provider", providerId)
    .eq("enabled", true)
    .limit(20);

  if (error) throw error;
  const rows = (integrations || []) as any[];
  const integration =
    rows.find((row) => row.establishment_id === establishmentId) ||
    rows.find((row) => row.establishment_id == null || row.config?.auth_scope === "global" || row.config?.use_for_crm === true) ||
    (rows.length === 1 ? rows[0] : null);
  if (!integration) return null;
'''
replace_exact(FILES['ai'], ai_old, ai_new, 'fallback de IA global seguro', 'tenant específico > global explícito')

# 4) CRM Super Admin: depois de autorizar o tenant, leitura server-side não depende de RLS do browser.
at = FILES['atendimento']
replace_exact(at, '''    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);\n\n    let query = supabase\n      .from("crm_conversations")\n''', '''    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);\n    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");\n\n    let query = supabaseAdmin\n      .from("crm_conversations")\n''', 'lista de conversas usa leitura server-side autorizada', 'let query = supabaseAdmin\n      .from("crm_conversations")')

messages_old = '''    const { data: conversation, error: conversationError } = await supabase
      .from("crm_conversations")
      .select("id")
      .eq("id", data.conversationId)
      .eq("establishment_id", establishmentId)
      .maybeSingle();
    if (conversationError || !conversation) throw new Error("Conversa não encontrada neste estabelecimento.");

    const { data: messages, error } = await supabase
      .from("crm_messages")
      .select("*")
      .eq("conversation_id", data.conversationId)
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const { data: notes } = await (supabase as any)
      .from("crm_internal_notes")
'''
messages_new = '''    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("crm_conversations")
      .select("id")
      .eq("id", data.conversationId)
      .eq("establishment_id", establishmentId)
      .maybeSingle();
    if (conversationError || !conversation) throw new Error("Conversa não encontrada neste estabelecimento.");

    const { data: messages, error } = await supabaseAdmin
      .from("crm_messages")
      .select("*")
      .eq("conversation_id", data.conversationId)
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const { data: notes } = await (supabaseAdmin as any)
      .from("crm_internal_notes")
'''
replace_exact(at, messages_old, messages_new, 'histórico de mensagens usa leitura server-side autorizada', 'const { data: messages, error } = await supabaseAdmin')

replace_exact(at, '''    const { data: conv, error: convErr } = await supabase\n      .from("crm_conversations")\n''', '''    const { data: conv, error: convErr } = await supabaseAdmin\n      .from("crm_conversations")\n''', 'envio manual localiza conversa via server-side', 'const { data: conv, error: convErr } = await supabaseAdmin')

replace_exact(at, '''    const { data: conversation, error: conversationError } = await supabase\n      .from("crm_conversations").select("establishment_id, metadata").eq("id", data.conversationId).eq("establishment_id", establishmentId).single();\n''', '''    const { data: conversation, error: conversationError } = await supabaseAdmin\n      .from("crm_conversations").select("establishment_id, metadata").eq("id", data.conversationId).eq("establishment_id", establishmentId).single();\n''', 'mudança de status localiza conversa via server-side', 'const { data: conversation, error: conversationError } = await supabaseAdmin\n      .from("crm_conversations").select("establishment_id, metadata")')

flows_old = '''    // Ensure default flow exists for this tenant
    const { ensureDefaultWhatsAppFlow } = await import("./crm/bootstrap.server");
    await ensureDefaultWhatsAppFlow(establishmentId);

    const { data: flows, error } = await (supabase as any)
      .from("crm_flows")
'''
flows_new = '''    // Ensure default flow exists for this tenant
    const { ensureDefaultWhatsAppFlow } = await import("./crm/bootstrap.server");
    await ensureDefaultWhatsAppFlow(establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: flows, error } = await (supabaseAdmin as any)
      .from("crm_flows")
'''
replace_exact(at, flows_old, flows_new, 'lista de fluxos usa leitura server-side autorizada', 'const { data: flows, error } = await (supabaseAdmin as any)')

contacts_old = '''    const { data, error } = await (supabase as any)
      .from("crm_contacts")
      .select("*, tags:crm_contact_tags(tag:crm_tags(*))")
      .eq("establishment_id", establishmentId)
'''
contacts_new = '''    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("crm_contacts")
      .select("*, tags:crm_contact_tags(tag:crm_tags(*))")
      .eq("establishment_id", establishmentId)
'''
replace_exact(at, contacts_old, contacts_new, 'contatos usam leitura server-side autorizada', 'const { data, error } = await (supabaseAdmin as any)\n      .from("crm_contacts")')

# 5) Webhook: não esconder mais o erro real da automação.
replace_exact(FILES['webhook'], '''      console.error("[CRM webhook] retry failed");\n''', '''      console.error("[CRM webhook] retry failed", error instanceof Error ? `${error.name}: ${error.message}` : String(error));\n''', 'log real de erro no retry do webhook', 'console.error("[CRM webhook] retry failed", error instanceof Error')
replace_exact(FILES['webhook'], '''    console.error("[CRM webhook] automation failed");\n''', '''    console.error("[CRM webhook] automation failed", error instanceof Error ? `${error.name}: ${error.message}` : String(error));\n''', 'log real de erro na automação do webhook', 'console.error("[CRM webhook] automation failed", error instanceof Error')

print(f'OK: hotfix de código aplicado. Backup local: {BACKUP}')
print('PRÓXIMO: execute bun run build; somente reinicie o PM2 se o build terminar com sucesso.')
