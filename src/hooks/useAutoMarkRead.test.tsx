import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAutoMarkRead } from "./useAutoMarkRead";

type Msg = { id: string; read: boolean };

describe("useAutoMarkRead", () => {
  it("calls markFn once with unread ids on first mount", async () => {
    const markFn = vi.fn(async () => ({ ok: true }));
    const onMarked = vi.fn();
    const items: Msg[] = [
      { id: "a", read: false },
      { id: "b", read: true },
      { id: "c", read: false },
    ];
    renderHook(() => useAutoMarkRead(items, markFn, onMarked));
    await waitFor(() => expect(markFn).toHaveBeenCalledTimes(1));
    expect(markFn).toHaveBeenCalledWith({ data: { ids: ["a", "c"] } });
    await waitFor(() => expect(onMarked).toHaveBeenCalledTimes(1));
  });

  it("no-ops when everything is already read", () => {
    const markFn = vi.fn(async () => ({}));
    renderHook(() =>
      useAutoMarkRead([{ id: "a", read: true }], markFn),
    );
    expect(markFn).not.toHaveBeenCalled();
  });

  it("marks newly arrived unread messages without re-marking older ones", async () => {
    const markFn = vi.fn(async () => ({}));
    const onMarked = vi.fn();
    const initial: Msg[] = [{ id: "a", read: false }];
    const { rerender } = renderHook(({ items }) => useAutoMarkRead(items, markFn, onMarked), {
      initialProps: { items: initial },
    });
    await waitFor(() => expect(markFn).toHaveBeenCalledTimes(1));
    expect(markFn).toHaveBeenLastCalledWith({ data: { ids: ["a"] } });

    // Refetch: `a` is now read, `b` and `c` arrived as unread
    rerender({
      items: [
        { id: "a", read: true },
        { id: "b", read: false },
        { id: "c", read: false },
      ],
    });
    await waitFor(() => expect(markFn).toHaveBeenCalledTimes(2));
    // Only the new ids get sent
    expect(markFn).toHaveBeenLastCalledWith({ data: { ids: ["b", "c"] } });
  });

  it("retries after a failure on next unread change", async () => {
    const markFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue({});
    const { rerender } = renderHook(({ items }) => useAutoMarkRead(items, markFn), {
      initialProps: { items: [{ id: "a", read: false }] as Msg[] },
    });
    await waitFor(() => expect(markFn).toHaveBeenCalledTimes(1));
    // A new unread arrives; the previously failed `a` gets retried alongside `b`
    rerender({ items: [{ id: "a", read: false }, { id: "b", read: false }] });
    await waitFor(() => expect(markFn).toHaveBeenCalledTimes(2));
    expect(markFn).toHaveBeenLastCalledWith({ data: { ids: ["a", "b"] } });
  });
});
