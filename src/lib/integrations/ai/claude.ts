import type { AIProvider } from "./base";
import { aiFields } from "./base";
import { timedFetch } from "../types";

export const claudeProvider: AIProvider = {
  meta: {
    id: "claude",
    label: "Anthropic Claude",
    category: "ai",
    description: "Claude 3.5 Sonnet, Haiku e Opus.",
    icon: "🧠",
    docsUrl: "https://docs.anthropic.com",
    fields: aiFields("ANTHROPIC_API_KEY", { defaultModel: "claude-3-5-sonnet-latest" }),
  },
  async testConnection(runtime, env) {
    const key = env[runtime.credentials_ref.api_key ?? "ANTHROPIC_API_KEY"];
    if (!key) return { ok: false, message: "API Key não configurada." };
    const baseUrl = String(runtime.config.base_url || "https://api.anthropic.com").replace(/\/+$/, "");
    const timeoutMs = Number(runtime.config.timeout_ms) || 15000;
    const model = String(runtime.config.default_model || "claude-3-5-haiku-latest");
    try {
      const { response, body, latency_ms } = await timedFetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
        timeoutMs,
      });
      return {
        ok: response.ok,
        status: response.status,
        latency_ms,
        message: response.ok ? "Conectado com sucesso ao Anthropic Claude." : (body || `HTTP ${response.status}`),
      };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? String(e) };
    }
  },
};
