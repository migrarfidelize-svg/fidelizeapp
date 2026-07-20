import type { AIProvider } from "./base";
import { aiFields } from "./base";
import { timedFetch } from "../types";

export const deepseekProvider: AIProvider = {
  meta: {
    id: "deepseek",
    label: "DeepSeek",
    category: "ai",
    description: "DeepSeek Chat e Coder (API compatível com OpenAI).",
    icon: "🐋",
    docsUrl: "https://api-docs.deepseek.com",
    fields: aiFields("DEEPSEEK_API_KEY", { defaultModel: "deepseek-chat" }),
  },
  async testConnection(runtime, env) {
    const key = env[runtime.credentials_ref.api_key ?? "DEEPSEEK_API_KEY"];
    if (!key) return { ok: false, message: "API Key não configurada." };
    const baseUrl = String(runtime.config.base_url || "https://api.deepseek.com").replace(/\/+$/, "");
    const timeoutMs = Number(runtime.config.timeout_ms) || 15000;
    try {
      const { response, body, latency_ms } = await timedFetch(`${baseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${key}` },
        timeoutMs,
      });
      return {
        ok: response.ok,
        status: response.status,
        latency_ms,
        message: response.ok ? "Conectado com sucesso ao DeepSeek." : (body || `HTTP ${response.status}`),
      };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? String(e) };
    }
  },
};
