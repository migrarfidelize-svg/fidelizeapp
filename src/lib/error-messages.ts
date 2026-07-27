import { toast } from "sonner";

/**
 * Mapeamento centralizado de códigos de erro em PT-BR.
 * Garante mensagens consistentes e acessíveis (Toaster do sonner
 * renderiza dentro de uma região com role="status" aria-live="polite").
 *
 * Use `getErrorMessage(err)` para converter qualquer erro em uma
 * mensagem legível e `notifyError(err, contexto?)` para exibir o toast
 * já com contexto suficiente para leitores de tela.
 */

export const ERROR_MESSAGES: Record<string, string> = {
  // Autenticação
  invalid_credentials: "E-mail ou senha incorretos. Verifique e tente novamente.",
  email_not_confirmed: "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.",
  user_not_found: "Não encontramos uma conta com esses dados.",
  weak_password: "Use uma senha de 6 a 15 caracteres.",
  email_already_registered: "Este e-mail já está cadastrado. Faça login ou recupere sua senha.",
  invalid_email: "Informe um e-mail válido.",
  invalid_whatsapp: "Informe um WhatsApp válido com DDD (11 dígitos).",
  session_expired: "Sua sessão expirou. Faça login novamente para continuar.",
  unauthorized: "Você não tem permissão para executar esta ação.",
  forbidden: "Acesso negado a este recurso.",

  // Validação
  validation_failed: "Alguns campos estão inválidos. Confira os destaques em vermelho.",
  required_field: "Este campo é obrigatório.",
  too_short: "Valor muito curto. Informe mais caracteres.",
  too_long: "Valor muito longo. Reduza a quantidade de caracteres.",
  invalid_format: "Formato inválido. Confira as instruções do campo.",

  // Rede / servidor
  network_error: "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
  timeout: "A requisição demorou demais. Tente novamente em instantes.",
  server_error: "Erro no servidor. Nossa equipe já foi notificada.",
  service_unavailable: "Serviço temporariamente indisponível. Tente novamente em breve.",
  rate_limited: "Muitas tentativas em pouco tempo. Aguarde alguns segundos.",

  // Banco / recursos
  not_found: "Registro não encontrado.",
  conflict: "Já existe um registro com esses dados.",
  duplicate_entry: "Este item já foi cadastrado.",
  foreign_key_violation: "Não é possível concluir: existem dados vinculados.",

  // Plano / limites
  plan_limit_reached: "Limite do seu plano atingido. Faça upgrade para continuar.",
  feature_not_available: "Este recurso não está disponível no seu plano atual.",

  // Pagamento
  payment_failed: "Falha ao processar o pagamento. Tente outro método.",
  payment_pending: "Pagamento pendente de confirmação.",
  invalid_card: "Dados do cartão inválidos. Confira e tente novamente.",

  // Upload
  file_too_large: "Arquivo muito grande. Use um menor que o limite permitido.",
  invalid_file_type: "Tipo de arquivo não suportado.",
  upload_failed: "Falha ao enviar o arquivo. Tente novamente.",

  // Genérico
  unknown_error: "Ocorreu um erro inesperado. Tente novamente.",
};

/** Extrai um código canônico a partir de uma mensagem/objeto de erro. */
export function extractErrorCode(err: unknown): string | null {
  if (!err) return null;
  const raw =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "";

  const low = raw.toLowerCase();

  if (low.includes("invalid login") || low.includes("invalid credentials")) return "invalid_credentials";
  if (low.includes("email not confirmed")) return "email_not_confirmed";
  if (low.includes("user not found")) return "user_not_found";
  if (low.includes("password") && low.includes("weak")) return "weak_password";
  if (low.includes("already registered") || low.includes("already exists")) return "email_already_registered";
  if (low.includes("invalid email")) return "invalid_email";
  if (low.includes("jwt") || low.includes("session")) return "session_expired";
  if (low.includes("unauthorized") || low === "no authorization header provided") return "unauthorized";
  if (low.includes("forbidden")) return "forbidden";
  if (low.includes("network") || low.includes("fetch failed")) return "network_error";
  if (low.includes("timeout")) return "timeout";
  if (low.includes("rate limit") || low.includes("too many")) return "rate_limited";
  if (low.includes("not found")) return "not_found";
  if (low.includes("duplicate") || low.includes("conflict")) return "conflict";
  if (low.includes("foreign key")) return "foreign_key_violation";
  if (low.includes("plan") && low.includes("limit")) return "plan_limit_reached";
  if (low.includes("feature") && (low.includes("not available") || low.includes("unavailable"))) return "feature_not_available";
  if (low.includes("payment") && low.includes("fail")) return "payment_failed";
  if (low.includes("file") && low.includes("large")) return "file_too_large";

  // Se o erro já for um code conhecido, retorna direto
  if (raw in ERROR_MESSAGES) return raw;

  return null;
}

/** Converte qualquer erro em uma mensagem PT-BR consistente. */
export function getErrorMessage(err: unknown, fallback?: string): string {
  const code = extractErrorCode(err);
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  const zod = extractZodMessage(err);
  if (zod) return zod;
  if (typeof err === "string" && err.trim()) return err;
  if (err instanceof Error && err.message) {
    const z2 = extractZodMessage(err.message);
    if (z2) return z2;
    return err.message;
  }
  return fallback ?? ERROR_MESSAGES.unknown_error;
}

const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  description: "Descrição",
  logo_url: "Logo",
  cover_url: "Capa",
  label: "Rótulo do link",
  url: "URL do link",
  links: "Links",
  name: "Nome",
  email: "E-mail",
  phone: "WhatsApp",
  slug: "Identificador",
  primary_color: "Cor primária",
  accent_color: "Cor de destaque",
};

function labelForPath(path: (string | number)[]): string {
  if (!path.length) return "Campo";
  const key = String(path[path.length - 1]);
  const base = FIELD_LABELS[key] ?? key.replace(/_/g, " ");
  const idx = path.find((p) => typeof p === "number");
  return typeof idx === "number" ? `${base} #${(idx as number) + 1}` : base;
}

function translateZodIssue(issue: {
  code?: string;
  message?: string;
  path?: (string | number)[];
  type?: string;
  minimum?: number;
  maximum?: number;
}): string {
  const label = labelForPath(issue.path ?? []);
  switch (issue.code) {
    case "too_big":
      return issue.type === "string"
        ? `${label} muito longo (máximo ${issue.maximum} caracteres).`
        : `${label} acima do permitido (máx. ${issue.maximum}).`;
    case "too_small":
      if (issue.type === "string" && issue.minimum === 1)
        return `${label} é obrigatório.`;
      return `${label} muito curto (mínimo ${issue.minimum}).`;
    case "invalid_type":
      return `${label} está em formato inválido.`;
    case "invalid_string":
      return `${label} está em formato inválido.`;
    case "invalid_enum_value":
      return `${label} tem valor não permitido.`;
    default:
      return issue.message ? `${label}: ${issue.message}` : `${label} inválido.`;
  }
}

/** Detecta e traduz um payload de erro Zod (array ou string JSON). */
function extractZodMessage(err: unknown): string | null {
  let issues: unknown = null;
  if (Array.isArray(err)) issues = err;
  else if (err && typeof err === "object") {
    const anyErr = err as { issues?: unknown; message?: unknown };
    if (Array.isArray(anyErr.issues)) issues = anyErr.issues;
    else if (typeof anyErr.message === "string") {
      const parsed = tryParseJson(anyErr.message);
      if (Array.isArray(parsed)) issues = parsed;
      else if (parsed && typeof parsed === "object" && Array.isArray((parsed as { issues?: unknown }).issues))
        issues = (parsed as { issues: unknown[] }).issues;
    }
  } else if (typeof err === "string") {
    const parsed = tryParseJson(err);
    if (Array.isArray(parsed)) issues = parsed;
  }
  if (!Array.isArray(issues) || issues.length === 0) return null;
  const first = issues[0] as Parameters<typeof translateZodIssue>[0];
  const main = translateZodIssue(first);
  return issues.length > 1 ? `${main} (+${issues.length - 1} outro(s) campo(s))` : main;
}

function tryParseJson(s: string): unknown {
  const trimmed = s.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return null;
  try { return JSON.parse(trimmed); } catch { return null; }
}


/**
 * Dispara um toast de erro com contexto suficiente para leitores de tela.
 * `context` aparece como título (ex.: "Ao salvar cliente") e a mensagem
 * detalhada como descrição, o que dá pistas claras via aria-live.
 */
export function notifyError(err: unknown, context?: string) {
  const message = getErrorMessage(err);
  if (context) {
    toast.error(context, { description: message });
  } else {
    toast.error(message);
  }
  return message;
}

/** Sucesso com contexto opcional para consistência. */
export function notifySuccess(title: string, description?: string) {
  toast.success(title, description ? { description } : undefined);
}
