import { timedFetch } from "../types";
import type { IntegrationRuntimeConfig, NodeEnv, TestConnectionResult } from "../types";
import type { WhatsAppOTPProvider } from "./base";

export const zapiOtp: WhatsAppOTPProvider = {
  meta: {
    id: "zapi",
    label: "Z-API",
    category: "otp",
    description: "Integração via Z-API para envio de mensagens via WhatsApp.",
    icon: "MessageSquare",
    fields: [
      {
        name: "instanceId",
        label: "Instance ID",
        kind: "text",
        required: true,
      },
      {
        name: "instanceToken",
        label: "Instance Token",
        kind: "text",
        required: true,
      },
      {
        name: "clientToken",
        label: "Client Token",
        kind: "password",
        required: true,
      },
    ],
  },

  async testConnection(runtime: IntegrationRuntimeConfig): Promise<TestConnectionResult> {
    const instanceId = runtime.config.instanceId as string;
    const instanceToken = runtime.config.instanceToken as string;
    const clientToken = runtime.config.clientToken as string;

    if (!instanceId || !instanceToken || !clientToken) {
      return { ok: false, message: "Configuração incompleta." };
    }

    try {
      const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}`;
      const { response, body, latency_ms } = await timedFetch(`${baseUrl}/status`, {
        headers: { "client-token": clientToken },
      });

      if (response.ok) {
        return { ok: true, message: "Conectado com sucesso.", latency_ms };
      }

      return { 
        ok: false, 
        status: response.status, 
        message: `Erro ao consultar status: ${body}`,
        latency_ms 
      };
    } catch (err) {
      return { ok: false, message: `Falha na rede: ${err instanceof Error ? err.message : String(err)}` };
    }
  },

  async sendOtp(runtime: IntegrationRuntimeConfig, env: NodeEnv, phone: string, code: string) {
    const message = `Seu código de acesso Afidelize é: ${code}`;
    return this.sendTestMessage(runtime, env, phone, message);
  },

  async sendTestMessage(runtime: IntegrationRuntimeConfig, env: NodeEnv, phone: string, message: string) {
    const instanceId = runtime.config.instanceId as string;
    const instanceToken = runtime.config.instanceToken as string;
    const clientToken = runtime.config.clientToken as string;

    if (!instanceId || !instanceToken || !clientToken) {
      return { ok: false, message: "Configuração incompleta." };
    }

    const cleanPhone = phone.replace(/\D/g, "");

    try {
      const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}`;
      const { response, body } = await timedFetch(`${baseUrl}/send-text`, {
        method: "POST",
        headers: { 
          "client-token": clientToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phone: cleanPhone,
          message: message
        })
      });

      if (response.ok) {
        return { ok: true, message: "Mensagem enviada." };
      }

      return { ok: false, message: `Erro no envio (${response.status}): ${body}` };
    } catch (err) {
      return { ok: false, message: `Falha ao enviar: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
};
