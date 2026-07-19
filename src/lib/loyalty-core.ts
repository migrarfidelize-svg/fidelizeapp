// Pure helpers for loyalty logic — no I/O, so they can be unit tested
// independently from Supabase/server context.

export const STAMP_RATE_LIMIT_MS = 10_000;
export const UNDO_WINDOW_MS = 60_000;

export type CardLike = { stamps: number; cycle: number };
export type CampaignLike = { stamps_required: number; reward_validity_days: number | null };

export type StampOutcome = {
  completed: boolean;
  stamps: number;
  required: number;
  cycle: number;
  reward_expires_at: string | null;
};

/**
 * Deterministically compute the next state of a loyalty card after adding a stamp.
 * `now` is injectable for testing.
 */
export function computeStampOutcome(card: CardLike, campaign: CampaignLike, now: Date = new Date()): StampOutcome {
  if (campaign.stamps_required <= 0) throw new Error("stamps_required precisa ser > 0");
  const newStamps = card.stamps + 1;
  const completed = newStamps >= campaign.stamps_required;
  const reward_expires_at =
    completed && campaign.reward_validity_days
      ? new Date(now.getTime() + campaign.reward_validity_days * 86400_000).toISOString()
      : null;
  return {
    completed,
    stamps: completed ? 0 : newStamps,
    required: campaign.stamps_required,
    cycle: completed ? card.cycle + 1 : card.cycle,
    reward_expires_at,
  };
}

/** Rate-limit: no stamp within `STAMP_RATE_LIMIT_MS` of the last one. */
export function canStampNow(lastStampAt: Date | string | null, now: Date = new Date()): boolean {
  if (!lastStampAt) return true;
  const last = typeof lastStampAt === "string" ? new Date(lastStampAt) : lastStampAt;
  return now.getTime() - last.getTime() >= STAMP_RATE_LIMIT_MS;
}

/** Undo is allowed within `UNDO_WINDOW_MS` after the stamp creation. */
export function canUndoStamp(stampCreatedAt: Date | string, now: Date = new Date()): boolean {
  const created = typeof stampCreatedAt === "string" ? new Date(stampCreatedAt) : stampCreatedAt;
  return now.getTime() - created.getTime() <= UNDO_WINDOW_MS;
}
