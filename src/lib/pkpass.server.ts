// Signed .pkpass builder — pure JS, Cloudflare-Worker-safe (nodejs_compat).
// Uses node-forge for PKCS#12 unwrap + PKCS#7 detached signature and
// fflate for ZIP packaging. Never import this file from client code.
import forge from "node-forge";
import { zipSync, strToU8 } from "fflate";

// 29x29 solid #5B21B6 PNG (base64) — minimal but valid icon.png fallback.
// iOS rejects the pass without icon.png so we always ship one.
const FALLBACK_ICON_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAB0AAAAdCAYAAABWk2cPAAAAP0lEQVRIx+3TMQ0AIBAEwSNBBQrRhQMs4AEDNCT8w3TbTL6y5wIAAAAAAAAAAAAAAAAAAB70v/8dAAAAgLcMzsQCzcGxKC0AAAAASUVORK5CYII=";

export type PassCreds = {
  passTypeId: string;
  teamId: string;
  p12Base64: string;
  p12Password: string;
  wwdrPem: string;
};

export function readAppleCreds(): PassCreds | null {
  const passTypeId = process.env.APPLE_PASS_TYPE_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const p12Base64 = process.env.APPLE_PASS_CERT_P12_BASE64;
  const p12Password = process.env.APPLE_PASS_CERT_PASSWORD;
  const wwdrPem = process.env.APPLE_WWDR_CERT_PEM;
  if (!passTypeId || !teamId || !p12Base64 || !p12Password || !wwdrPem) return null;
  return { passTypeId, teamId, p12Base64, p12Password, wwdrPem };
}

function sha1Hex(bytes: Uint8Array): string {
  const md = forge.md.sha1.create();
  md.update(forge.util.binary.raw.encode(bytes));
  return md.digest().toHex();
}

function extractSignerAndKey(p12Base64: string, password: string) {
  const der = forge.util.decode64(p12Base64);
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  let cert: forge.pki.Certificate | null = null;
  let key: forge.pki.PrivateKey | null = null;
  for (const sc of p12.safeContents) {
    for (const bag of sc.safeBags) {
      if (bag.type === forge.pki.oids.certBag && bag.cert) cert = bag.cert;
      if (
        (bag.type === forge.pki.oids.pkcs8ShroudedKeyBag ||
          bag.type === forge.pki.oids.keyBag) &&
        bag.key
      ) key = bag.key;
    }
  }
  if (!cert || !key) throw new Error("PKCS#12 sem certificado ou chave privada.");
  return { cert, key };
}

function pkcs7SignDetached(manifestBytes: Uint8Array, creds: PassCreds): Uint8Array {
  const { cert, key } = extractSignerAndKey(creds.p12Base64, creds.p12Password);
  const wwdr = forge.pki.certificateFromPem(creds.wwdrPem);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(forge.util.binary.raw.encode(manifestBytes));
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha1,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date().toISOString() },
    ],
  });
  p7.sign({ detached: true });
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  const out = new Uint8Array(der.length);
  for (let i = 0; i < der.length; i++) out[i] = der.charCodeAt(i) & 0xff;
  return out;
}

async function fetchLogoAsPng(logoUrl: string | null): Promise<Uint8Array | null> {
  if (!logoUrl) return null;
  try {
    const r = await fetch(logoUrl);
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("png")) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch { return null; }
}

export async function buildSignedPkpass(args: {
  passJson: Record<string, unknown>;
  logoUrl?: string | null;
  creds: PassCreds;
}): Promise<Uint8Array> {
  // Ensure passTypeIdentifier / teamIdentifier match creds; iOS validates strictly.
  const passJson = { ...args.passJson, passTypeIdentifier: args.creds.passTypeId, teamIdentifier: args.creds.teamId };
  const passBytes = strToU8(JSON.stringify(passJson));
  const fallbackIcon = Uint8Array.from(atob(FALLBACK_ICON_B64), c => c.charCodeAt(0));
  const logoPng = await fetchLogoAsPng(args.logoUrl ?? null);

  const files: Record<string, Uint8Array> = {
    "pass.json": passBytes,
    "icon.png": fallbackIcon,
    "icon@2x.png": fallbackIcon,
    ...(logoPng ? { "logo.png": logoPng, "logo@2x.png": logoPng } : {}),
  };

  const manifest: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(files)) manifest[name] = sha1Hex(bytes);
  const manifestBytes = strToU8(JSON.stringify(manifest));
  const signature = pkcs7SignDetached(manifestBytes, args.creds);

  return zipSync({
    ...files,
    "manifest.json": manifestBytes,
    "signature": signature,
  }, { level: 6 });
}
