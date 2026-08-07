import { timedFetch } from "../types";
import type { IntegrationRuntimeConfig, NodeEnv, TestConnectionResult } from "../types";
import type { WhatsAppOTPProvider } from "./base";

export const uazapiOtp: WhatsAppOTPProvider = {
  meta: {
    id: "uazapi",
    label: "UAZAPI",
    category: "otp",
    description: "Integração via UAZAPI para envio de mensagens via WhatsApp.",
    icon: "MessageSquare",
    fields: [
      {
        name: "baseUrl",
        label: "Servidor / Base URL",
        kind: "url",
        required: true,
        placeholder: "https://api.uazapi.com",
      },
      {
        name: "token",
        label: "Token da Instância",
        kind: "password",
        required: true,
      },
    ],
  },

  async testConnection(runtime: IntegrationRuntimeConfig): Promise<TestConnectionResult> {
    const baseUrl = (runtime.config.baseUrl as string)?.replace(/\/$/, "");
    const token = (runtime.config.token as string);

    if (!baseUrl || !token) {
      return { ok: false, message: "Configuração incompleta (Base URL ou Token ausente)." };
    }

    try {
      const { response, body, latency_ms } = await timedFetch(`${baseUrl}/instance/status`, {
        headers: { "token": token },
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
    const baseUrl = (runtime.config.baseUrl as string)?.replace(/\/$/, "");
    const token = (runtime.config.token as string);

    if (!baseUrl || !token) {
      return { ok: false, message: "Configuração incompleta." };
    }

    const cleanPhone = phone.replace(/\D/g, "");

    try {
      const { response, body } = await timedFetch(`${baseUrl}/message/sendText`, {
        method: "POST",
        headers: { 
          "token": token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: message
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
