import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const saveOtpTemplateSchema = z.object({
  template: z.string().min(10).max(500),
});

export const getOTPTemplate = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // We use system_settings or config? The project seems to have multiple tables.
    // Based on the error, "config" might not be the correct table or it's not in the public schema of the client types.
    // Let's check system_settings instead as it was used in adminGetOverview.
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("namespace", "otp")
      .eq("key", "template")
      .maybeSingle();

    if (error) {
      console.error("[OTP] Error fetching template:", error);
    }

    return { 
      template: (data?.value as any)?.text || "Afidelize\n\nSeu código de acesso é {{code}}.\n\nEle expira em {{minutes}} minutos.\n\nNão compartilhe este código."
    };
  });

export const saveOTPTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveOtpTemplateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase, userId } = context;
    
    // Check if super admin
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");

    const { error } = await supabaseAdmin
      .from("system_settings")
      .upsert({ 
        namespace: "otp",
        key: "template", 
        value: { text: data.template } as any,
      }, { onConflict: "namespace,key" });

    if (error) throw error;
    return { ok: true };
  });

export const sendOTPTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ phone: z.string(), message: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    // Check if super admin
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");

    const { getActiveWhatsAppProvider } = await import("./otp.functions");
    const active = await getActiveWhatsAppProvider();

    if (!active) {
      throw new Error("Nenhum provedor de WhatsApp ativo configurado nas Integrações.");
    }

    const res = await active.provider.sendTestMessage(
      active.runtime, 
      process.env as any, 
      data.phone, 
      data.message
    );

    if (!res.ok) {
      throw new Error(res.message || "Falha ao enviar mensagem de teste.");
    }

    return { ok: true };
  });
