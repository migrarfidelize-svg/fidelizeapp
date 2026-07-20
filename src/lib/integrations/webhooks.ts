/**
 * Catálogo central de webhooks/endpoints públicos do sistema.
 * URLs são resolvidas no servidor (getPublicAppUrl) e enviadas prontas ao cliente.
 */
import { getPublicAppUrl } from "@/lib/app-url";

export type WebhookEntry = {
  id: string;
  provider: string;         // "mercadopago" | "stripe" | "asaas" | "openai" | ...
  category: "payments" | "ai" | "system";
  label: string;            // "Notificações de pagamento (IPN)"
  path: string;             // "/api/public/webhooks/mercadopago"
  methods: string[];        // ["POST"]
  description: string;
  configurable_in?: string; // "/admin/pagamentos"
};

export const WEBHOOK_CATALOG: WebhookEntry[] = [
  // Mercado Pago
  {
    id: "mp-webhook",
    provider: "mercadopago",
    category: "payments",
    label: "Notificações unificadas (payments/orders/preapproval)",
    path: "/api/public/webhooks/mercadopago",
    methods: ["POST"],
    description:
      "Endpoint único aceito pelo Mercado Pago para eventos payment, order.* e subscription_preapproval. Cole essa URL no painel do MP e deixe HMAC ativo.",
    configurable_in: "/admin/pagamentos",
  },
  {
    id: "mp-retry",
    provider: "mercadopago",
    category: "payments",
    label: "Reprocessamento manual",
    path: "/api/public/hooks/mercadopago-retry",
    methods: ["POST"],
    description: "Chamado por pg_cron / botão do admin para reprocessar falhas em fila.",
  },

  // Stripe
  {
    id: "stripe-webhook",
    provider: "stripe",
    category: "payments",
    label: "Eventos Stripe (charge.succeeded, invoice.paid, ...)",
    path: "/api/public/webhooks/stripe",
    methods: ["POST"],
    description: "Cadastre no Dashboard do Stripe → Developers → Webhooks e use o Signing Secret gerado.",
  },

  // Asaas
  {
    id: "asaas-webhook",
    provider: "asaas",
    category: "payments",
    label: "Notificações Asaas (PAYMENT_CONFIRMED, ...)",
    path: "/api/public/webhooks/asaas",
    methods: ["POST"],
    description: "No painel Asaas → Integrações → Webhooks, informe essa URL e o Token de autenticação.",
  },

  // PagBank / PagSeguro
  {
    id: "pagseguro-webhook",
    provider: "pagseguro",
    category: "payments",
    label: "Notificações PagBank",
    path: "/api/public/webhooks/pagseguro",
    methods: ["POST"],
    description: "URL de notificação do PagBank (v4). Requer autenticação por token.",
  },

  // Pagar.me
  {
    id: "pagarme-webhook",
    provider: "pagarme",
    category: "payments",
    label: "Notificações Pagar.me",
    path: "/api/public/webhooks/pagarme",
    methods: ["POST"],
    description: "Cadastre no Dashboard Pagar.me → Configurações → Webhooks.",
  },

  // AI callbacks
  {
    id: "openai-callback",
    provider: "openai",
    category: "ai",
    label: "OpenAI Batch/Realtime callback",
    path: "/api/public/webhooks/openai",
    methods: ["POST"],
    description: "Callback opcional usado por chamadas assíncronas da OpenAI (batch / assistants).",
  },
  {
    id: "gemini-callback",
    provider: "gemini",
    category: "ai",
    label: "Gemini callback",
    path: "/api/public/webhooks/gemini",
    methods: ["POST"],
    description: "Callback opcional para respostas assíncronas da API Google Generative AI.",
  },

  // Sistema (cron / email)
  {
    id: "cron-birthday",
    provider: "system",
    category: "system",
    label: "Cron — aniversariantes",
    path: "/api/public/cron/birthday",
    methods: ["POST", "GET"],
    description: "Rotina diária de envio de cupom de aniversário.",
  },
  {
    id: "cron-reengagement",
    provider: "system",
    category: "system",
    label: "Cron — reengajamento",
    path: "/api/public/cron/reengagement",
    methods: ["POST", "GET"],
    description: "Rotina de reengajamento de clientes inativos.",
  },
  {
    id: "email-queue",
    provider: "system",
    category: "system",
    label: "Processador da fila de e-mails",
    path: "/api/public/hooks/process-email-queue",
    methods: ["POST"],
    description: "Consome a fila de e-mails (Resend). Pode ser agendado via pg_cron.",
  },
];

export function resolveWebhooks() {
  const base = getPublicAppUrl();
  return WEBHOOK_CATALOG.map((w) => ({ ...w, url: `${base}${w.path}` }));
}
