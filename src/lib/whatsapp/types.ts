/**
 * Contrato de provedor de WhatsApp (padrão Strategy).
 * A Uazapi é a primeira implementação; Z-API/Meta podem entrar sem tocar na UI.
 */

export type WhatsAppConnectionStatus =
  | "disconnected"
  | "connecting"
  | "qr_pending"
  | "connected"
  | "error";

export interface ProviderRuntime {
  /** URL base da API do provedor (ex.: https://free.uazapi.com). */
  baseUrl: string;
  /** Token administrativo da conta (cria/remove instâncias). */
  adminToken: string;
  mode: "sandbox" | "production";
}

export interface InstanceRef {
  externalInstanceId: string;
  instanceToken: string;
}

export interface InstanceState {
  status: WhatsAppConnectionStatus;
  connectedPhone?: string | null;
  qrCode?: string | null;
  raw?: unknown;
}

export interface OutboundMessage {
  to: string;
  text: string;
}

export interface SendResult {
  externalMessageId: string | null;
  raw?: unknown;
}

export interface NormalizedInbound {
  externalInstanceId: string | null;
  externalMessageId: string | null;
  fromPhone: string | null;
  contactName: string | null;
  chatId: string | null;
  body: string;
  messageType: string;
  mediaUrl: string | null;
  fromMe: boolean;
  eventType: string;
}

export interface TestResult {
  ok: boolean;
  status?: number;
  latency_ms?: number;
  message: string;
}

export interface WhatsAppProvider {
  id: string;
  label: string;
  testConnection(rt: ProviderRuntime): Promise<TestResult>;
  createInstance(rt: ProviderRuntime, name: string): Promise<InstanceRef>;
  /** Inicia o pareamento e devolve o QR (base64/data-url) quando disponível. */
  connect(rt: ProviderRuntime, ref: InstanceRef): Promise<InstanceState>;
  getState(rt: ProviderRuntime, ref: InstanceRef): Promise<InstanceState>;
  disconnect(rt: ProviderRuntime, ref: InstanceRef): Promise<void>;
  deleteInstance(rt: ProviderRuntime, ref: InstanceRef): Promise<void>;
  setWebhook(rt: ProviderRuntime, ref: InstanceRef, url: string): Promise<void>;
  sendText(rt: ProviderRuntime, ref: InstanceRef, msg: OutboundMessage): Promise<SendResult>;
  parseWebhook(payload: unknown): NormalizedInbound | null;
}

/** Normaliza telefone para o formato E.164 sem "+" (padrão dos provedores). */
export function normalizePhone(input: string): string {
  const digits = (input || "").replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.length <= 11 && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}
