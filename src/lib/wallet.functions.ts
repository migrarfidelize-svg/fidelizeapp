import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Native Apple/Google Wallet capability probes.
 * The full pkpass signing lives in `/api/public/wallet/apple/:token`.
 * These functions are lightweight probes used by `WalletButtons`.
 */

export const getWalletCapabilities = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async () => {
    // Both are only truly available when the merchant configured signing certs.
    // For now we report both as unconfigured — the UI gracefully falls back.
    return { apple: false, google: false };
  });

export const getPassJson = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: z.string().min(10), origin: z.string().url().or(z.string().min(1)) }).parse(d),
  )
  .handler(async ({ data }) => {
    // Returns a minimal pass.json shape that the client can offer as a download.
    return {
      formatVersion: 1,
      passTypeIdentifier: "pass.app.fidelize.card",
      teamIdentifier: "FIDELIZE",
      serialNumber: data.token,
      description: "Cartão Fidelidade",
      organizationName: "Fidelize",
      logoText: "Fidelize",
      foregroundColor: "rgb(255,255,255)",
      backgroundColor: "rgb(20,24,36)",
      barcodes: [{ format: "PKBarcodeFormatQR", message: `${data.origin}/c/${data.token}`, messageEncoding: "iso-8859-1" }],
    };
  });

export const getGoogleWalletLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: z.string().min(10), origin: z.string().url().or(z.string().min(1)) }).parse(d),
  )
  .handler(async () => {
    return { configured: false as const, saveUrl: null as string | null };
  });
