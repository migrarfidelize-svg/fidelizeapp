import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEST_ENUM = z.enum(["reviews", "linktree", "landing", "menu"]).nullable().optional();

function genCode(len = 6): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no confusing chars
  let out = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

// ---------- List ----------
export const listQrTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ establishmentId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("qr_tags")
      .select("*")
      .eq("establishment_id", data.establishmentId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Create ----------
export const createQrTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      establishmentId: z.string().uuid(),
      label: z.string().trim().min(1).max(80),
      location: z.string().trim().max(80).optional().nullable(),
      destination: DEST_ENUM,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // ensure a unique short code
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = genCode(6);
      const { data: row, error } = await context.supabase
        .from("qr_tags")
        .insert({
          establishment_id: data.establishmentId,
          code,
          label: data.label,
          location: data.location || null,
          destination: data.destination ?? null,
        })
        .select("*")
        .maybeSingle();
      if (!error && row) return row;
      if (error && !/duplicate|unique/i.test(error.message)) {
        throw new Error(error.message);
      }
    }
    throw new Error("Não foi possível gerar um código único. Tente novamente.");
  });

// ---------- Bulk create (Mesa 1..N) ----------
export const bulkCreateQrTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      establishmentId: z.string().uuid(),
      prefix: z.string().trim().min(1).max(40),
      start: z.number().int().min(1).max(999),
      count: z.number().int().min(1).max(100),
      location: z.string().trim().max(80).optional().nullable(),
      destination: DEST_ENUM,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const created: any[] = [];
    for (let i = 0; i < data.count; i++) {
      const label = `${data.prefix} ${data.start + i}`;
      let inserted = false;
      for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
        const code = genCode(6);
        const { data: row, error } = await context.supabase
          .from("qr_tags")
          .insert({
            establishment_id: data.establishmentId,
            code,
            label,
            location: data.location || null,
            destination: data.destination ?? null,
          })
          .select("*")
          .maybeSingle();
        if (!error && row) {
          created.push(row);
          inserted = true;
        } else if (error && !/duplicate|unique/i.test(error.message)) {
          throw new Error(error.message);
        }
      }
    }
    return { created: created.length, rows: created };
  });

// ---------- Update ----------
export const updateQrTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      label: z.string().trim().min(1).max(80).optional(),
      location: z.string().trim().max(80).nullable().optional(),
      destination: DEST_ENUM,
      active: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.label !== undefined) patch.label = data.label;
    if (data.location !== undefined) patch.location = data.location || null;
    if (data.destination !== undefined) patch.destination = data.destination ?? null;
    if (data.active !== undefined) patch.active = data.active;
    const { data: row, error } = await context.supabase
      .from("qr_tags")
      .update(patch as never)
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });


// ---------- Delete ----------
export const deleteQrTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("qr_tags").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
