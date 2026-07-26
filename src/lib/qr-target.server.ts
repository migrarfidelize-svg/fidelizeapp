/**
 * Server-only resolution of a QR destination into its public URL.
 *
 * The physical QR never changes, so the destination is recomputed on every
 * scan. "menu" (Cardápio digital) and "catalog" (Catálogo digital) are
 * plan-gated: if the feature is disabled for the merchant's plan — or the
 * vitrine is not published — the scan falls back to the review page instead
 * of landing on a locked/empty page.
 */
import { qrDestinationPath, type QrDest } from "@/lib/qr-destination-url";

export function normalizeQrDest(value: unknown): QrDest {
  const v = String(value ?? "").toLowerCase();
  return v === "linktree" || v === "landing" || v === "menu" || v === "catalog"
    ? (v as QrDest)
    : "reviews";
}

/** Returns true when the merchant may actually use that showcase right now. */
export async function isShowcaseDestinationValid(
  admin: any,
  establishmentId: string,
  kind: "menu" | "catalog" = "menu",
): Promise<boolean> {
  try {
    const [{ data: allowed }, { data: menu }] = await Promise.all([
      admin.rpc("has_plan_feature", {
        _est: establishmentId,
        _feature: kind === "catalog" ? "digital_catalog" : "digital_menu",
      }),
      admin
        .from("restaurant_menus")
        .select("status")
        .eq("establishment_id", establishmentId)
        .eq("kind", kind)
        .maybeSingle(),
    ]);
    return !!allowed && menu?.status === "published";
  } catch {
    return false;
  }
}

/** @deprecated use isShowcaseDestinationValid */
export async function isMenuDestinationValid(admin: any, establishmentId: string) {
  return isShowcaseDestinationValid(admin, establishmentId, "menu");
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

  if (dest === "menu" || dest === "catalog") {
    const ok = opts.establishmentId
      ? await isShowcaseDestinationValid(opts.admin, opts.establishmentId, dest)
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
