import { createHash, randomInt } from "crypto";

export interface OTPRecord {
  id: string;
  identifier: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
  created_at: string;
}

/** Generates a 6-digit OTP and returns both the raw code and its SHA-256 hash. */
export function generateOTP() {
  const code = randomInt(100000, 999999).toString();
  const hash = createHash("sha256").update(code).digest("hex");
  return { code, hash };
}

/** Hashes a raw code for comparison. */
export function hashOTP(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Normalizes WhatsApp number: +55DDDNUMBER */
export function normalizeWhatsApp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  // If it doesn't start with 55 and has 10-11 digits, assume Brazil
  if (digits.length <= 11 && !digits.startsWith("55")) {
    return `+55${digits}`;
  }
  return `+${digits}`;
}
