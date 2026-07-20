import type { AIProvider } from "./base";
import { aiFields } from "./base";
import { timedFetch } from "../types";

export const grokProvider: AIProvider = {
  meta: {
    id: "grok",
    label: "xAI Grok",
    category: "ai",
    description: "Grok da xAI (API compatível com OpenAI).",
    icon: "⚡",
    docsUrl: "https://docs.x.ai",
    fields: aiFields("XAI_API_KEY", { defaultModel: "grok-2-latest" }),
  },
  async testConnection(runtime, env) {
    const key = env[runtime.credentials_ref.api_key ?? "XAI_API_KEY"];
    if (!key) return { ok: false, message: "API Key não configurada." };
    const baseUrl = String(runtime.config.base_url || "https://api.x.ai").replace(/\/+$/, "");
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
        message: response.ok ? "Conectado com sucesso ao xAI Grok." : (body || `HTTP ${response.status}`),
      };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? String(e) };
    }
  },
};
