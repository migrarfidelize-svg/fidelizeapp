import type { AIProvider } from "./base";
import { aiFields } from "./base";
import { timedFetch } from "../types";

export const openaiProvider: AIProvider = {
  meta: {
    id: "openai",
    label: "OpenAI",
    category: "ai",
    description: "GPT-4o, GPT-5, o-series, embeddings e imagens.",
    icon: "🤖",
    docsUrl: "https://platform.openai.com/docs",
    fields: aiFields("OPENAI_API_KEY", { orgField: true, defaultModel: "gpt-4o-mini" }),
  },
  async testConnection(runtime, env) {
    const key = env[runtime.credentials_ref.api_key ?? "OPENAI_API_KEY"];
    if (!key) return { ok: false, message: "API Key não configurada. Salve o secret indicado antes de testar." };
    const baseUrl = String(runtime.config.base_url || "https://api.openai.com").replace(/\/+$/, "");
    const org = runtime.config.organization ? String(runtime.config.organization) : undefined;
    const timeoutMs = Number(runtime.config.timeout_ms) || 15000;
    try {
      const { response, body, latency_ms } = await timedFetch(`${baseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${key}`, ...(org ? { "OpenAI-Organization": org } : {}) },
        timeoutMs,
      });
      return {
        ok: response.ok,
        status: response.status,
        latency_ms,
        message: response.ok ? "Conectado com sucesso à OpenAI." : (body || `HTTP ${response.status}`),
      };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? String(e) };
    }
  },
};
