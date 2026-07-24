import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKETS = ["logos", "promotions", "ticket-attachments", "poster-print-orders"] as const;

/**
 * Lista todos os arquivos dos 4 buckets do Storage e devolve URLs assinadas
 * (7 dias) para o cliente baixar e empacotar em ZIP com fflate.
 *
 * Acesso restrito a super_admin.
 */
export const listStorageForMigration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleErr } = await supabase.rpc("is_super_admin", { _user: userId });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Acesso restrito: apenas super admin.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const files: Array<{ bucket: string; path: string; signedUrl: string; size: number }> = [];
    const perPage = 1000;

    // Recursivo por bucket (Storage lista pasta a pasta)
    async function walk(bucket: string, prefix = "") {
      let offset = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, {
          limit: perPage,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
        if (error) {
          console.warn(`Bucket ${bucket} prefix "${prefix}":`, error.message);
          return;
        }
        if (!data?.length) return;
        for (const entry of data) {
          const full = prefix ? `${prefix}/${entry.name}` : entry.name;
          // Pasta: id === null; arquivo: id !== null
          if (!entry.id) {
            await walk(bucket, full);
          } else {
            const size = (entry.metadata as any)?.size || 0;
            const { data: signed } = await supabaseAdmin.storage
              .from(bucket)
              .createSignedUrl(full, 60 * 60 * 24 * 7); // 7 dias
            if (signed?.signedUrl) {
              files.push({ bucket, path: full, signedUrl: signed.signedUrl, size });
            }
          }
        }
        if (data.length < perPage) return;
        offset += perPage;
        if (offset > 100000) return; // safety
      }
    }

    for (const b of BUCKETS) {
      await walk(b);
    }

    const totalBytes = files.reduce((s, f) => s + (f.size || 0), 0);
    return { files, count: files.length, totalBytes, buckets: BUCKETS as unknown as string[] };
  });
