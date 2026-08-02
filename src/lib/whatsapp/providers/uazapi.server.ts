import type {
  InstanceRef, InstanceState, NormalizedInbound, OutboundMessage,
  ProviderRuntime, SendResult, TestResult, WhatsAppProvider, WhatsAppConnectionStatus,
} from "../types";
import { normalizePhone } from "../types";

/**
 * Implementação Uazapi.
 * Autenticação: `admintoken` para operações de conta, `token` para a instância.
 * Nenhum erro é silenciado — a mensagem crua do provedor sobe para o painel.
 */

async function call(
  rt: ProviderRuntime,
  path: string,
  init: { method?: string; body?: unknown; token?: string; adminToken?: boolean } = {},
): Promise<{ status: number; json: any; text: string; latency_ms: number }> {
  const base = rt.baseUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.adminToken) headers["admintoken"] = rt.adminToken;
  if (init.token) headers["token"] = init.token;

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${base}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { status: res.status, json, text, latency_ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

function mapStatus(raw: string | undefined | null): WhatsAppConnectionStatus {
  const s = (raw || "").toLowerCase();
  if (["connected", "open", "online"].includes(s)) return "connected";
  if (["connecting", "syncing", "loading"].includes(s)) return "connecting";
  if (["qrcode", "qr", "pairing", "close_qr"].includes(s)) return "qr_pending";
  if (["disconnected", "closed", "close"].includes(s)) return "disconnected";
  return s ? "error" : "disconnected";
}

function stateFrom(json: any): InstanceState {
  const inst = json?.instance ?? json ?? {};
  const qr = inst.qrcode ?? json?.qrcode ?? inst.qrCode ?? null;
  return {
    status: mapStatus(inst.status ?? json?.status),
    connectedPhone: inst.owner ?? inst.phone ?? inst.wid ?? null,
    qrCode: qr ? (String(qr).startsWith("data:") ? String(qr) : `data:image/png;base64,${qr}`) : null,
    raw: json,
  };
}

export const uazapiProvider: WhatsAppProvider = {
  id: "uazapi",
  label: "Uazapi",

  async testConnection(rt): Promise<TestResult> {
    if (!rt.baseUrl) return { ok: false, message: "URL base não configurada." };
    if (!rt.adminToken) return { ok: false, message: "Token administrativo não configurado." };
    const r = await call(rt, "/instance/all", { adminToken: true });
    const ok = r.status >= 200 && r.status < 300;
    return {
      ok,
      status: r.status,
      latency_ms: r.latency_ms,
      message: ok
        ? `Conexão OK (${r.status}) em ${r.latency_ms}ms.`
        : `Falha (${r.status}): ${r.text.slice(0, 300) || "sem corpo na resposta"}`,
    };
  },

  async createInstance(rt, name): Promise<InstanceRef> {
    const r = await call(rt, "/instance/init", { method: "POST", adminToken: true, body: { name } });
    if (r.status < 200 || r.status >= 300) {
      throw new Error(`Uazapi /instance/init (${r.status}): ${r.text.slice(0, 300)}`);
    }
    const token = r.json?.token ?? r.json?.instance?.token;
    const id = r.json?.instance?.id ?? r.json?.instance?.name ?? r.json?.id ?? name;
    if (!token) throw new Error(`Uazapi não devolveu token da instância: ${r.text.slice(0, 300)}`);
    return { externalInstanceId: String(id), instanceToken: String(token) };
  },

  async connect(rt, ref): Promise<InstanceState> {
    const r = await call(rt, "/instance/connect", { method: "POST", token: ref.instanceToken, body: {} });
    if (r.status < 200 || r.status >= 300) {
      throw new Error(`Uazapi /instance/connect (${r.status}): ${r.text.slice(0, 300)}`);
    }
    const st = stateFrom(r.json);
    if (!st.qrCode && st.status !== "connected") st.status = "connecting";
    else if (st.qrCode && st.status !== "connected") st.status = "qr_pending";
    return st;
  },

  async getState(rt, ref): Promise<InstanceState> {
    const r = await call(rt, "/instance/status", { token: ref.instanceToken });
    if (r.status < 200 || r.status >= 300) {
      return { status: "error", raw: r.text.slice(0, 300) };
    }
    return stateFrom(r.json);
  },

  async disconnect(rt, ref): Promise<void> {
    await call(rt, "/instance/disconnect", { method: "POST", token: ref.instanceToken, body: {} });
  },

  async deleteInstance(rt, ref): Promise<void> {
    await call(rt, "/instance", { method: "DELETE", token: ref.instanceToken, adminToken: true });
  },

  async setWebhook(rt, ref, url): Promise<void> {
    const r = await call(rt, "/webhook", {
      method: "POST",
      token: ref.instanceToken,
      body: {
        enabled: true,
        url,
        events: ["messages", "messages_update", "connection"],
        excludeMessages: ["wasSentByApi"],
      },
    });
    if (r.status < 200 || r.status >= 300) {
      throw new Error(`Uazapi /webhook (${r.status}): ${r.text.slice(0, 300)}`);
    }
  },

  async sendText(rt, ref, msg: OutboundMessage): Promise<SendResult> {
    const r = await call(rt, "/send/text", {
      method: "POST",
      token: ref.instanceToken,
      body: { number: normalizePhone(msg.to), text: msg.text },
    });
    if (r.status < 200 || r.status >= 300) {
      throw new Error(`Uazapi /send/text (${r.status}): ${r.text.slice(0, 300)}`);
    }
    const id = r.json?.messageid ?? r.json?.id ?? r.json?.key?.id ?? null;
    return { externalMessageId: id ? String(id) : null, raw: r.json };
  },

  parseWebhook(payload: unknown): NormalizedInbound | null {
    const p = payload as any;
    if (!p || typeof p !== "object") return null;

    const eventType = String(p.EventType ?? p.event ?? p.type ?? "message");
    const m = p.message ?? p.data ?? p;
    if (!m || typeof m !== "object") return null;

    const chatId = m.chatid ?? m.chatId ?? m.key?.remoteJid ?? null;
    const fromMe = Boolean(m.fromMe ?? m.key?.fromMe ?? false);
    const phoneSource = m.sender ?? m.from ?? chatId ?? "";
    const fromPhone = String(phoneSource).split("@")[0]?.replace(/\D+/g, "") || null;

    const body =
      m.text ??
      m.content ??
      m.body ??
      m.message?.conversation ??
      m.message?.extendedTextMessage?.text ??
      "";

    const mediaUrl = m.mediaUrl ?? m.fileURL ?? m.url ?? null;
    const rawType = String(m.messageType ?? m.type ?? "text").toLowerCase();
    const messageType = rawType.includes("image")
      ? "image"
      : rawType.includes("audio") || rawType.includes("ptt")
        ? "audio"
        : rawType.includes("video")
          ? "video"
          : rawType.includes("document")
            ? "document"
            : "text";

    return {
      externalInstanceId: String(p.instance_id ?? p.instance ?? p.token ?? "") || null,
      externalMessageId: String(m.messageid ?? m.id ?? m.key?.id ?? "") || null,
      fromPhone,
      contactName: m.senderName ?? m.pushName ?? m.notifyName ?? null,
      chatId: chatId ? String(chatId) : null,
      body: typeof body === "string" ? body : JSON.stringify(body),
      messageType,
      mediaUrl: mediaUrl ? String(mediaUrl) : null,
      fromMe,
      eventType,
    };
  },
};
