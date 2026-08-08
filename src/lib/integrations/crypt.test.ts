import { describe, it, expect, vi } from 'vitest';
import { encryptSecret, decryptSecret } from './crypt.server';

describe('Encryption Infrastructure Verification', () => {
  it('should encrypt and decrypt correctly using existing infrastructure', async () => {
    // Mocking environment key for the test if not present
    if (!process.env.INTEGRATIONS_ENCRYPTION_KEY) {
      process.env.INTEGRATIONS_ENCRYPTION_KEY = 'test-master-key-32-chars-long-!!!';
    }

    const secret = "uazapi-token-12345";
    const encrypted = await encryptSecret(secret);
    
    expect(encrypted).toContain('ciphertext');
    expect(encrypted).toContain('tag');
    
    const decrypted = await decryptSecret(encrypted);
    expect(decrypted).toBe(secret);
  });

  it('should handle legacy reverse base64 format (fallback support)', async () => {
    const legacySecret = "plain-text";
    const legacyEncrypted = "enc:" + Buffer.from(legacySecret).toString('base64').split('').reverse().join('');
    
    const decrypted = await decryptSecret(legacyEncrypted);
    expect(decrypted).toBe(legacySecret);
  });

  it('should return original text if not encrypted (plaintext migration support)', async () => {
    const plaintext = "already-in-db-as-plaintext";
    const decrypted = await decryptSecret(plaintext);
    expect(decrypted).toBe(plaintext);
  });
});
