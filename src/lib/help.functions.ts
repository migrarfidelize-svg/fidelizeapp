import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
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

export const listHelpCategories = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data: cats, error } = await sb
    .from("help_categories")
    .select("id, slug, name, description, icon, sort_order")
    .eq("active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  const { data: counts } = await sb
    .from("help_articles")
    .select("category_id")
    .eq("published", true);
  const map = new Map<string, number>();
  (counts ?? []).forEach((r: any) => map.set(r.category_id, (map.get(r.category_id) ?? 0) + 1));
  return (cats ?? []).map((c) => ({ ...c, article_count: map.get(c.id) ?? 0 }));
});

export const getHelpCategoryBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: cat } = await sb.from("help_categories").select("*").eq("slug", data.slug).maybeSingle();
    if (!cat) return null;
    const { data: articles } = await sb
      .from("help_articles")
      .select("id, slug, title, excerpt, reading_time, views, sort_order")
      .eq("category_id", cat.id)
      .eq("published", true)
      .order("sort_order");
    return { category: cat, articles: articles ?? [] };
  });

export const getHelpArticle = createServerFn({ method: "GET" })
  .inputValidator((d: { category: string; slug: string }) =>
    z.object({ category: z.string(), slug: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: cat } = await sb.from("help_categories").select("id, slug, name").eq("slug", data.category).maybeSingle();
    if (!cat) return null;
    const { data: article } = await sb
      .from("help_articles")
      .select("*")
      .eq("category_id", cat.id)
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    if (!article) return null;
    const { data: related } = await sb
      .from("help_articles")
      .select("slug, title, excerpt, reading_time")
      .eq("category_id", cat.id)
      .eq("published", true)
      .neq("id", article.id)
      .limit(4);
    return { category: cat, article, related: related ?? [] };
  });

export const searchHelp = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => z.object({ q: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const q = data.q.trim();
    if (q.length < 2) return [];
    const sb = publicClient();
    const like = `%${q}%`;
    const { data: rows } = await sb
      .from("help_articles")
      .select("slug, title, excerpt, keywords, category:help_categories(slug, name)")
      .eq("published", true)
      .or(`title.ilike.${like},excerpt.ilike.${like},keywords.ilike.${like}`)
      .limit(20);
    return rows ?? [];
  });

export const trackArticleView = createServerFn({ method: "POST" })
  .inputValidator((d: { articleId: string }) => z.object({ articleId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin.from("help_articles").select("views").eq("id", data.articleId).maybeSingle();
    if (cur) await supabaseAdmin.from("help_articles").update({ views: (cur.views ?? 0) + 1 }).eq("id", data.articleId);
    return { ok: true };
  });

export const submitArticleFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: { articleId: string; helpful: boolean; comment?: string }) =>
    z.object({ articleId: z.string().uuid(), helpful: z.boolean(), comment: z.string().max(2000).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("help_feedback").insert({
      article_id: data.articleId,
      helpful: data.helpful,
      comment: data.comment ?? null,
    });
    if (data.helpful) {
      const { data: cur } = await supabaseAdmin.from("help_articles").select("helpful_yes").eq("id", data.articleId).maybeSingle();
      if (cur) await supabaseAdmin.from("help_articles").update({ helpful_yes: (cur.helpful_yes ?? 0) + 1 }).eq("id", data.articleId);
    } else {
      const { data: cur } = await supabaseAdmin.from("help_articles").select("helpful_no").eq("id", data.articleId).maybeSingle();
      if (cur) await supabaseAdmin.from("help_articles").update({ helpful_no: (cur.helpful_no ?? 0) + 1 }).eq("id", data.articleId);
    }
    return { ok: true };
  });

// ============ ADMIN =============
async function ensureAdmin(context: any) {
  const { data } = await context.supabase.from("app_roles").select("role").eq("user_id", context.userId).eq("role", "super_admin").maybeSingle();
  if (!data) throw new Error("Acesso negado");
}

export const adminListAllCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("help_categories").select("*").order("sort_order");
    return data ?? [];
  });

export const adminUpsertCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) =>
    z.object({
      id: z.string().uuid().optional(),
      slug: z.string().min(2),
      name: z.string().min(1),
      description: z.string().optional().nullable(),
      icon: z.string().optional().nullable(),
      sort_order: z.number().int().default(0),
      active: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("help_categories").upsert(data as any, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("help_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListArticles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { categoryId?: string }) => z.object({ categoryId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("help_articles").select("*, category:help_categories(slug, name)").order("sort_order");
    if (data.categoryId) q = q.eq("category_id", data.categoryId);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const adminUpsertArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) =>
    z.object({
      id: z.string().uuid().optional(),
      category_id: z.string().uuid(),
      slug: z.string().min(2),
      title: z.string().min(1),
      excerpt: z.string().optional().nullable(),
      content: z.string().min(1),
      keywords: z.string().optional().nullable(),
      reading_time: z.number().int().default(3),
      sort_order: z.number().int().default(0),
      published: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("help_articles").upsert(data as any, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("help_articles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminHelpStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ count: cats }, { count: arts }, { data: top }] = await Promise.all([
      supabaseAdmin.from("help_categories").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("help_articles").select("id", { count: "exact", head: true }).eq("published", true),
      supabaseAdmin.from("help_articles").select("slug, title, views, helpful_yes, helpful_no, category:help_categories(slug)").order("views", { ascending: false }).limit(10),
    ]);
    return { categories: cats ?? 0, articles: arts ?? 0, top: top ?? [] };
  });
