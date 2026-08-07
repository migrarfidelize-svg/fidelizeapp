import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const saveOtpTemplateSchema = z.object({
  template: z.string().min(10).max(500),
});

export const getOTPTemplate = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data, error } = await supabaseAdmin
      .from("config")
      .select("value")
      .eq("key", "otp_template")
      .maybeSingle();

    if (error) {
      console.error("[OTP] Error fetching template:", error);
    }

    return { 
      template: (data?.value as string) || "Afidelize\n\nSeu código de acesso é {{code}}.\n\nEle expira em {{minutes}} minutos.\n\nNão compartilhe este código."
    };
  });

export const saveOTPTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => saveOtpTemplateSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertSuperAdmin } = await import("./admin.functions");

    await assertSuperAdmin();

    const { error } = await supabaseAdmin
      .from("config")
      .upsert({ 
        key: "otp_template", 
        value: data.template,
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });

    if (error) throw error;
    return { ok: true };
  });

export const sendOTPTestMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ phone: z.string(), message: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { assertSuperAdmin } = await import("./admin.functions");
    await assertSuperAdmin();

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
