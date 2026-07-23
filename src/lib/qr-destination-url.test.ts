import { describe, it, expect } from "vitest";
import { buildFidelizeUrl, qrDestinationPath, type QrDest } from "./qr-destination-url";

const ORIGIN = "https://fidelizeapp.lovable.app";
const SLUG = "acme-cafe";

describe("qrDestinationPath", () => {
  it.each([
    ["reviews", "avaliar"],
    ["linktree", "links"],
    ["landing", "cartao"],
  ] as const)("mapeia %s → /%s", (dest, path) => {
    expect(qrDestinationPath(dest)).toBe(path);
  });
});

describe("buildFidelizeUrl — link público pré-definido do QR", () => {
  const cases: Array<{ dest: QrDest; expected: string }> = [
    { dest: "reviews", expected: `${ORIGIN}/avaliar/${SLUG}` },
    { dest: "linktree", expected: `${ORIGIN}/links/${SLUG}` },
    { dest: "landing", expected: `${ORIGIN}/cartao/${SLUG}` },
  ];

  it.each(cases)("destino $dest → $expected", ({ dest, expected }) => {
    expect(buildFidelizeUrl(ORIGIN, SLUG, dest)).toBe(expected);
  });

  it("atualiza a URL ao alternar entre todas as opções sem manter estado anterior", () => {
    const seen = new Set<string>();
    for (const { dest, expected } of cases) {
      const url = buildFidelizeUrl(ORIGIN, SLUG, dest);
      expect(url).toBe(expected);
      seen.add(url);
    }
    // Cada destino gera uma URL distinta — garante que a UI realmente troca o link.
    expect(seen.size).toBe(cases.length);
  });
});
