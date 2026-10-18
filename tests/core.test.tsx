import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useApproval } from "../src/core/useApproval";
import type { ApprovalResult } from "../src/core/useApproval";

interface Item {
  id: string;
  label: string;
  body: string;
}

const item = (id: string): Item => ({ id, label: `label ${id}`, body: `body ${id}` });
const items = (ids: string[]): Item[] => ids.map(item);

const statuses = (result: { current: ReturnType<typeof useApproval<Item>> }) =>
  result.current.itemsWithState.map((r) => r.status);

afterEach(() => {
  vi.useRealTimers();
});

describe("useApproval", () => {
  it("approves everything that is open when nothing is selected", async () => {
    const onExecute = vi.fn(async (batch: Item[]): Promise<ApprovalResult<Item>> => ({
      succeeded: batch,
      failed: [],
    }));

    const { result } = renderHook(() =>
      useApproval<Item>({ items: items(["a", "b", "c", "d"]), onExecute, canUndo: false }),
    );

    await act(async () => {
      await result.current.approve();
    });

    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute.mock.calls[0][0]).toHaveLength(4);
    expect(statuses(result)).toEqual(["success", "success", "success", "success"]);
  });

  it("handles partial failure: 2 succeed, 1 fails with a reason", async () => {
    const batch = items(["a", "b", "c"]);
    const onExecute = vi.fn(
      async (sent: Item[]): Promise<ApprovalResult<Item>> => ({
        succeeded: sent.filter((i) => i.id !== "c"),
        failed: [{ item: sent.find((i) => i.id === "c")!, error: "quota exceeded: 2/2 daily limit" }],
      }),
    );

    const { result } = renderHook(() => useApproval<Item>({ items: batch, onExecute, canUndo: false }));

    await act(async () => {
      await result.current.approve(["a", "b", "c"]);
    });

    expect(statuses(result)).toEqual(["success", "success", "failed"]);
    expect(result.current.itemsWithState[2].error).toBe("quota exceeded: 2/2 daily limit");
    expect(result.current.summary).toMatchObject({ success: 2, failed: 1 });
  });

  it("retries only the failed items and clears the error", async () => {
    const batch = items(["a", "b", "c"]);
    const onExecute = vi
      .fn<(sent: Item[]) => Promise<ApprovalResult<Item>>>()
      .mockResolvedValueOnce({
        succeeded: batch.slice(0, 2),
        failed: [{ item: batch[2], error: "rate limited" }],
      })
      .mockResolvedValueOnce({ succeeded: batch.slice(2), failed: [] });

    const { result } = renderHook(() => useApproval<Item>({ items: batch, onExecute, canUndo: false }));

    await act(async () => {
      await result.current.approve(["a", "b", "c"]);
    });
    expect(statuses(result)).toEqual(["success", "success", "failed"]);

    await act(async () => {
      await result.current.retryFailed();
    });

    expect(onExecute).toHaveBeenCalledTimes(2);
    // Only the failed item is retried.
    expect(onExecute.mock.calls[1][0]).toHaveLength(1);
    expect(statuses(result)).toEqual(["success", "success", "success"]);
    expect(result.current.itemsWithState[2].error).toBeUndefined();
  });

  it("sends the edited value, not the original", async () => {
    const onExecute = vi.fn(
      async (sent: Item[]): Promise<ApprovalResult<Item>> => ({ succeeded: sent, failed: [] }),
    );

    const { result } = renderHook(() =>
      useApproval<Item>({ items: items(["a", "b"]), onExecute, canUndo: false }),
    );

    act(() => {
      result.current.edit("a", { body: "edited body" });
    });

    expect(result.current.itemsWithState[0].status).toBe("editing");
    expect(result.current.itemsWithState[0].edited).toBe(true);

    await act(async () => {
      await result.current.approve(["a"]);
    });

    expect(onExecute).toHaveBeenCalledWith([expect.objectContaining({ id: "a", body: "edited body" })]);
  });

  it("ignores edits when canEdit is false", async () => {
    const onExecute = vi.fn(
      async (sent: Item[]): Promise<ApprovalResult<Item>> => ({ succeeded: sent, failed: [] }),
    );

    const { result } = renderHook(() =>
      useApproval<Item>({ items: items(["a"]), onExecute, canEdit: false, canUndo: false }),
    );

    act(() => {
      result.current.edit("a", { body: "nope" });
    });

    expect(result.current.itemsWithState[0].edited).toBe(false);

    await act(async () => {
      await result.current.approve(["a"]);
    });

    expect(onExecute).toHaveBeenCalledWith([expect.objectContaining({ id: "a", body: "body a" })]);
  });

  it("calls onUndo inside the window and settles success after it", async () => {
    vi.useFakeTimers();
    const onExecute = vi.fn(
      async (sent: Item[]): Promise<ApprovalResult<Item>> => ({ succeeded: sent, failed: [] }),
    );
    const onUndo = vi.fn();

    const { result } = renderHook(() =>
      useApproval<Item>({ items: items(["a"]), onExecute, onUndo, undoMs: 5000 }),
    );

    await act(async () => {
      await result.current.approve(["a"]);
    });

    expect(result.current.itemsWithState[0].status).toBe("undoing");
    expect(result.current.canUndoUntil).not.toBeNull();

    act(() => {
      result.current.undo("a");
    });

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onUndo.mock.calls[0][0]).toEqual([expect.objectContaining({ id: "a" })]);
    expect(result.current.itemsWithState[0].status).toBe("needs_approval");

    // Re-approve and let the window lapse: no undo, status lands on success.
    await act(async () => {
      await result.current.approve(["a"]);
    });
    expect(result.current.itemsWithState[0].status).toBe("undoing");

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(result.current.itemsWithState[0].status).toBe("success");
    expect(result.current.canUndoUntil).toBeNull();
  });

  it("skips the undo window when canUndo is false", async () => {
    const onExecute = vi.fn(
      async (sent: Item[]): Promise<ApprovalResult<Item>> => ({ succeeded: sent, failed: [] }),
    );

    const { result } = renderHook(() =>
      useApproval<Item>({ items: items(["a"]), onExecute, canUndo: false }),
    );

    await act(async () => {
      await result.current.approve(["a"]);
    });

    expect(result.current.itemsWithState[0].status).toBe("success");
    expect(result.current.canUndoUntil).toBeNull();
  });

  it("queues items that arrive while executing, then releases them", async () => {
    let resolveExecution: ((value: ApprovalResult<Item>) => void) | undefined;
    const onExecute = vi.fn(
      (): Promise<ApprovalResult<Item>> =>
        new Promise((resolve) => {
          resolveExecution = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useApproval<Item>({ items: items(["a"]), onExecute, canUndo: false }),
    );

    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = result.current.approve(["a"]);
    });

    expect(result.current.isExecuting).toBe(true);
    expect(statuses(result)).toEqual(["executing"]);

    act(() => {
      result.current.addItems(item("b"));
    });

    expect(result.current.queuedCount).toBe(1);
    expect(result.current.queuedItems).toEqual([expect.objectContaining({ id: "b" })]);
    expect(result.current.itemsWithState[1].status).toBe("queued");

    await act(async () => {
      resolveExecution!({ succeeded: [item("a")], failed: [] });
      await pending;
    });

    await waitFor(() => expect(result.current.isExecuting).toBe(false));
    expect(result.current.queuedCount).toBe(0);
    expect(result.current.itemsWithState[1].status).toBe("needs_approval");
  });

  it("queues items that arrive from props while executing", async () => {
    let resolveExecution: ((value: ApprovalResult<Item>) => void) | undefined;
    const onExecute = vi.fn(
      (): Promise<ApprovalResult<Item>> =>
        new Promise((resolve) => {
          resolveExecution = resolve;
        }),
    );

    const { result, rerender } = renderHook(
      ({ list }: { list: Item[] }) => useApproval<Item>({ items: list, onExecute, canUndo: false }),
      { initialProps: { list: items(["a"]) } },
    );

    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = result.current.approve(["a"]);
    });

    rerender({ list: items(["a", "b"]) });

    expect(result.current.queuedCount).toBe(1);

    await act(async () => {
      resolveExecution!({ succeeded: [item("a")], failed: [] });
      await pending;
    });

    await waitFor(() => expect(result.current.itemsWithState[1].status).toBe("needs_approval"));
  });

  it("turns a thrown executor into a failed batch with the message", async () => {
    const onExecute = vi.fn(async () => {
      throw new Error("network is down");
    });

    const { result } = renderHook(() =>
      useApproval<Item>({ items: items(["a", "b"]), onExecute, canUndo: false }),
    );

    await act(async () => {
      await result.current.approve();
    });

    expect(statuses(result)).toEqual(["failed", "failed"]);
    expect(result.current.itemsWithState[0].error).toBe("network is down");
  });

  it("does not churn records when the caller builds the items array inline", () => {
    // Regression: an inline `items` array creates new object identities every
    // render. Comparing by identity re-rendered forever; comparing by value settles.
    const { result, rerender } = renderHook(() =>
      useApproval<Item>({ items: items(["a", "b"]) }),
    );

    const firstRecords = result.current.itemsWithState;
    rerender();
    rerender();

    expect(result.current.itemsWithState).toBe(firstRecords);
  });

  it("picks up prop value changes while leaving human edits alone", () => {
    const { result, rerender } = renderHook(
      ({ list }: { list: Item[] }) => useApproval<Item>({ items: list }),
      { initialProps: { list: [item("a")] } },
    );

    rerender({ list: [{ id: "a", label: "label a", body: "body from the agent" }] });
    expect(result.current.itemsWithState[0].item.body).toBe("body from the agent");

    act(() => {
      result.current.edit("a", { body: "body from a human" });
    });

    rerender({ list: [{ id: "a", label: "label a", body: "agent tries again" }] });
    expect(result.current.itemsWithState[0].item.body).toBe("body from a human");
  });

  it("selects, selects all and denies", async () => {
    const { result } = renderHook(() => useApproval<Item>({ items: items(["a", "b", "c"]) }));

    act(() => {
      result.current.select("b");
    });
    expect(result.current.selectedIds).toEqual(["b"]);

    act(() => {
      result.current.selectAll();
    });
    expect(result.current.selectedIds).toEqual(["a", "b", "c"]);

    act(() => {
      result.current.selectAll();
    });
    expect(result.current.selectedIds).toEqual([]);

    act(() => {
      result.current.deny(["a"]);
    });
    expect(result.current.itemsWithState.map((r) => r.item.id)).toEqual(["b", "c"]);

    // A denied item does not sneak back in through props.
    expect(result.current.summary.total).toBe(2);
  });

  it("does not select when canSelect is false", async () => {
    const onExecute = vi.fn(
      async (sent: Item[]): Promise<ApprovalResult<Item>> => ({ succeeded: sent, failed: [] }),
    );

    const { result } = renderHook(() =>
      useApproval<Item>({ items: items(["a", "b"]), onExecute, canUndo: false, canSelect: false }),
    );

    act(() => {
      result.current.select("a");
    });
    expect(result.current.selectedIds).toEqual([]);

    await act(async () => {
      await result.current.approve();
    });
    expect(onExecute.mock.calls[0][0]).toHaveLength(2);
  });
});
