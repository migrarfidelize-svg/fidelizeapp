import type { AIProvider } from "./base";
import { aiFields } from "./base";
import { timedFetch } from "../types";

export const geminiProvider: AIProvider = {
  meta: {
    id: "gemini",
    label: "Google Gemini",
    category: "ai",
    description: "Gemini 1.5/2.0 (Google AI Studio).",
    icon: "✨",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    fields: aiFields("GEMINI_API_KEY", { defaultModel: "gemini-2.0-flash" }),
  },
  async testConnection(runtime, env) {
    const key = env[runtime.credentials_ref.api_key ?? "GEMINI_API_KEY"];
    if (!key) return { ok: false, message: "API Key não configurada." };
    const baseUrl = String(runtime.config.base_url || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
    const timeoutMs = Number(runtime.config.timeout_ms) || 15000;
    try {
      const { response, body, latency_ms } = await timedFetch(`${baseUrl}/v1beta/models?key=${encodeURIComponent(key)}`, { timeoutMs });
      return {
        ok: response.ok,
        status: response.status,
        latency_ms,
        message: response.ok ? "Conectado com sucesso ao Google Gemini." : (body || `HTTP ${response.status}`),
      };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? String(e) };
    }
  },
};
