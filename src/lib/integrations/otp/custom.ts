import { timedFetch } from "../types";
import type { IntegrationRuntimeConfig, NodeEnv, TestConnectionResult } from "../types";
import type { WhatsAppOTPProvider } from "./base";

export const customOtp: WhatsAppOTPProvider = {
  meta: {
    id: "custom",
    label: "Provider Customizado (API)",
    category: "otp",
    description: "Configuração manual para qualquer API de WhatsApp.",
    icon: "Settings",
    fields: [
      {
        name: "url",
        label: "URL de Envio",
        kind: "url",
        required: true,
        placeholder: "https://minhaapi.com/send",
        helpText: "URL completa do endpoint de envio de texto.",
      },
      {
        name: "method",
        label: "Método HTTP",
        kind: "text",
        required: true,
        defaultValue: "POST",
        placeholder: "POST ou GET",
      },
      {
        name: "authHeaderName",
        label: "Nome do Header de Autenticação",
        kind: "text",
        required: false,
        placeholder: "Authorization ou apikey",
        helpText: "Deixe vazio se não usar header.",
      },
      {
        name: "apiKey",
        label: "API Key / Token",
        kind: "password",
        required: false,
        helpText: "Valor que será enviado no header de autenticação.",
      },
      {
        name: "jsonTemplate",
        label: "Template do JSON (Body)",
        kind: "text",
        required: false,
        placeholder: '{"to": "{{phone}}", "msg": "{{message}}"}',
        helpText: "Use {{phone}} e {{message}} como placeholders.",
      },
    ],
  },

  async testConnection(runtime: IntegrationRuntimeConfig): Promise<TestConnectionResult> {
    const url = runtime.config.url as string;
    if (!url) return { ok: false, message: "URL não configurada." };
    
    // Teste de conexão genérico: tenta um HEAD ou o próprio endpoint
    try {
      const { response, latency_ms } = await timedFetch(url, { method: "HEAD" });
      if (response.ok || response.status < 500) {
        return { ok: true, message: `Endpoint respondeu (Status: ${response.status})`, latency_ms };
      }
      return { ok: false, message: `Erro no endpoint: ${response.status}`, latency_ms };
    } catch (err) {
      return { ok: false, message: `Falha ao alcançar URL: ${err instanceof Error ? err.message : String(err)}` };
    }
  },

  async sendOtp(runtime: IntegrationRuntimeConfig, env: NodeEnv, phone: string, code: string) {
    const message = `Seu código de acesso Afidelize é: ${code}`;
    return this.sendTestMessage(runtime, env, phone, message);
  },

  async sendTestMessage(runtime: IntegrationRuntimeConfig, env: NodeEnv, phone: string, message: string) {
    const url = runtime.config.url as string;
    const method = (runtime.config.method as string) || "POST";
    const authHeaderName = runtime.config.authHeaderName as string;
    const apiKey = runtime.config.apiKey as string;
    const jsonTemplate = runtime.config.jsonTemplate as string;

    if (!url) return { ok: false, message: "URL não configurada." };

    const cleanPhone = phone.replace(/\D/g, "");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authHeaderName && apiKey) {
      headers[authHeaderName] = apiKey;
    }

    try {
      let body: string | undefined;
      let finalUrl = url;

      if (jsonTemplate) {
        body = jsonTemplate
          .replace(/{{phone}}/g, cleanPhone)
          .replace(/{{message}}/g, message);
      } else {
        // Fallback simples se não houver template
        body = JSON.stringify({ phone: cleanPhone, message });
      }

      // Se for GET, anexar ao invés de enviar body
      if (method.toUpperCase() === "GET") {
        const params = new URLSearchParams();
        params.append("phone", cleanPhone);
        params.append("message", message);
        finalUrl += (finalUrl.includes("?") ? "&" : "?") + params.toString();
        body = undefined;
      }

      const { response, body: resBody } = await timedFetch(finalUrl, {
        method: method.toUpperCase(),
        headers,
        body
      });

      if (response.ok) {
        return { ok: true, message: "Mensagem enviada via provider customizado.", providerMessageId: `custom-${Date.now()}` };
      }

      return { ok: false, message: `Erro no envio (${response.status}): ${resBody}` };
    } catch (err) {
      return { ok: false, message: `Falha no provider customizado: ${err instanceof Error ? err.message : String(err)}` };
    }
  },

  parseWebhook(body: any) {
    const remoteMessageId = body.id || body.messageId || body.key?.id;
    const fromPhone = body.phone || body.from || body.sender;
    const text = body.text || body.message || body.content;
    
    if (!remoteMessageId || !fromPhone || !text) return null;
    
    return { remoteMessageId, fromPhone, text };
  }
};
