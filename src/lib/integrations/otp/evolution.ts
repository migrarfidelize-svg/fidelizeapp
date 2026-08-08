import { timedFetch } from "../types";
import type { IntegrationRuntimeConfig, NodeEnv, TestConnectionResult } from "../types";
import type { WhatsAppOTPProvider, WhatsAppInstanceStatus } from "./base";

export const evolutionOtp: WhatsAppOTPProvider = {
  meta: {
    id: "evolution",
    label: "Evolution API",
    category: "otp",
    description: "Integração via Evolution API para envio de mensagens via WhatsApp.",
    icon: "MessageSquare",
    fields: [
      {
        name: "baseUrl",
        label: "Servidor / Base URL",
        kind: "url",
        required: true,
        placeholder: "https://minha-instancia.com",
      },
      {
        name: "apiKey",
        label: "API Key / Global Token",
        kind: "password",
        required: true,
      },
      {
        name: "instance",
        label: "Instância",
        kind: "text",
        required: true,
        placeholder: "instancia_01",
      },
    ],
  },

  async testConnection(runtime: IntegrationRuntimeConfig, env: NodeEnv): Promise<TestConnectionResult> {
    const baseUrl = (runtime.config.baseUrl as string)?.replace(/\/$/, "");
    const apiKey = (runtime.config.apiKey as string) || env.WHATSAPP_API_KEY;
    const instance = (runtime.config.instance as string) || env.WHATSAPP_INSTANCE_ID;

    if (!baseUrl || !apiKey || !instance) {
      return { ok: false, message: "Configuração incompleta (Base URL, API Key ou Instância ausente)." };
    }

    try {
      const { response, body, latency_ms } = await timedFetch(`${baseUrl}/instance/display/${instance}`, {
        headers: { "apikey": apiKey },
      });

      if (response.ok) {
        return { ok: true, message: "Conectado com sucesso.", latency_ms };
      }

      return { 
        ok: false, 
        status: response.status, 
        message: `Erro ao consultar instância: ${body}`,
        latency_ms 
      };
    } catch (err) {
      return { ok: false, message: `Falha na rede: ${err instanceof Error ? err.message : String(err)}` };
    }
  },

  async getInstanceStatus(runtime: IntegrationRuntimeConfig, env: NodeEnv): Promise<WhatsAppInstanceStatus> {
    const baseUrl = (runtime.config.baseUrl as string)?.replace(/\/$/, "");
    const apiKey = (runtime.config.apiKey as string) || env.WHATSAPP_API_KEY;
    const instance = (runtime.config.instance as string) || env.WHATSAPP_INSTANCE_ID;

    if (!baseUrl || !apiKey || !instance) {
      return { status: "ERROR", updatedAt: new Date().toISOString() };
    }

    try {
      // 1. Check current status
      const { response, body } = await timedFetch(`${baseUrl}/instance/connectionState/${instance}`, {
        headers: { "apikey": apiKey },
      });

      const res = JSON.parse(body);
      const state = res.instance?.state || res.state;

      if (state === "open" || state === "CONNECTED") {
        return { status: "CONNECTED", updatedAt: new Date().toISOString(), instanceName: instance };
      }

      // 2. If not connected, get QR code
      const { response: qrRes, body: qrBody } = await timedFetch(`${baseUrl}/instance/connect/${instance}`, {
        headers: { "apikey": apiKey },
      });
      
      const qrData = JSON.parse(qrBody);
      if (qrData.base64) {
        return { status: "QRCODE", qrcode: qrData.base64, updatedAt: new Date().toISOString() };
      }

      return { status: "DISCONNECTED", updatedAt: new Date().toISOString() };
    } catch (err) {
      console.error("[Evolution] Status Error:", err);
      return { status: "ERROR", updatedAt: new Date().toISOString() };
    }
  },

  async disconnectInstance(runtime: IntegrationRuntimeConfig, env: NodeEnv) {
    const baseUrl = (runtime.config.baseUrl as string)?.replace(/\/$/, "");
    const apiKey = (runtime.config.apiKey as string) || env.WHATSAPP_API_KEY;
    const instance = (runtime.config.instance as string) || env.WHATSAPP_INSTANCE_ID;

    try {
      const { response, body } = await timedFetch(`${baseUrl}/instance/logout/${instance}`, {
        method: "DELETE",
        headers: { "apikey": apiKey },
      });
      return { ok: response.ok, message: response.ok ? "Desconectado" : body };
    } catch (err) {
      return { ok: false, message: String(err) };
    }
  },

  async sendOtp(runtime: IntegrationRuntimeConfig, env: NodeEnv, phone: string, code: string) {
    const message = `Seu código de acesso Afidelize é: ${code}`;
    return this.sendTestMessage(runtime, env, phone, message);
  },

  async sendTestMessage(runtime: IntegrationRuntimeConfig, env: NodeEnv, phone: string, message: string) {
    const baseUrl = (runtime.config.baseUrl as string)?.replace(/\/$/, "");
    const apiKey = (runtime.config.apiKey as string) || env.WHATSAPP_API_KEY;
    const instance = (runtime.config.instance as string) || env.WHATSAPP_INSTANCE_ID;

    if (!baseUrl || !apiKey || !instance) {
      return { ok: false, message: "Configuração incompleta." };
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const headers: Record<string, string> = { 
      "apikey": apiKey,
      "Content-Type": "application/json"
    };

    try {
      const { response, body } = await timedFetch(`${baseUrl}/message/sendText/${instance}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          number: cleanPhone,
          options: { delay: 1200, presence: "composing", linkPreview: false },
          textMessage: { text: message }
        })
      });

      if (response.ok) {
        const resBody = JSON.parse(body);
        return { ok: true, message: "Mensagem enviada.", providerMessageId: resBody?.key?.id };
      }

      return { ok: false, message: `Erro no envio (${response.status}): ${body}` };
    } catch (err) {
      return { ok: false, message: `Falha ao enviar: ${err instanceof Error ? err.message : String(err)}` };
    }
  },

  parseWebhook(body: any) {
    if (body.event !== "MESSAGES_UPSERT") return null;
    const msg = body.data?.message;
    const text = msg?.conversation || msg?.extendedTextMessage?.text;
    if (!text) return null;

    return {
      remoteMessageId: body.data?.key?.id,
      fromPhone: body.data?.key?.remoteJid?.split("@")[0],
      text,
      messageType: msg?.conversation ? "text" : "other"
    };
  }
};
