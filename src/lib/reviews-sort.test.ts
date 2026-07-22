import { describe, it, expect } from "vitest";
import { filterByRating, sortReviews, helpfulScore, type PublicReview } from "./reviews-sort";

const r = (id: string, over: Partial<PublicReview> = {}): PublicReview => ({
  id,
  rating: 5,
  comment: null,
  submittedAt: "2026-07-01T00:00:00.000Z",
  reply: null,
  replyAt: null,
  ...over,
});

describe("filterByRating", () => {
  const list = [r("a", { rating: 5 }), r("b", { rating: 3 }), r("c", { rating: 5 }), r("d", { rating: 1 })];
  it("returns everything when rating is null/undefined", () => {
    expect(filterByRating(list, null)).toHaveLength(4);
    expect(filterByRating(list, undefined)).toHaveLength(4);
  });
  it("filters by exact rating", () => {
    expect(filterByRating(list, 5).map((x) => x.id)).toEqual(["a", "c"]);
    expect(filterByRating(list, 3).map((x) => x.id)).toEqual(["b"]);
    expect(filterByRating(list, 2)).toEqual([]);
  });
  it("treats missing rating as 0", () => {
    const l2 = [r("x", { rating: null })];
    expect(filterByRating(l2, 1)).toEqual([]);
  });
});

describe("sortReviews recent", () => {
  it("orders newest first, missing dates last", () => {
    const list = [
      r("old", { submittedAt: "2026-01-01T00:00:00Z" }),
      r("new", { submittedAt: "2026-07-01T00:00:00Z" }),
      r("mid", { submittedAt: "2026-04-01T00:00:00Z" }),
      r("null", { submittedAt: null }),
    ];
    expect(sortReviews(list, "recent").map((x) => x.id)).toEqual(["new", "mid", "old", "null"]);
  });
  it("does not mutate input", () => {
    const list = [r("a", { submittedAt: "2026-01-01Z" }), r("b", { submittedAt: "2026-06-01Z" })];
    const orig = list.map((x) => x.id);
    sortReviews(list, "recent");
    expect(list.map((x) => x.id)).toEqual(orig);
  });
});

describe("sortReviews helpful", () => {
  it("prefers reviews with comment, then reply, then longer comment, then higher rating", () => {
    const noComment = r("nc", { comment: null, rating: 5 });
    const shortComment = r("short", { comment: "ok", rating: 5 });
    const longComment = r("long", { comment: "x".repeat(300), rating: 3 });
    const commentAndReply = r("both", { comment: "great", reply: "obrigado", rating: 4 });
    const list = [noComment, shortComment, longComment, commentAndReply];
    const ordered = sortReviews(list, "helpful").map((x) => x.id);
    // `both` beats every other (has reply + comment)
    expect(ordered[0]).toBe("both");
    // reviews with comment beat the one without
    expect(ordered[ordered.length - 1]).toBe("nc");
    // long comment ranks above short comment
    expect(ordered.indexOf("long")).toBeLessThan(ordered.indexOf("short"));
  });
  it("uses submittedAt as tiebreaker", () => {
    const a = r("a", { comment: "hello", submittedAt: "2026-01-01Z" });
    const b = r("b", { comment: "hello", submittedAt: "2026-06-01Z" });
    expect(sortReviews([a, b], "helpful").map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("helpfulScore returns 0 for empty review", () => {
    expect(helpfulScore(r("z", { rating: null }))).toBe(0);
  });
});
