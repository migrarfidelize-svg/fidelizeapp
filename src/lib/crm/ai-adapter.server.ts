import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiProviders } from "@/lib/integrations/ai";
import { decryptSecret } from "@/lib/integrations/crypt.server";

export interface AIProviderRuntime {
  provider: any;
  integration: any;
  finalEnv: Record<string, string>;
  integrationConfig: Record<string, any>;
}

/**
 * Resolve e valida o runtime de um provider de IA.
 * Centraliza a lógica de busca em integrações, decriptografia e mapeamento de chaves.
 */
export async function resolveAIProviderRuntime(
  providerId?: string | null
): Promise<AIProviderRuntime | null> {
  if (!providerId) return null;

  // 1. Localizar Provider
  const provider = aiProviders.find(p => p.meta.id === providerId);
  if (!provider) return null;

  // 2. Buscar Integração no Banco
  const { data: integration, error } = await supabaseAdmin
    .from("integrations")
    .select("*")
    .eq("provider", providerId)
    .eq("enabled", true)
    .maybeSingle();

  if (error) throw error;
  if (!integration) return null;

  // 3. Resolver/Decriptar Credenciais
  const encryptedCredentials = (integration.credentials || {}) as Record<string, any>;
  const credentialsRef = (integration.credentials_ref || {}) as Record<string, string>;
  const integrationConfig = (integration.config || {}) as Record<string, any>;

  const decryptedEnv: Record<string, string> = {};
  for (const [field, encryptedValue] of Object.entries(encryptedCredentials)) {
    const envKey = credentialsRef[field] || field;
    if (typeof encryptedValue === 'string' && encryptedValue.length > 20) {
      decryptedEnv[envKey] = await decryptSecret(encryptedValue);
    } else {
      decryptedEnv[envKey] = String(encryptedValue);
    }
  }

  // Montar finalEnv
  const finalEnv = {
    ...process.env,
    ...decryptedEnv
  } as Record<string, string>;

  // 4. Mapear chave obrigatória e validar suporte
  const providerKeyMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    groq: 'GROQ_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    grok: 'XAI_API_KEY'
  };

  const apiKeyVar = providerKeyMap[providerId];
  if (!apiKeyVar) return null;

  const apiKey = finalEnv[apiKeyVar];
  if (!apiKey || apiKey.trim() === '') return null;

  return {
    provider,
    integration,
    finalEnv,
    integrationConfig
  };
}

/**
 * Verifica se um provider de IA está pronto para uso.
 */
export async function isAIProviderUsable(
  providerId?: string | null
): Promise<boolean> {
  try {
    const runtime = await resolveAIProviderRuntime(providerId);
    return Boolean(runtime);
  } catch (e) {
    console.error(`[AI Adapter] Error checking usability for ${providerId}:`, e);
    return false;
  }
}

export interface AgentResponse {
  text: string;
  action: "reply" | "handoff";
  reason?: string;
}

export interface AgentMessageInput {
  providerId: string;
  model?: string;
  systemPrompt: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  temperature?: number;
  maxTokens?: number;
}

/**
 * Normaliza a chamada para diferentes providers de IA configurados no sistema.
 */
export async function generateAgentResponse(input: AgentMessageInput): Promise<AgentResponse> {
  const { providerId, model, systemPrompt, messages, temperature = 0.7, maxTokens = 500 } = input;

  // Usar helper centralizado para resolução
  const runtime = await resolveAIProviderRuntime(providerId);
  if (!runtime) {
    throw new Error(`AI Integration not usable for provider: ${providerId}`);
  }

  const { provider, integration, finalEnv, integrationConfig } = runtime;

  // Preparar Mensagens (incluindo System Prompt)
  const fullMessages = [
    { role: "system", content: systemPrompt },
    ...messages
  ];

  // Chamar Provider
  let resultText = "";

  try {
    if (providerId === 'openai') {
      const apiKey = finalEnv.OPENAI_API_KEY;
      const baseUrl = String(integrationConfig.base_url || "https://api.openai.com/v1").replace(/\/+$/, "");
      
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || "gpt-4o-mini",
          messages: fullMessages,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API Error: ${err}`);
      }

      const data = await response.json();
      resultText = data.choices[0].message.content;
    } 
    else if (providerId === 'groq' || providerId === 'openrouter' || providerId === 'deepseek' || providerId === 'grok') {
        const apiKeyEnvVar = providerId === 'groq' ? 'GROQ_API_KEY' : 
                             providerId === 'openrouter' ? 'OPENROUTER_API_KEY' : 
                             providerId === 'deepseek' ? 'DEEPSEEK_API_KEY' : 
                             'XAI_API_KEY';

        const apiKey = finalEnv[apiKeyEnvVar];
        const defaultUrl = providerId === 'groq' ? 'https://api.groq.com/openai/v1' : 
                           providerId === 'openrouter' ? 'https://openrouter.ai/api/v1' : 
                           providerId === 'deepseek' ? 'https://api.deepseek.com' :
                           'https://api.x.ai/v1';

        const baseUrl = String(integrationConfig.base_url || defaultUrl).replace(/\/+$/, "");

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model || integrationConfig.default_model,
              messages: fullMessages,
              temperature,
              max_tokens: maxTokens,
              ...(providerId !== 'openrouter' ? { response_format: { type: "json_object" } } : {})
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`${providerId} API Error: ${err}`);
        }

        const data = await response.json();
        resultText = data.choices[0].message.content;
    }
    else {
      throw new Error(`Chat implementation for provider ${providerId} not yet ready in AI Adapter.`);
    }

    // Parsear e Validar Resposta Estruturada
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      const cleanJson = jsonMatch ? jsonMatch[0] : resultText;
      const parsed = JSON.parse(cleanJson);

      return {
        text: parsed.message || parsed.text || "Desculpe, não consegui processar sua resposta.",
        action: parsed.action === 'handoff' ? 'handoff' : 'reply',
        reason: parsed.reason
      };
    } catch (e) {
      console.error("[AI Adapter] Failed to parse structured JSON from IA:", resultText);
      if (resultText && resultText.length > 0) {
          return { text: resultText, action: "reply" };
      }
      throw new Error("IA returned invalid format and no text fallback.");
    }

  } catch (error: any) {
    console.error(`[AI Adapter] Error calling ${providerId}:`, error);
    throw error;
  }
}