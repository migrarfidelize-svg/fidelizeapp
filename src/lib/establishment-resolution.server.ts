import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type EstablishmentResolutionResult = {
  status: "ACTIVE" | "INACTIVE" | "NOT_FOUND" | "DATABASE_ERROR";
  establishment?: {
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    primary_color: string;
    accent_color: string;
    description: string | null;
    address: string | null;
    phone: string | null;
    active: boolean;
    external_links: any;
  };
  campaigns?: any[];
};

export async function resolveEstablishmentBySlug(
  slug: string
): Promise<EstablishmentResolutionResult> {
  const normalized = slug.trim().toLowerCase();
  
  if (!normalized) {
    return { status: "NOT_FOUND" };
  }

  try {
    const { data: establishment, error: estError } = await supabaseAdmin
      .from("establishments")
      .select("id, slug, name, logo_url, primary_color, accent_color, description, address, phone, active, external_links")
      .eq("slug", normalized)
      .maybeSingle();

    if (estError) {
      console.error("[resolveEstablishmentBySlug] establishment lookup failed", {
        code: estError.code,
        message: estError.message,
        slug: normalized,
      });
      return { status: "DATABASE_ERROR" };
    }

    if (!establishment) {
      return { status: "NOT_FOUND" };
    }

    if (!establishment.active) {
      return { status: "INACTIVE" };
    }

    // Active, now get campaigns
    const { data: campaigns, error: campError } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("establishment_id", establishment.id)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (campError) {
      console.error("[resolveEstablishmentBySlug] campaigns lookup failed", {
        code: campError.code,
        message: campError.message,
        establishmentId: establishment.id,
      });
      // We still return the establishment but note the error? 
      // Actually, for consistency, let's treat campaign load failure as DATABASE_ERROR if it's a real error.
      return { status: "DATABASE_ERROR" };
    }

    return {
      status: "ACTIVE",
      establishment,
      campaigns: campaigns || [],
    };
  } catch (error) {
    console.error("[resolveEstablishmentBySlug] unexpected error", error);
    return { status: "DATABASE_ERROR" };
  }
}
