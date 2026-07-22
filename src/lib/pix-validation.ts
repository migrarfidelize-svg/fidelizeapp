export type PixKeyType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

export const PIX_TYPE_LABEL: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  aleatoria: "Aleatória",
};

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

function isValidCPF(v: string) {
  const d = onlyDigits(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (base: number) => {
    let sum = 0;
    for (let i = 0; i < base; i++) sum += parseInt(d[i], 10) * (base + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(d[9], 10) && calc(10) === parseInt(d[10], 10);
}

function isValidCNPJ(v: string) {
  const d = onlyDigits(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: number) => {
    const weights = base === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < base; i++) sum += parseInt(d[i], 10) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(d[12], 10) && calc(13) === parseInt(d[13], 10);
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

function isValidPhoneBR(v: string) {
  // Aceita 10-13 dígitos (com DDD/DDI), preferindo +55DDNNNNNNNNN
  const d = onlyDigits(v);
  return d.length >= 10 && d.length <= 13;
}

function isValidRandomKey(v: string) {
  // EVP: UUID v4 no padrão do Bacen
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
}

export function validatePixKey(type: PixKeyType, key: string): { ok: boolean; message?: string } {
  const v = key.trim();
  if (!v) return { ok: false, message: "Informe a chave Pix." };
  switch (type) {
    case "cpf":
      return isValidCPF(v)
        ? { ok: true }
        : { ok: false, message: "CPF inválido. Use 11 dígitos válidos." };
    case "cnpj":
      return isValidCNPJ(v)
        ? { ok: true }
        : { ok: false, message: "CNPJ inválido. Use 14 dígitos válidos." };
    case "email":
      return isValidEmail(v)
        ? { ok: true }
        : { ok: false, message: "E-mail inválido. Ex.: nome@dominio.com" };
    case "telefone":
      return isValidPhoneBR(v)
        ? { ok: true }
        : { ok: false, message: "Telefone inválido. Inclua DDD (ex.: +5511999999999)." };
    case "aleatoria":
      return isValidRandomKey(v)
        ? { ok: true }
        : { ok: false, message: "Chave aleatória inválida. Deve ser um UUID (ex.: 123e4567-e89b-12d3-a456-426614174000)." };
  }
}
