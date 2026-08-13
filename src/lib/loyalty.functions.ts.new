import { assertActiveSubscription } from "@/lib/subscription-guard";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceLimit } from "@/lib/plans.functions";
import type { Database } from "@/integrations/supabase/types";
import { resolveEstablishmentBySlug } from "./establishment-resolution.server";

// ---------- Public: get establishment by slug ----------
export const getEstablishmentBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) =>
    z.object({
      slug: z.string().min(1).max(80),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const res = await resolveEstablishmentBySlug(data.slug);

    if (res.status === "ACTIVE") {
      if (!res.establishment) {
        throw new Error("NOT_FOUND");
      }
      return { 
        establishment: res.establishment, 
        campaigns: res.campaigns ?? [] 
      };
    }

    if (res.status === "INACTIVE") {
      throw new Error("INACTIVE");
    }

    if (res.status === "NOT_FOUND") {
      throw new Error("NOT_FOUND");
    }

    throw new Error("DATABASE_ERROR");
  });

// ---------- Public: create or fetch customer + card ----------
export const registerOrLoginCustomer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    campaign_id: z.string().uuid(),
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(10).max(11),
    email: z.string().email().max(120).optional().or(z.literal("")).transform(v => v || undefined),
    marketing_opt_in: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Ensure campaign belongs to establishment and is active
    const {
      data: campaign,
      error: campaignError
    } = await supabaseAdmin
      .from("campaigns")
      .select("id, establishment_id")
      .eq("id", data.campaign_id)
      .eq("establishment_id", data.establishment_id)
      .eq("active", true)
      .maybeSingle();

    if (campaignError) {
      console.error(
        "[registerOrLoginCustomer] campaign lookup failed",
        {
          code: campaignError.code,
          message: campaignError.message,
          establishmentId: data.establishment_id,
          campaignId: data.campaign_id
        }
      );
      throw new Error("DATABASE_ERROR");
    }

    if (!campaign) {
      throw new Error("CAMPAIGN_NOT_FOUND");
    }

    // Try find existing (strictly scoped by establishment_id)
    const { data: existing } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("establishment_id", data.establishment_id)
      .eq("phone", data.phone)
      .maybeSingle();

    let customer = existing;
    if (!customer) {
      const { data: created, error: e1 } = await supabaseAdmin
        .from("customers")
        .insert({
          establishment_id: data.establishment_id,
          name: data.name,
          phone: data.phone,
          email: data.email,
          marketing_opt_in: data.marketing_opt_in,
        })
        .select("*")
        .single();
      if (e1) throw new Error(e1.message);
      customer = created;
      const { consentContext } = await import("./consent.server");
      await supabaseAdmin.from("consents").insert({
        customer_id: customer.id,
        establishment_id: data.establishment_id,
        marketing_opt_in: data.marketing_opt_in,
        ...consentContext("loyalty_join"),
      });
    }

    // Ensure loyalty card exists (strictly scoped by establishment_id)
    const { data: card } = await supabaseAdmin
      .from("loyalty_cards")
      .select("*")
      .eq("customer_id", customer!.id)
      .eq("campaign_id", data.campaign_id)
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();
    
    let cardRow = card;
    if (!cardRow) {
      const { data: nc, error: ec } = await supabaseAdmin
        .from("loyalty_cards")
        .insert({
          customer_id: customer!.id,
          campaign_id: data.campaign_id,
          establishment_id: data.establishment_id,
          stamps: 0, cycle: 1,
        }).select("*").single();
      if (ec) throw new Error(ec.message);
      cardRow = nc;
    }
    return { access_token: customer!.access_token, card_id: cardRow!.id };
  });

// ... rest of the file (listCustomers, etc) remains the same
