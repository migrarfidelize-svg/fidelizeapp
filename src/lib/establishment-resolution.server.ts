import { z } from "zod";

export type EstablishmentResolutionResult = {
  status: "ACTIVE" | "INACTIVE" | "NOT_FOUND" | "DATABASE_ERROR";
  establishment?: any;
  campaigns?: any[];
};

export async function resolveEstablishmentBySlug(rawSlug: string): Promise<EstablishmentResolutionResult> {
  const slug = rawSlug.trim().toLowerCase();
  
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Establishment lookup
  const { data: est, error: estError } = await supabaseAdmin
    .from("establishments")
    .select(`
      id, 
      slug, 
      name, 
      description, 
      address, 
      phone, 
      whatsapp, 
      instagram, 
      business_hours, 
      logo_url, 
      cover_url, 
      primary_color, 
      accent_color, 
      plan, 
      active
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (estError) {
    console.error("[resolveEstablishmentBySlug] establishment lookup failed", {
      code: estError.code,
      message: estError.message,
      slug
    });
    return { status: "DATABASE_ERROR" };
  }

  if (!est) {
    return { status: "NOT_FOUND" };
  }

  if (est.active !== true) {
    return { status: "INACTIVE", establishment: est };
  }

  // 2. Campaigns lookup (only if ACTIVE)
  const { data: campaigns, error: campaignsError } = await supabaseAdmin
    .from("campaigns")
    .select(`
      id, 
      name, 
      type, 
      stamps_required, 
      reward_title, 
      reward_description, 
      rules, 
      stamp_icon, 
      reward_validity_days
    `)
    .eq("establishment_id", est.id)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (campaignsError) {
    console.error("[resolveEstablishmentBySlug] campaigns lookup failed", {
      code: campaignsError.code,
      message: campaignsError.message,
      establishmentId: est.id
    });
    return { status: "DATABASE_ERROR", establishment: est };
  }

  return {
    status: "ACTIVE",
    establishment: est,
    campaigns: campaigns ?? []
  };
}
