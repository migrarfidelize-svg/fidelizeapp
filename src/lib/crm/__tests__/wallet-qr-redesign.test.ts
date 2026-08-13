import { describe, it, expect, vi } from "vitest";

// Mocks manuais antes de importar os arquivos
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: (ctx: any) => ctx,
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware: () => ({
      inputValidator: () => ({
        handler: (fn: any) => fn,
      }),
      handler: (fn: any) => fn,
    }),
    handler: (fn: any) => fn,
  }),
}));

// Mock do QRCode
vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mock"),
  },
}));

// Mock do Lucide React
vi.mock("lucide-react", () => ({
  QrCode: () => null,
  ExternalLink: () => null,
  X: () => null,
  Building2: () => null,
  ChevronDown: () => null,
  Maximize2: () => null,
}));

describe("Wallet QR Redesign Audit", () => {
  it("should have qr_destination in getMyWallet select", async () => {
    // Importa o arquivo real para auditar o conteúdo
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(path.join(process.cwd(), "src/lib/my-wallet.functions.ts"), "utf-8");
    
    expect(content).toContain("qr_destination");
  });

  it("should use the official redirect URL in WalletQrSheet", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(path.join(process.cwd(), "src/components/wallet/WalletQrSheet.tsx"), "utf-8");
    
    // Verifica se constrói a URL correta
    expect(content).toContain("/api/public/r/qr/");
    expect(content).toContain("/main");
    // Verifica se NÃO usa tokens de identificação do cliente
    expect(content).not.toContain("access_token");
    expect(content).not.toContain("/c/${token}");
  });

  it("should have friendly names for destinations", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(path.join(process.cwd(), "src/components/wallet/WalletQrSheet.tsx"), "utf-8");
    
    expect(content).toContain("Cardápio");
    expect(content).toContain("Catálogo");
    expect(content).toContain("Fidelidade");
    expect(content).toContain("Avaliações");
  });

  it("should preserve identity QR in MyQrSheet", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(path.join(process.cwd(), "src/components/wallet/MyQrSheet.tsx"), "utf-8");
    
    expect(content).toContain("/c/${token}");
    expect(content).toContain("IdentityQR");
  });
  
  it("should have FAB opening WalletQrSheet in layout", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(path.join(process.cwd(), "src/routes/_authenticated/carteira.tsx"), "utf-8");
    
    expect(content).toContain("WalletQrSheet");
    expect(content).toContain("setQrSheetOpen(true)");
    expect(content).toContain("QR Codes");
  });

  it("should filter for active establishments in WalletQrSheet", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(path.join(process.cwd(), "src/components/wallet/WalletQrSheet.tsx"), "utf-8");
    
    expect(content).toContain("active");
  });
});
