import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { authorizeCRMEstablishment } from "./atendimento.functions";

const tenantSchema = z.object({ establishmentId: z.string().uuid() });

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito.");
}

export const getBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.parse(d))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, input.establishmentId);
    const { data, error } = await (supabase as any)
      .from("crm_broadcasts")
      .select("*")
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  });

export const getBroadcastDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);
    const { data: broadcast, error } = await (supabase as any)
      .from("crm_broadcasts")
      .select("*, recipients:crm_broadcast_recipients(*)")
      .eq("id", data.id)
      .eq("establishment_id", establishmentId)
      .single();
    if (error) throw error;
    return broadcast;
  });

export const createBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishmentId: z.string().uuid(),
    name: z.string().min(3),
    message_template: z.string().min(1),
    scheduled_at: z.string().optional(),
    filters: z.object({
      tags: z.array(z.string()).optional(),
      allContacts: z.boolean().optional()
    }).optional()
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Get eligible contacts
    let query = (supabaseAdmin as any)
      .from("crm_contacts")
      .select("id, phone, name")
      .eq("opt_out", false)
      .eq("accept_communications", true)
      .eq("establishment_id", establishmentId);
    
    const { data: contacts, error: contactErr } = await query;
    if (contactErr) throw contactErr;

    // 2. Create broadcast record
    const { data: broadcast, error: broadcastErr } = await (supabaseAdmin as any)
      .from("crm_broadcasts")
      .insert({
        name: data.name,
        message_template: data.message_template,
        status: data.scheduled_at ? 'scheduled' : 'draft',
        scheduled_at: data.scheduled_at,
        created_by: userId,
        establishment_id: establishmentId,
        total_contacts: contacts?.length || 0,
        queued_count: contacts?.length || 0
      })
      .select("id")
      .single();

    if (broadcastErr) throw broadcastErr;

    // 3. Queue recipients
    if (contacts && contacts.length > 0) {
      const recipients = contacts.map((c: any) => ({
        broadcast_id: broadcast.id,
        establishment_id: establishmentId,
        contact_id: c.id,
        phone: c.phone,
        status: 'queued'
      }));

      const { error: queueErr } = await (supabaseAdmin as any)
        .from("crm_broadcast_recipients")
        .insert(recipients);
      
      if (queueErr) throw queueErr;
    }

    return { id: broadcast.id, count: contacts?.length || 0 };
  });

export const startBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await (supabaseAdmin as any)
      .from("crm_broadcasts")
      .update({ 
        status: 'queued', 
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", data.id)
      .eq("establishment_id", establishmentId)
      .eq("status", 'draft');

    if (error) throw error;
    
    // Server-side Engine Trigger (Batch sending)
    const { processNextBroadcastBatch } = await import("./broadcasts-engine.server");
    // We trigger the first batch immediately
    processNextBroadcastBatch(establishmentId).catch(console.error);

    return { ok: true };
  });

export const pauseBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await (supabaseAdmin as any)
      .from("crm_broadcasts")
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("establishment_id", establishmentId)
      .in("status", ['queued', 'running']);

    if (error) throw error;
    return { ok: true };
  });
