import sys

def apply_loyalty_changes(content):
    # 1. Update getEstablishmentBySlug
    old_get_est = """export const getEstablishmentBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) =>
    z.object({
      slug: z.string().min(1).max(80),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const res = await resolveEstablishmentBySlug(data.slug);

    if (res.status === "DATABASE_ERROR") {
      throw new Error("DATABASE_ERROR");
    }
    if (res.status === "NOT_FOUND") {
      throw new Error("NOT_FOUND");
    }
    if (res.status === "INACTIVE") {
      throw new Error("INACTIVE");
    }

    return { 
      establishment: res.establishment, 
      campaigns: res.campaigns ?? [] 
    };
  });"""
    
    new_get_est = """export const getEstablishmentBySlug = createServerFn({ method: "GET" })
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
  });"""
    
    content = content.replace(old_get_est, new_get_est)
    
    # 2. Update registerOrLoginCustomer
    old_campaign_lookup = """    // Ensure campaign belongs to establishment and is active
    const { data: campaign, error: cErr } = await supabaseAdmin
      .from("campaigns")
      .select("id, establishment_id")
      .eq("id", data.campaign_id)
      .eq("establishment_id", data.establishment_id)
      .eq("active", true)
      .maybeSingle();

    if (cErr) {
      console.error("[registerOrLoginCustomer] campaign lookup failed", cErr);
      throw new Error("DATABASE_ERROR");
    }
    if (!campaign) {
      throw new Error("Campanha não encontrada ou inativa.");
    }"""
    
    new_campaign_lookup = """    // Ensure campaign belongs to establishment and is active
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
    }"""
    
    content = content.replace(old_campaign_lookup, new_campaign_lookup)
    
    # Update customers query to include establishment_id scoping explicitly
    content = content.replace(
        '.from("customers").select("*").eq("establishment_id", data.establishment_id).eq("phone", data.phone)',
        '.from("customers").select("*").eq("establishment_id", data.establishment_id).eq("phone", data.phone)'
    ) # Already scoped in original but good to verify

    # Update loyalty_cards query
    old_card_lookup = """    // Ensure loyalty card exists
    const { data: card } = await supabaseAdmin
      .from("loyalty_cards")
      .select("*")
      .eq("customer_id", customer!.id)
      .eq("campaign_id", data.campaign_id)
      .maybeSingle();"""
    
    new_card_lookup = """    // Ensure loyalty card exists (strictly scoped by establishment_id)
    const { data: card } = await supabaseAdmin
      .from("loyalty_cards")
      .select("*")
      .eq("customer_id", customer!.id)
      .eq("campaign_id", data.campaign_id)
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();"""
    
    content = content.replace(old_card_lookup, new_card_lookup)
    
    return content

with open('src/lib/loyalty.functions.ts', 'r') as f:
    content = f.read()

content = apply_loyalty_changes(content)

with open('src/lib/loyalty.functions.ts', 'w') as f:
    f.write(content)
