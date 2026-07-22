import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Retorna o carimbo mais recente do usuário logado ainda não avaliado,
 * dentro da janela de 72h e cujo estabelecimento tenha `auto_prompt=true`.
 * Usado pelo PostStampReviewSheet para abrir um prompt contextual.
 */
export const getPendingStampReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 72 * 3600_000).toISOString();

    // Cartões do usuário
    const { data: customers } = await context.supabase
      .from("customers")
      .select("id, establishment_id, establishments!inner(id, name, slug, logo_url, primary_color, accent_color)")
      .eq("user_id", context.userId);
    const custs = customers ?? [];
    if (!custs.length) return null;

    const { data: cards } = await context.supabase
      .from("loyalty_cards")
      .select("id, customer_id")
      .in("customer_id", custs.map((c) => c.id));
    const cardList = cards ?? [];
    if (!cardList.length) return null;

    // Último carimbo válido em 72h
    const { data: stamps } = await context.supabase
      .from("stamps")
      .select("id, card_id, created_at")
      .in("card_id", cardList.map((c) => c.id))
      .is("reverted_at", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);
    const recent = stamps ?? [];
    if (!recent.length) return null;

    // Filtra carimbos já com review
    const { data: existing } = await context.supabase
      .from("reviews")
      .select("stamp_id")
      .in("stamp_id", recent.map((s) => s.id));
    const done = new Set((existing ?? []).map((r) => r.stamp_id));

    const target = recent.find((s) => !done.has(s.id));
    if (!target) return null;

    const card = cardList.find((c) => c.id === target.card_id);
    if (!card) return null;
    const cust = custs.find((c) => c.id === card.customer_id);
    if (!cust) return null;

    // Settings do estabelecimento
    const { data: settings } = await context.supabase
      .from("review_settings")
      .select("auto_prompt, prompt_title, prompt_message, ask_nps, ask_categories, thank_you_message, google_place_url, google_redirect_min_rating")
      .eq("establishment_id", cust.establishment_id)
      .maybeSingle();
    if (settings && settings.auto_prompt === false) return null;

    return {
      stampId: target.id,
      createdAt: target.created_at,
      establishment: cust.establishments as {
        id: string; name: string; slug: string; logo_url: string | null;
        primary_color: string; accent_color: string | null;
      },
      settings: settings ?? {
        auto_prompt: true,
        prompt_title: "Como foi seu atendimento?",
        prompt_message: "Sua opinião nos ajuda a melhorar. Leva menos de 30 segundos!",
        ask_nps: false,
        ask_categories: false,
        thank_you_message: "Obrigado pelo seu feedback!",
        google_place_url: null,
        google_redirect_min_rating: 5,
      },
    };
  });

const submitSchema = z.object({
  stampId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  nps: z.number().int().min(0).max(10).optional().nullable(),
  categories: z.record(z.number().int().min(1).max(5)).optional(),
  comment: z.string().trim().max(1000).optional(),
  isPublic: z.boolean().optional(),
});

/**
 * Submete uma avaliação para um carimbo do usuário logado. RLS garante que
 * o carimbo pertence a um cartão do próprio usuário via subquery em customers.
 */
export const submitStampReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Valida propriedade do carimbo
    const { data: stamp, error: sErr } = await context.supabase
      .from("stamps")
      .select("id, card_id, establishment_id, created_at, loyalty_cards!inner(customer_id, customers!inner(user_id))")
      .eq("id", data.stampId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!stamp) throw new Error("Carimbo não encontrado.");

    const cardOwner = (stamp.loyalty_cards as { customers: { user_id: string | null } }).customers?.user_id;
    if (cardOwner !== context.userId) throw new Error("Este carimbo não é seu.");

    const ageMs = Date.now() - new Date(stamp.created_at).getTime();
    if (ageMs > 72 * 3600_000) throw new Error("A janela de 72h para avaliar já expirou.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("reviews").insert({
      establishment_id: stamp.establishment_id,
      customer_id: (stamp.loyalty_cards as { customer_id: string }).customer_id,
      card_id: stamp.card_id,
      stamp_id: stamp.id,
      rating: data.rating,
      nps: data.nps ?? null,
      categories: data.categories ?? {},
      comment: data.comment ?? null,
      is_public: data.isPublic ?? true,
      source: "wallet",
    });
    if (error) {
      if (error.code === "23505") throw new Error("Você já avaliou este atendimento.");
      throw new Error(error.message);
    }
    return { ok: true as const };
  });
