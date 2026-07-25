import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getPublicMenuBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const s = publicClient();
    const { data: est } = await s
      .from("establishments")
      .select("id, name, slug, logo_url, cover_url, description, primary_color, accent_color, phone, whatsapp, instagram, address")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (!est) return null;
    const { data: menu } = await s
      .from("restaurant_menus")
      .select("*")
      .eq("establishment_id", est.id)
      .eq("status", "published")
      .maybeSingle();
    if (!menu) return { establishment: est, menu: null, categories: [], items: [] };
    const [{ data: cats }, { data: items }] = await Promise.all([
      s.from("menu_categories").select("*").eq("menu_id", menu.id).eq("active", true).order("position", { ascending: true }),
      s.from("menu_items").select("*").eq("menu_id", menu.id).eq("active", true).order("position", { ascending: true }),
    ]);
    return { establishment: est, menu, categories: cats ?? [], items: items ?? [] };
  });

/**
 * Módulo Cardápio Virtual — server functions.
 * Escopadas ao usuário autenticado; RLS impede acesso cruzado entre estabelecimentos.
 */

const estIdSchema = z.object({ establishment_id: z.string().uuid() });

// ------- Visão geral -------
export const getMyMenuOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => estIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const estId = data.establishment_id;

    let { data: menu } = await supabase
      .from("restaurant_menus")
      .select("*")
      .eq("establishment_id", estId)
      .maybeSingle();

    if (!menu) {
      const { data: created, error } = await supabase
        .from("restaurant_menus")
        .insert({ establishment_id: estId, status: "draft", default_view: "list" })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      menu = created;
    }

    const [{ count: categoriesCount }, { count: itemsCount }, { count: videosCount }] = await Promise.all([
      supabase.from("menu_categories").select("id", { count: "exact", head: true }).eq("menu_id", menu.id),
      supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("menu_id", menu.id),
      supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("menu_id", menu.id).not("video_url", "is", null),
    ]);

    const { data: recentEvents } = await supabase
      .from("channel_events")
      .select("kind, created_at")
      .eq("establishment_id", estId)
      .eq("channel", "menu")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(200);

    return {
      menu,
      counts: {
        categories: categoriesCount ?? 0,
        items: itemsCount ?? 0,
        videos: videosCount ?? 0,
        recent7d: recentEvents?.length ?? 0,
      },
    };
  });

// ------- Publicação -------
export const setMenuStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    status: z.enum(["draft", "published", "paused"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: menu, error } = await supabase
      .from("restaurant_menus")
      .update({ status: data.status })
      .eq("establishment_id", data.establishment_id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { menu };
  });

// ========================================================================
// CATEGORIAS
// ========================================================================

async function ensureMenuId(supabase: any, estId: string): Promise<string> {
  const { data: menu } = await supabase
    .from("restaurant_menus")
    .select("id")
    .eq("establishment_id", estId)
    .maybeSingle();
  if (menu) return menu.id;
  const { data: created, error } = await supabase
    .from("restaurant_menus")
    .insert({ establishment_id: estId, status: "draft", default_view: "list" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id;
}

export const listMenuCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => estIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const menuId = await ensureMenuId(supabase, data.establishment_id);
    const { data: rows, error } = await supabase
      .from("menu_categories")
      .select("*")
      .eq("menu_id", menuId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { menu_id: menuId, categories: rows ?? [] };
  });

const categoryUpsertSchema = z.object({
  establishment_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  description: z.string().max(400).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  active: z.boolean().optional(),
  featured: z.boolean().optional(),
});

export const upsertMenuCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => categoryUpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const menuId = await ensureMenuId(supabase, data.establishment_id);

    if (data.id) {
      const { data: updated, error } = await supabase
        .from("menu_categories")
        .update({
          name: data.name,
          description: data.description ?? null,
          image_url: data.image_url ?? null,
          active: data.active ?? true,
          featured: data.featured ?? false,
        })
        .eq("id", data.id)
        .eq("menu_id", menuId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return { category: updated };
    }

    const { data: maxRow } = await supabase
      .from("menu_categories")
      .select("position")
      .eq("menu_id", menuId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPos = (maxRow?.position ?? -1) + 1;

    const { data: created, error } = await supabase
      .from("menu_categories")
      .insert({
        establishment_id: data.establishment_id,
        menu_id: menuId,
        name: data.name,
        description: data.description ?? null,
        image_url: data.image_url ?? null,
        active: data.active ?? true,
        featured: data.featured ?? false,
        position: nextPos,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { category: created };
  });

export const deleteMenuCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Pratos ficam órfãos (category_id -> null via FK ON DELETE SET NULL, se aplicável)
    const { error } = await supabase
      .from("menu_categories")
      .delete()
      .eq("id", data.id)
      .eq("establishment_id", data.establishment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveMenuCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    id: z.string().uuid(),
    direction: z.enum(["up", "down"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const menuId = await ensureMenuId(supabase, data.establishment_id);
    const { data: rows } = await supabase
      .from("menu_categories")
      .select("id, position")
      .eq("menu_id", menuId)
      .order("position", { ascending: true });
    if (!rows) return { ok: true };
    const idx = rows.findIndex((r: any) => r.id === data.id);
    if (idx < 0) return { ok: true };
    const swap = data.direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= rows.length) return { ok: true };
    const a = rows[idx];
    const b = rows[swap];
    await supabase.from("menu_categories").update({ position: b.position }).eq("id", a.id);
    await supabase.from("menu_categories").update({ position: a.position }).eq("id", b.id);
    return { ok: true };
  });

// ========================================================================
// PRATOS (ITEMS)
// ========================================================================

export const listMenuItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    category_id: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const menuId = await ensureMenuId(supabase, data.establishment_id);

    let q = supabase
      .from("menu_items")
      .select("*")
      .eq("menu_id", menuId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });

    if (data.category_id === null) q = q.is("category_id", null);
    else if (data.category_id) q = q.eq("category_id", data.category_id);

    const { data: items, error } = await q;
    if (error) throw new Error(error.message);

    const { data: cats } = await supabase
      .from("menu_categories")
      .select("id, name, position")
      .eq("menu_id", menuId)
      .order("position", { ascending: true });

    return { menu_id: menuId, items: items ?? [], categories: cats ?? [] };
  });

const itemUpsertSchema = z.object({
  establishment_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  category_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  short_desc: z.string().max(200).nullable().optional(),
  long_desc: z.string().max(2000).nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
  promo_price: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).optional(),
  image_url: z.string().url().nullable().optional(),
  video_url: z.string().url().nullable().optional(),
  video_poster_url: z.string().url().nullable().optional(),
  prep_minutes: z.number().int().nonnegative().nullable().optional(),
  active: z.boolean().optional(),
  badges: z.array(z.string()).optional(),
  ingredients: z.array(z.string()).optional(),
  allergens: z.array(z.string()).optional(),
});

export const upsertMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => itemUpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const menuId = await ensureMenuId(supabase, data.establishment_id);

    const payload = {
      category_id: data.category_id ?? null,
      name: data.name,
      short_desc: data.short_desc ?? null,
      long_desc: data.long_desc ?? null,
      price: data.price ?? null,
      promo_price: data.promo_price ?? null,
      currency: data.currency ?? "BRL",
      image_url: data.image_url ?? null,
      video_url: data.video_url ?? null,
      video_poster_url: data.video_poster_url ?? null,
      prep_minutes: data.prep_minutes ?? null,
      active: data.active ?? true,
      badges: (data.badges ?? []) as any,
      ingredients: data.ingredients ?? [],
      allergens: data.allergens ?? [],
    };

    if (data.id) {
      const { data: updated, error } = await supabase
        .from("menu_items")
        .update(payload)
        .eq("id", data.id)
        .eq("establishment_id", data.establishment_id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return { item: updated };
    }

    const { data: maxRow } = await supabase
      .from("menu_items")
      .select("position")
      .eq("menu_id", menuId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPos = (maxRow?.position ?? -1) + 1;

    const { data: created, error } = await supabase
      .from("menu_items")
      .insert({
        establishment_id: data.establishment_id,
        menu_id: menuId,
        position: nextPos,
        ...payload,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { item: created };
  });

export const deleteMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", data.id)
      .eq("establishment_id", data.establishment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleMenuItemActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    id: z.string().uuid(),
    active: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("menu_items")
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("establishment_id", data.establishment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: src, error: e1 } = await supabase
      .from("menu_items")
      .select("*")
      .eq("id", data.id)
      .eq("establishment_id", data.establishment_id)
      .single();
    if (e1 || !src) throw new Error(e1?.message ?? "not_found");
    // Remove chaves managed
    const { id: _id, created_at: _c, updated_at: _u, position: _p, ...rest } = src as any;
    const { data: maxRow } = await supabase
      .from("menu_items")
      .select("position")
      .eq("menu_id", src.menu_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: created, error: e2 } = await supabase
      .from("menu_items")
      .insert({ ...rest, name: `${src.name} (cópia)`, position: (maxRow?.position ?? -1) + 1 })
      .select("*")
      .single();
    if (e2) throw new Error(e2.message);
    return { item: created };
  });

export const moveMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    id: z.string().uuid(),
    direction: z.enum(["up", "down"]),
    category_id: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const menuId = await ensureMenuId(supabase, data.establishment_id);
    let q = supabase
      .from("menu_items")
      .select("id, position")
      .eq("menu_id", menuId)
      .order("position", { ascending: true });
    if (data.category_id === null) q = q.is("category_id", null);
    else if (data.category_id) q = q.eq("category_id", data.category_id);
    const { data: rows } = await q;
    if (!rows) return { ok: true };
    const idx = rows.findIndex((r: any) => r.id === data.id);
    if (idx < 0) return { ok: true };
    const swap = data.direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= rows.length) return { ok: true };
    const a = rows[idx];
    const b = rows[swap];
    await supabase.from("menu_items").update({ position: b.position }).eq("id", a.id);
    await supabase.from("menu_items").update({ position: a.position }).eq("id", b.id);
    return { ok: true };
  });
