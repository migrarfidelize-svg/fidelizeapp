import { createHmac, randomInt, timingSafeEqual } from "crypto";

/** 
 * Generates a 6-digit OTP and returns both the raw code and its HMAC-SHA256 hash. 
 * Using HMAC-SHA256 with a server-side secret prevents brute-force/rainbow table 
 * attacks on the small 6-digit space (1M possibilities).
 */
export function generateOTP(identifier: string) {
  const secret = process.env['AUTH_OTP_HMAC_SECRET'];
  if (!secret) {
    throw new Error("AUTH_OTP_HMAC_SECRET is not configured on the server.");
  }

  const code = randomInt(100000, 999999).toString();
  const hash = computeHMAC(code, identifier, secret);
  
  return { code, hash };
}

/** 
 * Hashes a raw code for comparison using HMAC-SHA256. 
 * Includes identifier in the message to bind the OTP to the specific phone.
 */
export function hashOTP(code: string, identifier: string): string {
  const secret = process.env['AUTH_OTP_HMAC_SECRET'];
  if (!secret) {
    throw new Error("AUTH_OTP_HMAC_SECRET is not configured on the server.");
  }
  return computeHMAC(code, identifier, secret);
}

function computeHMAC(code: string, identifier: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${identifier}:${code}`)
    .digest("hex");
}

/** 
 * Secure constant-time comparison of hashes to prevent timing attacks.
 */
export function verifyOTPHash(inputHash: string, storedHash: string): boolean {
  return timingSafeEqual(Buffer.from(inputHash), Buffer.from(storedHash));
}

/** Normalizes WhatsApp number: +55DDDNUMBER */
export function normalizeWhatsApp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  
  // Brazil: if length is 10 (no 9) or 11 (with 9) and doesn't start with 55
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) {
    return `+55${digits}`;
  }
  
  // Already has country code or is international
  return `+${digits}`;
}
