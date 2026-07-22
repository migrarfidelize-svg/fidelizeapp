import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import { listAchievementsCatalog, listMyAchievements, markAchievementsSeen, runAchievementsCheck } from "@/lib/achievements.functions";

/**
 * Subscribes to customer_achievements inserts for the current user and shows
 * a cinematic toast when a new achievement unlocks. Mount once inside
 * the /carteira layout.
 */
export function AchievementUnlockListener() {
  const qc = useQueryClient();
  const shownRef = useRef<Set<string>>(new Set());

  // Roda uma verificação retroativa uma vez por sessão — cobre carimbos
  // anteriores aos triggers e garante que primeiras conquistas apareçam.
  useEffect(() => {
    const key = "ach:backfill:v1";
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) return;
    runAchievementsCheck()
      .then((r) => {
        if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, "1");
        if (r.unlocked > 0) qc.invalidateQueries({ queryKey: ["my-achievements"] });
      })
      .catch(() => { /* silent */ });
  }, [qc]);


  const { data: catalog } = useQuery({
    queryKey: ["achievements-catalog"],
    queryFn: () => listAchievementsCatalog(),
    staleTime: 5 * 60_000,
  });
  const { data: mine } = useQuery({
    queryKey: ["my-achievements"],
    queryFn: () => listMyAchievements(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // Show toast for any unseen achievement — covers both realtime and polling.
  useEffect(() => {
    if (!catalog || !mine) return;
    const catMap = new Map(catalog.map((c) => [c.code, c]));
    const toMark: string[] = [];

    for (const a of mine) {
      if (a.seenAt) continue;
      if (shownRef.current.has(a.code)) continue;
      const meta = catMap.get(a.code);
      if (!meta) continue;
      shownRef.current.add(a.code);
      toMark.push(a.code);

      const IconComp =
        (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[meta.icon] ??
        Icons.Award;

      toast.custom(
        (t) => (
          <div
            onClick={() => toast.dismiss(t)}
            className="pointer-events-auto flex min-w-[280px] cursor-pointer items-center gap-3 rounded-2xl border border-primary/50 bg-gradient-to-br from-primary/20 via-background to-background p-3 shadow-2xl backdrop-blur"
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-md">
              <IconComp className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-primary">
                🏆 Nova conquista
              </div>
              <div className="truncate font-display text-sm font-bold">{meta.title}</div>
              <div className="truncate text-[11px] text-muted-foreground">{meta.description}</div>
            </div>
          </div>
        ),
        { duration: 6000 },
      );
    }

    if (toMark.length) {
      markAchievementsSeen({ data: { codes: toMark } }).catch(() => { /* silent */ });
    }
  }, [catalog, mine]);

  // Realtime: refetch mine on insert.
  useEffect(() => {
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id ?? null;
      if (!userId) return;
      channel = supabase
        .channel(`ach-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "customer_achievements",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: ["my-achievements"] });
          },
        )
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);

  return null;
}
