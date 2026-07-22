import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---------------- Poster designs (cloud share) ---------------- */

const SaveDesignInput = z.object({
  establishmentId: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  data: z.record(z.any()),
});

export const savePosterDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => SaveDesignInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("poster_designs")
      .insert({
        establishment_id: data.establishmentId,
        name: data.name,
        data: data.data,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listPosterDesigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ establishmentId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("poster_designs")
      .select("id, name, data, created_by, created_at, applied_by, applied_at")
      .eq("establishment_id", data.establishmentId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const ids = Array.from(
      new Set(
        rows
          .flatMap((r) => [r.created_by, r.applied_by])
          .filter((x): x is string => typeof x === "string"),
      ),
    );
    const nameMap = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      for (const p of profs ?? []) nameMap.set(p.id, p.full_name || "Membro");
    }
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      data: r.data,
      created_at: r.created_at,
      applied_at: r.applied_at,
      created_by_name: r.created_by ? nameMap.get(r.created_by) ?? "Membro" : null,
      applied_by_name: r.applied_by ? nameMap.get(r.applied_by) ?? "Membro" : null,
    }));
  });

export const applyPosterDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("poster_designs")
      .update({ applied_by: userId, applied_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePosterDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("poster_designs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- QR scan stats ---------------- */

export const getQrScanStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ establishmentId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const from30 = new Date(now - 30 * day).toISOString();
    const from7 = new Date(now - 7 * day).toISOString();
    const from1 = new Date(now - 1 * day).toISOString();

    const { data: rows, error } = await supabase
      .from("qr_scans")
      .select("dest, scanned_at")
      .eq("establishment_id", data.establishmentId)
      .gte("scanned_at", from30)
      .order("scanned_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    const { count: totalAll } = await supabase
      .from("qr_scans")
      .select("*", { count: "exact", head: true })
      .eq("establishment_id", data.establishmentId);

    let d1 = 0;
    let d7 = 0;
    let mainCount = 0;
    let secondCount = 0;
    const byDay = new Map<string, number>();
    for (const r of rows) {
      const ts = new Date(r.scanned_at).getTime();
      if (ts >= new Date(from1).getTime()) d1++;
      if (ts >= new Date(from7).getTime()) d7++;
      if (r.dest === "main") mainCount++;
      else secondCount++;
      const dayKey = new Date(r.scanned_at).toISOString().slice(0, 10);
      byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + 1);
    }
    const series: { d: string; n: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const key = new Date(now - i * day).toISOString().slice(0, 10);
      series.push({ d: key, n: byDay.get(key) ?? 0 });
    }
    return {
      total: totalAll ?? 0,
      last30: rows.length,
      last7: d7,
      last24h: d1,
      mainCount,
      secondCount,
      series,
    };
  });

/* ---------------- Print orders ---------------- */

const PrintOrderInput = z.object({
  establishmentId: z.string().uuid(),
  quantity: z.number().int().min(10).max(10000),
  paper: z.string().min(1).max(60),
  finish: z.string().max(60).optional(),
  format: z.string().max(60).optional(),
  shippingAddress: z.object({
    line1: z.string().min(3).max(200),
    city: z.string().min(2).max(80),
    state: z.string().min(2).max(4),
    postalCode: z.string().min(8).max(12),
    country: z.string().default("BR"),
  }),
  contactEmail: z.string().email().max(200),
  contactPhone: z.string().min(8).max(30),
  notes: z.string().max(500).optional(),
  pdfPath: z.string().min(1).max(300).optional(),
  svgPath: z.string().max(300).optional(),
});

export const submitPrintOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => PrintOrderInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("print_orders")
      .insert({
        establishment_id: data.establishmentId,
        requested_by: userId,
        quantity: data.quantity,
        paper: data.paper,
        finish: data.finish ?? null,
        format: data.format ?? null,
        shipping_address: data.shippingAddress,
        contact_email: data.contactEmail,
        contact_phone: data.contactPhone,
        notes: data.notes ?? null,
        pdf_path: data.pdfPath ?? null,
        svg_path: data.svgPath ?? null,
      })
      .select("id, order_number, status, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listPrintOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ establishmentId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("print_orders")
      .select("id, order_number, quantity, paper, finish, status, created_at")
      .eq("establishment_id", data.establishmentId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return rows;
  });
