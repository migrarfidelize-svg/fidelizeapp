import { describe, it, expect } from "vitest";
import {
  computeStampOutcome,
  canStampNow,
  canUndoStamp,
  STAMP_RATE_LIMIT_MS,
  UNDO_WINDOW_MS,
} from "@/lib/loyalty-core";

describe("computeStampOutcome (addStamp core logic)", () => {
  it("increments stamps without completing when below threshold", () => {
    const out = computeStampOutcome({ stamps: 2, cycle: 0 }, { stamps_required: 5, reward_validity_days: null });
    expect(out).toMatchObject({ completed: false, stamps: 3, required: 5, cycle: 0, reward_expires_at: null });
  });

  it("completes the card when hitting the threshold and resets stamps + bumps cycle", () => {
    const out = computeStampOutcome({ stamps: 4, cycle: 1 }, { stamps_required: 5, reward_validity_days: null });
    expect(out.completed).toBe(true);
    expect(out.stamps).toBe(0);
    expect(out.cycle).toBe(2);
  });

  it("sets reward_expires_at based on reward_validity_days when completing", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const out = computeStampOutcome({ stamps: 9, cycle: 0 }, { stamps_required: 10, reward_validity_days: 30 }, now);
    expect(out.completed).toBe(true);
    expect(out.reward_expires_at).toBe(new Date("2026-01-31T00:00:00Z").toISOString());
  });

  it("keeps reward_expires_at null when validity is not configured", () => {
    const out = computeStampOutcome({ stamps: 9, cycle: 0 }, { stamps_required: 10, reward_validity_days: null });
    expect(out.completed).toBe(true);
    expect(out.reward_expires_at).toBeNull();
  });

  it("throws on invalid campaign", () => {
    expect(() => computeStampOutcome({ stamps: 0, cycle: 0 }, { stamps_required: 0, reward_validity_days: null })).toThrow();
  });
});

describe("canStampNow (rate limit)", () => {
  it("allows when no previous stamp", () => {
    expect(canStampNow(null)).toBe(true);
  });
  it("blocks stamps within the rate-limit window", () => {
    const now = new Date();
    const last = new Date(now.getTime() - (STAMP_RATE_LIMIT_MS - 1_000));
    expect(canStampNow(last, now)).toBe(false);
  });
  it("allows stamps after the rate-limit window", () => {
    const now = new Date();
    const last = new Date(now.getTime() - (STAMP_RATE_LIMIT_MS + 1));
    expect(canStampNow(last, now)).toBe(true);
  });
});

describe("canUndoStamp (undoLastStamp core rule)", () => {
  it("allows undo within the 60s window", () => {
    const now = new Date();
    const created = new Date(now.getTime() - (UNDO_WINDOW_MS - 5_000));
    expect(canUndoStamp(created, now)).toBe(true);
  });
  it("blocks undo after 60s", () => {
    const now = new Date();
    const created = new Date(now.getTime() - (UNDO_WINDOW_MS + 1));
    expect(canUndoStamp(created, now)).toBe(false);
  });
  it("accepts ISO string input", () => {
    const now = new Date("2026-01-01T00:00:30Z");
    expect(canUndoStamp("2026-01-01T00:00:00Z", now)).toBe(true);
  });
});
