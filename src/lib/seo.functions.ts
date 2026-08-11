import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSeoConfig } from "./seo.server";

export const getPublicSeo = createServerFn({ method: "GET" })
  .handler(async () => {
    return getSeoConfig();
  });

export const saveSeoConfig = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // In system_settings, the unique constraint might be on 'namespace' and 'key'.
    // We'll use namespace='seo' and key='config' to be safe.
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
