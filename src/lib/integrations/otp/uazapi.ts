import { timedFetch } from "../types";
import type { IntegrationRuntimeConfig, NodeEnv, TestConnectionResult } from "../types";
import type { WhatsAppOTPProvider, WhatsAppInstanceStatus } from "./base";

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

  async testConnection(runtime: IntegrationRuntimeConfig, env: NodeEnv): Promise<TestConnectionResult> {
    const baseUrl = (runtime.config.baseUrl as string)?.replace(/\/$/, "");
    const token = (runtime.config.token as string) || (runtime.db_credentials?.token as string) || (env["UAZAPI_TOKEN"] as string);

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

  async getInstanceStatus(runtime: IntegrationRuntimeConfig, env: NodeEnv): Promise<WhatsAppInstanceStatus> {
    const baseUrl = (runtime.config.baseUrl as string)?.replace(/\/$/, "");
    const token = (runtime.db_credentials?.token as string) || (runtime.config.token as string) || (env["UAZAPI_TOKEN"] as string);

    if (!baseUrl || !token) {
      console.error("[UAZAPI] Status Error: Missing baseUrl or token", { baseUrl, tokenPresent: !!token });
      return { status: "ERROR", updatedAt: new Date().toISOString() };
    }

    try {
      const { response, body } = await timedFetch(`${baseUrl}/instance/status`, {
        headers: { "token": token },
      });
      
      if (!response.ok) {
        console.error(`[UAZAPI] Status HTTP Error ${response.status}:`, body);
        return { status: "ERROR", updatedAt: new Date().toISOString() };
      }

      const res = JSON.parse(body);
      const instanceName = res.instance?.name || res.instanceName || "WhatsApp";
      
      // UAZAPI disconnected is NOT a communication error (HTTP 200)
      const isConnected = res.status === "CONNECTED" || res.state === "CONNECTED" || res.status?.connected === true;

      if (isConnected) {
        return { 
          status: "CONNECTED", 
          instanceName,
          updatedAt: new Date().toISOString() 
        };
      }

      // If disconnected, try to get QR
      try {
        const { response: qrRes, body: qrBody } = await timedFetch(`${baseUrl}/instance/connect`, {
          headers: { "token": token },
        });
        if (qrRes.ok) {
          const qrData = JSON.parse(qrBody);
          if (qrData.base64) {
            return { 
              status: "QRCODE", 
              qrcode: qrData.base64, 
              instanceName,
              updatedAt: new Date().toISOString() 
            };
          }
        }
      } catch (qrErr) {
        console.warn("[UAZAPI] Failed to fetch QR code:", qrErr);
      }

      return { 
        status: "DISCONNECTED", 
        instanceName,
        updatedAt: new Date().toISOString() 
      };
    } catch (err) {
      console.error("[UAZAPI] Runtime Status Error:", err);
      return { status: "ERROR", updatedAt: new Date().toISOString() };
    }
  },

  async disconnectInstance(runtime: IntegrationRuntimeConfig, env: NodeEnv) {
    const baseUrl = (runtime.config.baseUrl as string)?.replace(/\/$/, "");
    const token = (runtime.config.token as string) || (runtime.db_credentials?.token as string) || (env["UAZAPI_TOKEN"] as string);
    if (!baseUrl || !token) return { ok: false, message: "Configuração incompleta." };

    try {
      const { response, body } = await timedFetch(`${baseUrl}/instance/logout`, {
        method: "DELETE",
        headers: { "token": token },
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
    const token = (runtime.db_credentials?.token as string) || (runtime.config.token as string) || (env["UAZAPI_TOKEN"] as string);

    if (!baseUrl || !token) {
      return { ok: false, message: "Configuração incompleta (Base URL ou Token ausente)." };
    }

    // Normalização rigorosa para UAZAPI (Brasil: 55 + DDD + Numero, somente dígitos)
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length > 0 && !cleanPhone.startsWith("55") && cleanPhone.length <= 11) {
      cleanPhone = "55" + cleanPhone;
    }

    try {
      // 1. Verificar status da instância antes de enviar
      const { response: statusRes, body: statusBody } = await timedFetch(`${baseUrl}/instance/status`, {
        headers: { "token": token },
      });

      let isConnected = false;
      if (statusRes.ok) {
        const s = JSON.parse(statusBody);
        isConnected = s.status === "CONNECTED" || s.state === "CONNECTED" || s.status?.connected === true || s.instance?.status === "CONNECTED";
      }

      if (!isConnected) {
        return { 
          ok: false, 
          message: "WhatsApp desconectado. Conecte a instância antes de enviar mensagens.",
          status: "DISCONNECTED"
        };
      }

      // 2. Envio Real
      const { response, body } = await timedFetch(`${baseUrl}/send/text`, {
        method: "POST",
        headers: { 
          "token": token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: message,
          linkPreview: false
        })
      });

      const resBody = JSON.parse(body || "{}");
      const providerMessageId = resBody?.data?.key?.id || resBody?.key?.id || resBody?.messageId;
      
      // UAZAPI pode retornar 200/201 mas com erro no body em alguns cenários
      const hasError = resBody.error || resBody.status === "error" || resBody.message === "error";

      if (response.ok && providerMessageId && !hasError) {
        return { 
          ok: true, 
          message: "Mensagem enviada com sucesso.", 
          providerMessageId,
          httpStatus: response.status,
          providerResponse: resBody
        };
      }

      return { 
        ok: false, 
        httpStatus: response.status,
        message: resBody.message || resBody.error || `Erro UAZAPI ${response.status}`,
        providerResponse: resBody
      };
    } catch (err) {
      return { ok: false, message: `Falha técnica: ${err instanceof Error ? err.message : String(err)}` };
    }
  },

  parseWebhook(body: any) {
    if (body.event !== "messages.upsert") return null;
    const msg = body.data;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (!text) return null;

    return {
      remoteMessageId: msg.key?.id,
      fromPhone: msg.key?.remoteJid?.split("@")[0],
      text,
      messageType: msg.message?.conversation ? "text" : "other"
    };
  }
};
