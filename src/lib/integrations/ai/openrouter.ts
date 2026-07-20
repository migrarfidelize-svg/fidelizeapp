import type { AIProvider } from "./base";
import { aiFields } from "./base";
import { timedFetch } from "../types";

export const openrouterProvider: AIProvider = {
  meta: {
    id: "openrouter",
    label: "OpenRouter",
    category: "ai",
    description: "Roteador universal para dezenas de LLMs (API compatível com OpenAI).",
    icon: "🛰️",
    docsUrl: "https://openrouter.ai/docs",
    fields: aiFields("OPENROUTER_API_KEY", { defaultModel: "openai/gpt-4o-mini" }),
  },
  async testConnection(runtime, env) {
    const key = env[runtime.credentials_ref.api_key ?? "OPENROUTER_API_KEY"];
    if (!key) return { ok: false, message: "API Key não configurada." };
    const baseUrl = String(runtime.config.base_url || "https://openrouter.ai/api").replace(/\/+$/, "");
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
        message: response.ok ? "Conectado com sucesso ao OpenRouter." : (body || `HTTP ${response.status}`),
      };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? String(e) };
    }
  },
};
