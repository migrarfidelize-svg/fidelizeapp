import { timedFetch } from "../types";
import type { IntegrationRuntimeConfig, NodeEnv, TestConnectionResult } from "../types";
import type { WhatsAppOTPProvider, WhatsAppInstanceStatus } from "./base";
 
function resolveUazapiToken(
  runtime: IntegrationRuntimeConfig,
  env: NodeEnv
): string {
  const candidates = [
    runtime.db_credentials?.token,
    runtime.config?.token,
    env["UAZAPI_TOKEN"],
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;

    const value = candidate.trim();

    if (!value) continue;

    if (
      value.includes("••") ||
      value.includes("***") ||
      /^x+$/i.test(value) ||
      value.toLowerCase().includes("masked")
    ) {
      continue;
    }

    return value;
  }

  return "";
}

function isUazapiConnected(payload: any): boolean {
  if (payload?.status?.connected === true) return true;
  if (payload?.connected === true) return true;

  const state =
    payload?.state ||
    payload?.status ||
    payload?.instance?.state ||
    payload?.instance?.status ||
    "";

  return String(state).toLowerCase() === "connected";
}


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
    const token = resolveUazapiToken(runtime, env);
 
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
    const token = resolveUazapiToken(runtime, env);
 
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
      
      const isConnected = isUazapiConnected(res);

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
    const token = resolveUazapiToken(runtime, env);
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
    const token = resolveUazapiToken(runtime, env);
 
    if (!baseUrl || !token) {
      return { ok: false, message: "Configuração incompleta (Base URL ou Token ausente)." };
    }

    // Normalização rigorosa para UAZAPI (Brasil: 55 + DDD + Numero, somente dígitos)
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length > 0 && !cleanPhone.startsWith("55") && cleanPhone.length <= 11) {
      cleanPhone = "55" + cleanPhone;
    }

    try {
      // Sanitized log for debugging
      console.log("[UAZAPI] Sending message", {
        endpoint: "/send/text",
        tokenPresent: Boolean(token),
        phonePresent: Boolean(cleanPhone),
      });

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
      
      // Sanitized log for debugging
      console.log(`[UAZAPI] Response ${response.status}:`, {
        keys: Object.keys(resBody),
        hasMessageId: !!(resBody.messageId || resBody.messageid || resBody.data?.messageId || resBody.data?.messageid),
        hasKeyId: !!(resBody.key?.id || resBody.data?.key?.id),
        hasId: !!resBody.id,
        hasError: !!(resBody.error || resBody.status === "error")
      });

      // Unified Message ID Parser (v1, v2 and variants)
      const providerMessageId = 
        resBody?.messageId || 
        resBody?.messageid || 
        resBody?.data?.messageId || 
        resBody?.data?.messageid || 
        resBody?.key?.id || 
        resBody?.data?.key?.id || 
        resBody?.id ||
        resBody?.data?.id;
      
      const hasError = resBody.error || resBody.status === "error" || resBody.message === "error";

      // If HTTP 2xx and no explicit error in body, it's a success
      if (response.ok && !hasError) {
        return { 
          ok: true, 
          message: "Mensagem aceita pela UAZAPI.", 
          providerMessageId: providerMessageId || null,
          httpStatus: response.status,
          providerResponse: resBody
        };
      }

      return { 
        ok: false, 
        httpStatus: response.status,
        message: resBody.message || resBody.error || resBody.reason || `Erro UAZAPI ${response.status}`,
        providerResponse: resBody
      };
    } catch (err) {
      return { ok: false, message: `Falha técnica: ${err instanceof Error ? err.message : String(err)}` };
    }
  },

  parseWebhook(body: any) {
    if (!body || typeof body !== "object") {
      return null;
    }

    /*
     * UAZAPI possui mais de uma forma de payload dependendo
     * da versão/evento configurado.
     *
     * Não restringir exclusivamente a "messages.upsert".
     */

    const root =
      body?.data && typeof body.data === "object"
        ? body.data
        : body;

    const msg =
      body?.message && typeof body.message === "object"
        ? body.message
        : root?.message && typeof root.message === "object"
          ? root.message
          : root;

    const baileysMessage =
      msg?.message && typeof msg.message === "object"
        ? msg.message
        : {};

    const key =
      msg?.key ||
      root?.key ||
      body?.key ||
      {};

    // Nunca transformar mensagem enviada pelo próprio número
    // em atendimento recebido.
    const fromMe = Boolean(
      msg?.from_me ??
      msg?.fromMe ??
      root?.from_me ??
      root?.fromMe ??
      body?.from_me ??
      body?.fromMe ??
      key?.fromMe ??
      false
    );

    if (fromMe) {
      return null;
    }

    const rawChat =
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

    if (!rawChat) {
      return null;
    }

    const rawChatString = String(rawChat);

    // CRM não deve transformar grupo em cliente individual.
    if (
      rawChatString.includes("@g.us") ||
      msg?.isGroup === true ||
      root?.isGroup === true ||
      body?.isGroup === true
    ) {
      return null;
    }

    const fromPhone = rawChatString
      .split("@")[0]
      .replace(/\D/g, "");

    if (!fromPhone) {
      return null;
    }

    const possibleTexts = [
      msg?.text,
      msg?.body,
      typeof msg?.content === "string"
        ? msg.content
        : undefined,

      baileysMessage?.conversation,
      baileysMessage?.extendedTextMessage?.text,

      root?.text,
      root?.body,
      typeof root?.content === "string"
        ? root.content
        : undefined,

      body?.text,
      body?.body,
      typeof body?.content === "string"
        ? body.content
        : undefined,
    ];

    const text =
      possibleTexts.find(
        (value) =>
          typeof value === "string" &&
          value.trim().length > 0
      )?.trim() || "";

    const remoteMessageId = String(
      msg?.messageid ||
      msg?.messageId ||
      msg?.id ||
      key?.id ||
      root?.messageid ||
      root?.messageId ||
      root?.id ||
      body?.messageid ||
      body?.messageId ||
      body?.id ||
      ""
    ).trim();

    /*
     * Sem ID não persistimos porque crm_messages utiliza
     * provider_message_id para idempotência.
     */
    if (!remoteMessageId) {
      return null;
    }

    const pushName =
      msg?.sender_name ||
      msg?.senderName ||
      msg?.pushName ||
      root?.sender_name ||
      root?.senderName ||
      root?.pushName ||
      body?.sender_name ||
      body?.senderName ||
      body?.pushName ||
      undefined;

    const rawType =
      msg?.type ||
      msg?.messageType ||
      root?.type ||
      root?.messageType ||
      body?.type ||
      body?.messageType ||
      (text ? "text" : "other");

    const messageType =
      String(rawType).toLowerCase();

    const mediaUrl =
      msg?.mediaUrl ||
      msg?.media_url ||
      msg?.url ||
      root?.mediaUrl ||
      root?.media_url ||
      undefined;

    return {
      remoteMessageId,
      fromPhone,
      text,
      pushName:
        typeof pushName === "string"
          ? pushName
          : undefined,
      messageType,
      mediaUrl:
        typeof mediaUrl === "string"
          ? mediaUrl
          : undefined,
    };
  }
};
