import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSeoConfig, type SeoConfig } from "./seo.server";

export const getPublicSeo = createServerFn({ method: "GET" })
  .handler(async () => {
    return getSeoConfig();
  });

export const saveSeoConfig = createServerFn({ method: "POST" })
  .input(z.any())
  .handler(async ({ data }) => {
    // Only admins should call this. In practice, the route gate handles it.
    // We import supabaseAdmin here because we're on the server.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { error } = await supabaseAdmin
      .from("system_settings")
      .upsert({
        namespace: "seo",
        value: data,
        updated_at: new Date().toISOString()
      }, { onConflict: "namespace" });

    if (error) throw new Error(error.message);
    return { success: true };
  });
