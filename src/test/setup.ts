import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// qrcode uses canvas; stub to return a data URL immediately
vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(async () => "data:image/png;base64,stub") },
  toDataURL: vi.fn(async () => "data:image/png;base64,stub"),
}));
