// Pure helpers for public reviews sorting/filtering (unit-testable).

export type PublicReview = {
  id: string;
  rating: number | null;
  comment: string | null;
  author?: string | null;
  submittedAt: string | null;
  reply?: string | null;
  replyAt?: string | null;
};

export type SortMode = "recent" | "helpful";

/**
 * Filter reviews by rating (1..5). `null`/`undefined` disables filtering.
 */
export function filterByRating<T extends { rating: number | null }>(
  list: T[],
  rating: number | null | undefined,
): T[] {
  if (!rating) return list;
  return list.filter((r) => (r.rating ?? 0) === rating);
}

/**
 * Compute a heuristic "helpfulness" score. The underlying table has no
 * upvote column, so we approximate: has a comment > has a merchant reply >
 * longer comment > higher rating.
 */
export function helpfulScore(r: PublicReview): number {
  const commentLen = (r.comment ?? "").trim().length;
  const hasComment = commentLen > 0 ? 1 : 0;
  const hasReply = r.reply && r.reply.trim().length > 0 ? 1 : 0;
  // Weights: comment presence dominates; reply is a strong signal; length adds
  // fine-grained ordering; rating breaks ties.
  return (
    hasComment * 1000 +
    hasReply * 500 +
    Math.min(commentLen, 400) +
    (r.rating ?? 0)
  );
}

export function sortReviews<T extends PublicReview>(list: T[], mode: SortMode): T[] {
  const copy = [...list];
  if (mode === "helpful") {
    copy.sort((a, b) => {
      const diff = helpfulScore(b) - helpfulScore(a);
      if (diff !== 0) return diff;
      return dateMs(b.submittedAt) - dateMs(a.submittedAt);
    });
    return copy;
  }
  copy.sort((a, b) => dateMs(b.submittedAt) - dateMs(a.submittedAt));
  return copy;
}

function dateMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}
