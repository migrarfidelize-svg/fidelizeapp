import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiProviders } from "@/lib/integrations/ai";
import { decryptSecret } from "@/lib/integrations/crypt.server";

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

  // 1. Localizar Provider
  const provider = aiProviders.find(p => p.meta.id === providerId);
  if (!provider) {
    throw new Error(`AI Provider not found: ${providerId}`);
  }

  // 2. Resolver Credenciais Decriptografadas
  const { data: integration } = await supabaseAdmin
    .from("integrations")
    .select("*")
    .eq("provider", providerId)
    .eq("enabled", true)
    .maybeSingle();

  if (!integration) {
    throw new Error(`AI Integration not enabled for provider: ${providerId}`);
  }

  const encryptedCredentials = (integration.credentials || {}) as Record<string, string>;
  const decryptedEnv: Record<string, string> = {};
  
  for (const [field, encryptedValue] of Object.entries(encryptedCredentials)) {
    if (typeof encryptedValue === 'string' && encryptedValue.length > 20) {
      decryptedEnv[integration.credentials_ref?.[field] || field] = await decryptSecret(encryptedValue);
    } else {
      decryptedEnv[integration.credentials_ref?.[field] || field] = encryptedValue;
    }
  }

  // Fallback para variáveis de ambiente se não estiver no DB
  const finalEnv = { ...process.env, ...decryptedEnv } as Record<string, string>;

  // 3. Preparar Mensagens (incluindo System Prompt)
  const fullMessages = [
    { role: "system", content: systemPrompt },
    ...messages
  ];

  // 4. Chamar Provider (Adaptador Específico ou Genérico se possível)
  // Como o projeto já tem os providers, vamos usar a infra existente.
  // Note: O projeto atual tem testConnection, mas não tem um método unificado de 'chat'.
  // Vamos implementar chamadas diretas baseadas no providerId para garantir o funcionamento.

  let resultText = "";

  try {
    if (providerId === 'openai') {
      const apiKey = finalEnv.OPENAI_API_KEY;
      const baseUrl = String(integration.config?.base_url || "https://api.openai.com/v1").replace(/\/+$/, "");
      
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
    else if (providerId === 'groq' || providerId === 'openrouter' || providerId === 'deepseek') {
        // Estes costumam seguir o padrão OpenAI
        const apiKeyEnvVar = providerId === 'groq' ? 'GROQ_API_KEY' : providerId === 'openrouter' ? 'OPENROUTER_API_KEY' : 'DEEPSEEK_API_KEY';
        const apiKey = finalEnv[apiKeyEnvVar];
        const defaultUrl = providerId === 'groq' ? 'https://api.groq.com/openai/v1' : 
                           providerId === 'openrouter' ? 'https://openrouter.ai/api/v1' : 
                           'https://api.deepseek.com';
        const baseUrl = String(integration.config?.base_url || defaultUrl).replace(/\/+$/, "");

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model || integration.config?.default_model,
              messages: fullMessages,
              temperature,
              max_tokens: maxTokens,
              // Tentar forçar JSON se suportado, senão tratar no código
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
      // Fallback para outros ou erro se não implementado
      throw new Error(`Chat implementation for provider ${providerId} not yet ready in AI Adapter.`);
    }

    // 5. Parsear e Validar Resposta Estruturada
    try {
      // Tentar extrair JSON se a IA enviou markdown
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
      // Fallback: se tiver texto, assume reply
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
