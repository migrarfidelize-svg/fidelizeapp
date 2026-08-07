import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION = 1;

/**
 * Criptografia robusta AES-256-GCM para segredos em repouso.
 * Requer a variável de ambiente INTEGRATIONS_ENCRYPTION_KEY na VPS.
 */
export async function encryptSecret(text: string): Promise<string> {
  const masterKey = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!masterKey) {
    // Em desenvolvimento, se a chave não existir, lançamos erro claro
    // para evitar salvar dados sem proteção real.
    throw new Error("INTEGRATIONS_ENCRYPTION_KEY is not defined in environment.");
  }

  // Deriva uma chave de 256 bits a partir da masterKey
  const key = scryptSync(masterKey, "salt", 32);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    v: VERSION,
    alg: ALGORITHM,
    iv: iv.toString("hex"),
    ciphertext: encrypted.toString("hex"),
    tag: tag.toString("hex"),
  });
}

/**
 * Descriptografia segura com suporte a migração de formatos legados.
 */
export async function decryptSecret(data: string): Promise<string> {
  if (!data) return "";

  // Suporte a migração de legado (Base64 reverso)
  if (data.startsWith("enc:")) {
    const raw = data.substring(4);
    const reversed = raw.split("").reverse().join("");
    const decoded = Buffer.from(reversed, "base64").toString("utf8");
    
    // Auto-migração: se descriptografamos o legado, avisamos para regravar no novo formato
    // (A regravação acontece na lógica de negócio que chama esta função se necessário)
    return decoded;
  }

  // Tenta parsear o novo formato JSON AES-256-GCM
  try {
    const { v, iv, ciphertext, tag } = JSON.parse(data);
    
    if (v !== VERSION) throw new Error(`Unsupported encryption version: ${v}`);
    
    const masterKey = process.env.INTEGRATIONS_ENCRYPTION_KEY;
    if (!masterKey) throw new Error("INTEGRATIONS_ENCRYPTION_KEY is missing.");

    const key = scryptSync(masterKey, "salt", 32);
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "hex")),
      decipher.final()
    ]);
    
    return decrypted.toString("utf8");
  } catch (e) {
    // Se não for JSON ou falhar AES, e não for legado "enc:", retorna como está (possivelmente texto plano antigo)
    return data;
  }
}
