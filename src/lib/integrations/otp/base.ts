import type { IntegrationProvider, IntegrationRuntimeConfig, NodeEnv, TestConnectionResult } from "../types";

export interface WhatsAppOTPProvider extends IntegrationProvider {
  sendOtp(runtime: IntegrationRuntimeConfig, env: NodeEnv, phone: string, code: string): Promise<{ ok: boolean; message: string }>;
  sendTestMessage(runtime: IntegrationRuntimeConfig, env: NodeEnv, phone: string, message: string): Promise<{ ok: boolean; message: string }>;
}
