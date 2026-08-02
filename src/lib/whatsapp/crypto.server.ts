/**
 * Criptografia simétrica (AES-GCM) para tokens de instância/API do WhatsApp.
 *
 * O material da chave vem do secret `WHATSAPP_CRYPTO_KEY`. Nunca guardamos
 * tokens em texto puro no banco — apenas o envelope `v1.<iv>.<ciphertext>`.
 */

const PREFIX = "v1";

function toB64(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function fromB64(value: string): Uint8Array<ArrayBuffer> {
  const bin = atob(value);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKey(): Promise<CryptoKey> {
  const raw = process.env["WHATSAPP_CRYPTO_KEY"];
  if (!raw) throw new Error("WHATSAPP_CRYPTO_KEY não configurado no servidor.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string): Promise<string> {
  if (!plain) return "";
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return `${PREFIX}.${toB64(iv)}.${toB64(new Uint8Array(ct))}`;
}

export async function decryptSecret(envelope: string | null | undefined): Promise<string> {
  if (!envelope) return "";
  const parts = envelope.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    // Compatibilidade: valor gravado antes da criptografia.
    return envelope;
  }
  const key = await getKey();
  const iv = fromB64(parts[1]!);
  const ct = fromB64(parts[2]!);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(plain);
}

/** Máscara segura para exibir no painel (nunca devolver o valor real). */
export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  return `••••${value.slice(-4)}`;
}

/** Token opaco usado na URL pública do webhook de cada conexão. */
export function newWebhookToken(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(24)))
    .replace(/[+/=]/g, "")
    .slice(0, 32);
}
