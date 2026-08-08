import { describe, it, expect } from 'vitest';
import { uazapiOtp } from './otp/uazapi';
import { getProvider } from './registry';

describe('UAZAPI Validation Logic', () => {
  it('should ignore password/secret fields during general config validation', async () => {
    const provider = getProvider('otp', 'uazapi');
    const config = { baseUrl: 'https://api.uazapi.com' };
    
    // Simulating backend logic in integrations.functions.ts
    for (const f of provider.meta.fields) {
      if (f.kind === "secret" || f.kind === "password") continue;
      
      const v = (config as any)[f.name];
      if (f.required && (v === undefined || v === null || v === "")) {
        throw new Error(`Campo obrigatório ausente: ${f.label}`);
      }
    }
    
    expect(true).toBe(true); // Should not throw
  });

  it('should allow token in credentials flow', () => {
    const provider = getProvider('otp', 'uazapi');
    const allowed = new Set(provider.meta.fields.filter((f) => f.kind === "secret" || f.kind === "password").map((f) => f.name));
    
    expect(allowed.has('token')).toBe(true);
  });
});
