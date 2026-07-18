import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const confirmEmailByAddress = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Find user by email
    let userId: string | null = null;
    let page = 1;
    while (page < 20 && !userId) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      const found = list.users.find((u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase());
      if (found) { userId = found.id; break; }
      if (list.users.length < 200) break;
      page++;
    }
    if (!userId) return { ok: false as const };
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { email_confirm: true });
    if (updErr) throw new Error(updErr.message);
    return { ok: true as const };
  });
