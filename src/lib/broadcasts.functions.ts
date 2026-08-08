import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito.");
}

export const getBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("crm_broadcasts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  });

export const getBroadcastDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { data: broadcast, error } = await supabase
      .from("crm_broadcasts")
      .select("*, recipients:crm_broadcast_recipients(*)")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    return broadcast;
  });

export const createBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
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
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Get eligible contacts
    let query = supabaseAdmin
      .from("crm_contacts")
      .select("id, phone, name")
      .eq("opt_out", false)
      .eq("accept_communications", true);
    
    // Simple filter for now
    if (!data.filters?.allContacts) {
        // Fallback to all if not specified, but logic for tags would go here
    }

    const { data: contacts, error: contactErr } = await query;
    if (contactErr) throw contactErr;

    // 2. Create broadcast record
    const { data: broadcast, error: broadcastErr } = await supabaseAdmin
      .from("crm_broadcasts")
      .insert({
        name: data.name,
        message_template: data.message_template,
        status: data.scheduled_at ? 'scheduled' : 'draft',
        scheduled_at: data.scheduled_at,
        created_by: userId,
        total_contacts: contacts?.length || 0,
        queued_count: contacts?.length || 0
      })
      .select("id")
      .single();

    if (broadcastErr) throw broadcastErr;

    // 3. Queue recipients
    if (contacts && contacts.length > 0) {
      const recipients = contacts.map(c => ({
        broadcast_id: broadcast.id,
        contact_id: c.id,
        phone: c.phone,
        status: 'queued'
      }));

      const { error: queueErr } = await supabaseAdmin
        .from("crm_broadcast_recipients")
        .insert(recipients);
      
      if (queueErr) throw queueErr;
    }

    return { id: broadcast.id, count: contacts?.length || 0 };
  });

export const startBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("crm_broadcasts")
      .update({ 
        status: 'queued', 
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", data.id)
      .eq("status", 'draft');

    if (error) throw error;
    
    // In a real serverless env, we would trigger a background worker here
    // For now, we simulate the "queued" status which the UI will pick up.
    return { ok: true };
  });

export const pauseBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("crm_broadcasts")
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .in("status", ['queued', 'running']);

    if (error) throw error;
    return { ok: true };
  });
