import type { IntegrationProvider, IntegrationRuntimeConfig, NodeEnv } from "../types";

export interface WhatsAppOTPProvider extends IntegrationProvider {
  sendOtp(runtime: IntegrationRuntimeConfig, env: NodeEnv, phone: string, code: string): Promise<{ ok: boolean; message: string }>;
  sendTestMessage(runtime: IntegrationRuntimeConfig, env: NodeEnv, phone: string, message: string): Promise<{ ok: boolean; message: string; providerMessageId?: string }>;
  /** Normaliza o payload de entrada do webhook para o formato interno */
  parseWebhook?(body: any, headers: Record<string, string>): { remoteMessageId: string; fromPhone: string; text: string; messageType?: string; mediaUrl?: string } | null;
}
