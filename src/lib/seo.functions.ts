import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "./admin.functions";
import { getSeoConfig } from "./seo.server";

const SeoConfigSchema = z.object({
  platformName: z.string(),
  defaultTitle: z.string(),
  defaultDescription: z.string(),
  shortName: z.string(),
  siteUrl: z.string().url(),
  faviconUrl: z.string(),
  appleTouchIconUrl: z.string().optional(),
  logoUrl: z.string(),
  socialImageUrl: z.string(),
  themeColor: z.string(),
  backgroundColor: z.string().optional(),
  pwaIcon192Url: z.string().optional(),
  pwaIcon512Url: z.string().optional(),
  routes: z.record(z.string(), z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    noindex: z.boolean().optional(),
    canonical: z.string().optional(),
  }))
});

export const getPublicSeo = createServerFn({ method: "GET" })
  .handler(async () => {
    return getSeoConfig();
  });

export const saveSeoConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: any) => SeoConfigSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { error } = await supabaseAdmin
      .from("system_settings")
      .upsert({
        namespace: "seo",
        key: "config",
        value: data,
        updated_at: new Date().toISOString()
      }, { onConflict: "namespace,key" });

    if (error) throw new Error(error.message);
    return { success: true };
  });
