import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Central de mensagens da loja.
 * - Lojista publica até 1 mensagem por semana (rate limit no trigger DB).
 * - Cliente vinculado (via public.customers) lê as mensagens dos últimos 90 dias
 *   e marca leitura em merchant_message_reads.
 */

const KindEnum = z.enum(["promo", "novidade", "aviso"]);

export const listMyInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: msgs, error } = await supabase
      .from("merchant_messages")
      .select(
        `id, establishment_id, kind, title, body, image_url, link_url, published_at,
         establishment:establishments!inner(id, slug, name, logo_url, primary_color)`,
      )
      .order("published_at", { ascending: false })
      .limit(60);
    if (error) throw error;

    const ids = (msgs ?? []).map((m) => m.id);
    let readSet = new Set<string>();
    if (ids.length) {
      const { data: reads } = await supabase
        .from("merchant_message_reads")
        .select("message_id")
        .eq("user_id", userId)
        .in("message_id", ids);
      readSet = new Set((reads ?? []).map((r) => r.message_id));
    }

    return (msgs ?? []).map((m) => ({
      ...m,
      read: readSet.has(m.id),
    }));
  });

export const countUnread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: msgs } = await supabase
      .from("merchant_messages")
      .select("id")
      .order("published_at", { ascending: false })
      .limit(60);
    const ids = (msgs ?? []).map((m) => m.id);
    if (!ids.length) return 0;
    const { data: reads } = await supabase
      .from("merchant_message_reads")
      .select("message_id")
      .eq("user_id", userId)
      .in("message_id", ids);
    const readSet = new Set((reads ?? []).map((r) => r.message_id));
    return ids.filter((i) => !readSet.has(i)).length;
  });

export const markMessagesRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rows = data.ids.map((id) => ({ message_id: id, user_id: userId }));
    const { error } = await supabase
      .from("merchant_message_reads")
      .upsert(rows, { onConflict: "message_id,user_id", ignoreDuplicates: true });
    if (error) throw error;
    return { ok: true };
  });

/**
 * Lojista: publica uma mensagem. Rate limit é aplicado pelo trigger DB.
 * establishment_id vem do primeiro estabelecimento do lojista logado.
 */
export const publishMerchantMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    establishmentId: string;
    kind: "promo" | "novidade" | "aviso";
    title: string;
    body: string;
    imageUrl?: string | null;
    linkUrl?: string | null;
  }) =>
    z
      .object({
        establishmentId: z.string().uuid(),
        kind: KindEnum,
        title: z.string().min(3).max(120),
        body: z.string().min(3).max(2000),
        imageUrl: z.string().url().nullable().optional(),
        linkUrl: z.string().url().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("merchant_messages")
      .insert({
        establishment_id: data.establishmentId,
        author_id: userId,
        kind: data.kind,
        title: data.title,
        body: data.body,
        image_url: data.imageUrl ?? null,
        link_url: data.linkUrl ?? null,
      })
      .select("id, published_at")
      .single();
    if (error) {
      const msg = error.message ?? "Falha ao publicar";
      throw new Error(msg.includes("Limite atingido") ? msg : msg);
    }
    return row;
  });

/** Lista mensagens já publicadas pelo estabelecimento (dashboard do lojista). */
export const listMyMerchantMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishmentId: string }) =>
    z.object({ establishmentId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("merchant_messages")
      .select("id, kind, title, body, image_url, link_url, published_at")
      .eq("establishment_id", data.establishmentId)
      .order("published_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return rows ?? [];
  });

export const deleteMerchantMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("merchant_messages").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Retorna quantos dias faltam para o próximo envio permitido (rate limit).
 * 0 = pode enviar agora.
 */
export const nextPublishSlot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishmentId: string }) =>
    z.object({ establishmentId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: last } = await context.supabase
      .from("merchant_messages")
      .select("published_at")
      .eq("establishment_id", data.establishmentId)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last?.published_at) return { canSendAt: null, canSendNow: true };
    const canAt = new Date(new Date(last.published_at).getTime() + 7 * 24 * 60 * 60 * 1000);
    return { canSendAt: canAt.toISOString(), canSendNow: canAt.getTime() <= Date.now() };
  });
