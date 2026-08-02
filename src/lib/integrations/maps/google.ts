import { timedFetch } from "../types";
import type { IntegrationProvider, IntegrationProviderMeta, NodeEnv, TestConnectionResult } from "../types";

export type MapsProviderMeta = IntegrationProviderMeta & { category: "other" };
export type MapsProvider = IntegrationProvider & { meta: MapsProviderMeta };

export const GOOGLE_MAPS_SERVER_KEY_ENV = "GOOGLE_MAPS_SERVER_KEY";
export const GOOGLE_MAPS_BROWSER_KEY_ENV = "GOOGLE_MAPS_BROWSER_KEY";

export const ROUTES_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";

/**
 * Google Maps Platform — usado para calcular a rota real (ruas, sentido de via
 * e trânsito) entre coleta e entrega no app do entregador.
 *
 * A chave de servidor é gravada apenas no backend (tabela `integrations`).
 */
export const googleMapsProvider: MapsProvider = {
  meta: {
    id: "google_maps",
    label: "Google Maps Platform",
    category: "other",
    description:
      "Rotas reais por ruas (Routes API) e geocodificação de endereços para o app do entregador e o acompanhamento do lojista.",
    docsUrl: "https://developers.google.com/maps/documentation/routes",
    supportsMode: false,
    fields: [
      {
        name: "api_key",
        label: "Chave de servidor (Routes + Geocoding)",
        kind: "password",
        required: true,
        placeholder: "AIza...",
        helpText:
          "Google Cloud → APIs e Serviços → Credenciais. Restrinja por endereço IP (NUNCA por referenciador HTTP) e libere Routes API + Geocoding API.",
        secretName: GOOGLE_MAPS_SERVER_KEY_ENV,
      },
      {
        name: "browser_key",
        label: "Chave de navegador (opcional)",
        kind: "password",
        required: false,
        placeholder: "AIza...",
        helpText:
          "Somente se você quiser exibir o mapa oficial do Google no navegador. Restrinja por referenciador HTTP (seu domínio).",
        secretName: GOOGLE_MAPS_BROWSER_KEY_ENV,
      },
      {
        name: "region",
        label: "Região preferencial",
        kind: "text",
        required: false,
        defaultValue: "br",
        placeholder: "br",
        helpText: "Código de país ISO usado para desempatar endereços ambíguos.",
      },
      {
        name: "travel_mode",
        label: "Modal padrão",
        kind: "select",
        required: false,
        defaultValue: "TWO_WHEELER",
        options: [
          { value: "TWO_WHEELER", label: "Moto (TWO_WHEELER)" },
          { value: "DRIVE", label: "Carro (DRIVE)" },
          { value: "BICYCLE", label: "Bicicleta (BICYCLE)" },
        ],
        helpText: "Moto respeita as regras de via para motocicletas onde o Google tem cobertura.",
      },
    ],
  },

  async testConnection(runtime, env: NodeEnv): Promise<TestConnectionResult> {
    const key = env[runtime.credentials_ref.api_key ?? GOOGLE_MAPS_SERVER_KEY_ENV];
    if (!key) {
      return { ok: false, message: "Chave de servidor ausente. Cole a chave no campo acima e salve." };
    }

    // Rota curta real na Av. Paulista (SP) — valida chave, faturamento e APIs liberadas.
    const body = {
      origin: { location: { latLng: { latitude: -23.5615, longitude: -46.6559 } } },
      destination: { location: { latLng: { latitude: -23.5738, longitude: -46.6432 } } },
      travelMode: String(runtime.config.travel_mode ?? "DRIVE"),
      routingPreference: "TRAFFIC_AWARE",
      regionCode: String(runtime.config.region ?? "br").toUpperCase(),
    };

    const { response, body: raw, latency_ms } = await timedFetch(ROUTES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify(body),
    });

    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch { /* resposta não-JSON */ }

    if (!response.ok) {
      const providerMsg = parsed?.error?.message ?? raw.slice(0, 400);
      const reason = parsed?.error?.details?.find((d: any) => d?.reason)?.reason ?? null;
      let hint = "";
      if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
        hint = " — esta chave está restrita por referenciador HTTP. Chamadas de servidor não enviam referer: mude a restrição para 'Nenhuma' ou 'Endereços IP'.";
      } else if (reason === "API_KEY_SERVICE_BLOCKED" || /not enabled|has not been used/i.test(String(providerMsg))) {
        hint = " — habilite a Routes API no projeto do Google Cloud e libere-a na lista de APIs permitidas da chave.";
      } else if (response.status === 403) {
        hint = " — verifique o faturamento do projeto no Google Cloud e as restrições da chave.";
      }
      return {
        ok: false,
        status: response.status,
        latency_ms,
        message: `${providerMsg}${hint}`,
        details: { endpoint: ROUTES_ENDPOINT, reason },
      };
    }

    const route = parsed?.routes?.[0];
    if (!route) {
      return {
        ok: false,
        status: response.status,
        latency_ms,
        message: "A API respondeu 200 mas não retornou nenhuma rota. Verifique o FieldMask e o modal selecionado.",
        details: { endpoint: ROUTES_ENDPOINT },
      };
    }

    const km = (Number(route.distanceMeters ?? 0) / 1000).toFixed(2);
    return {
      ok: true,
      status: response.status,
      latency_ms,
      message: `Conectado. Rota de teste calculada: ${km} km · ${route.duration ?? "?"}.`,
      details: { endpoint: ROUTES_ENDPOINT, distance_km: km, duration: String(route.duration ?? "") },
    };
  },
};
