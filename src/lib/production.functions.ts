import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getProductionMode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("namespace", "system")
      .eq("key", "production_mode")
      .maybeSingle();

    const val = (data?.value as any) || { enabled: false, production_started_at: null };
    return val;
  });

export const activateProductionMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Verify super admin
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso negado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    
    const { error } = await supabaseAdmin
      .from("system_settings")
      .upsert({
        namespace: "system",
        key: "production_mode",
        value: { enabled: true, production_started_at: now },
        updated_by: userId
      }, { onConflict: "namespace,key" });

    if (error) throw new Error(error.message);
    return { enabled: true, production_started_at: now };
  });
