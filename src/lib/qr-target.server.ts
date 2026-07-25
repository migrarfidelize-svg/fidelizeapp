/**
 * Server-only resolution of a QR destination into its public URL.
 *
 * The physical QR never changes, so the destination is recomputed on every
 * scan. "menu" (Cardápio digital) is plan-gated: if the feature is disabled
 * for the merchant's plan — or the vitrine is not published — the scan falls
 * back to the review page instead of landing on a locked/empty page.
 */
import { qrDestinationPath, type QrDest } from "@/lib/qr-destination-url";

export function normalizeQrDest(value: unknown): QrDest {
  const v = String(value ?? "").toLowerCase();
  return v === "linktree" || v === "landing" || v === "menu" ? (v as QrDest) : "reviews";
}

/** Returns true when the merchant may actually use the digital menu right now. */
export async function isMenuDestinationValid(
  admin: any,
  establishmentId: string,
): Promise<boolean> {
  try {
    const [{ data: allowed }, { data: menu }] = await Promise.all([
      admin.rpc("has_plan_feature", { _est: establishmentId, _feature: "digital_menu" }),
      admin
        .from("restaurant_menus")
        .select("status")
        .eq("establishment_id", establishmentId)
        .maybeSingle(),
    ]);
    return !!allowed && menu?.status === "published";
  } catch {
    return false;
  }
}

/**
 * Recalculates the public target for a scan, validating plan-gated
 * destinations. Always returns a reachable public URL.
 */
export async function resolveQrTarget(opts: {
  admin: any;
  origin: string;
  slug: string;
  establishmentId: string | null | undefined;
  dest: unknown;
}): Promise<{ url: string; dest: QrDest; fellBack: boolean }> {
  let dest = normalizeQrDest(opts.dest);
  let fellBack = false;

  if (dest === "menu") {
    const ok = opts.establishmentId
      ? await isMenuDestinationValid(opts.admin, opts.establishmentId)
      : false;
    if (!ok) {
      dest = "reviews";
      fellBack = true;
    }
  }

  return {
    url: `${opts.origin}/${qrDestinationPath(dest)}/${opts.slug}`,
    dest,
    fellBack,
  };
}
