import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getVoiceStudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ establishment_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: settings } = await supabase
      .from("establishment_settings")
      .select("appearance")
      .eq("establishment_id", data.establishment_id)
      .single();
    
    // Voice configuration is stored within the 'appearance' jsonb column
    const prefs = (settings?.appearance as any)?.voice_studio ?? {
      enabled: true,
      provider: "native",
      voice_id: "onyx",
      eleven_voice_id: "21m0pOTjCwobq1Wnu3pd",
      eleven_model_id: "eleven_multilingual_v2",
      texts: { welcome: "", call: "", ready: "", notify: "" },
      params: { rate: 1, volume: 1, stability: 0.5, similarity: 0.75 },
    };
    return { prefs };
  });

export const saveVoiceStudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ 
    establishment_id: z.string().uuid(),
    prefs: z.any() 
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: settings } = await supabase
      .from("establishment_settings")
      .select("appearance")
      .eq("establishment_id", data.establishment_id)
      .single();

    const appearance = settings?.appearance as any ?? {};
    const updated = { ...appearance, voice_studio: data.prefs };

    const { error } = await supabase
      .from("establishment_settings")
      .update({ appearance: updated })
      .eq("establishment_id", data.establishment_id);
      
    if (error) throw new Error(error.message);
    return { ok: true };
  });
