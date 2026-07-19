import { describe, it, expect } from "vitest";
import forge from "node-forge";
import { unzipSync, strFromU8 } from "fflate";
import { buildSignedPkpass } from "./pkpass.server";

// Generate an ephemeral self-signed cert + PKCS#12 for the test.
function makeCreds() {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 86400_000);
  const attrs = [{ name: "commonName", value: "Test Pass" }];
  cert.setSubject(attrs); cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], "test", { algorithm: "3des" });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  const wwdrPem = forge.pki.certificateToPem(cert); // reuse cert as fake WWDR for test only
  return {
    passTypeId: "pass.test.fidelize",
    teamId: "TEAM123456",
    p12Base64: forge.util.encode64(p12Der),
    p12Password: "test",
    wwdrPem,
  };
}

describe("buildSignedPkpass", () => {
  it("produces a zip with pass.json, manifest, signature and icon", async () => {
    const creds = makeCreds();
    const zip = await buildSignedPkpass({
      passJson: { formatVersion: 1, description: "t", serialNumber: "s1", organizationName: "Fidelize" },
      logoUrl: null,
      creds,
    });
    expect(zip.byteLength).toBeGreaterThan(500);
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(
      ["icon.png", "icon@2x.png", "manifest.json", "pass.json", "signature"].sort()
    );
    const manifest = JSON.parse(strFromU8(files["manifest.json"]));
    expect(Object.keys(manifest).sort()).toEqual(["icon.png", "icon@2x.png", "pass.json"].sort());
    // Signature is PKCS#7 DER, always starts with 0x30 (SEQUENCE)
    expect(files["signature"][0]).toBe(0x30);
    // passTypeIdentifier/teamIdentifier are enforced from creds
    const pass = JSON.parse(strFromU8(files["pass.json"]));
    expect(pass.passTypeIdentifier).toBe(creds.passTypeId);
    expect(pass.teamIdentifier).toBe(creds.teamId);
  }, 15_000);
});
