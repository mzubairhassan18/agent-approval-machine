/**
 * The core is framework-free. These tests import it directly and never touch
 * React, which is the whole point: `agent-approval-machine/store` runs in any
 * JavaScript runtime.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApprovalStore } from "../src/store";
import type { ApprovalResult, ApprovalStore } from "../src/store";

interface Row {
  id: string;
  subject: string;
}

const row = (id: string, subject = `Subject ${id}`): Row => ({ id, subject });

const statusOf = (store: ApprovalStore<Row>, id: string) =>
  store.getState().records.find((r) => r.item.id === id)?.status;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("framework independence", () => {
  it("imports nothing at all", () => {
    const source = readFileSync(resolve(process.cwd(), "src/store.ts"), "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
  });

  it("declares no dependencies and no framework peer", () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    expect(pkg.dependencies ?? {}).toEqual({});
    expect(Object.keys(pkg.peerDependencies ?? {})).toEqual([]);
  });

  it("is a plain object with no framework semantics", () => {
    const store = createApprovalStore({ items: [row("a")] });
    expect(typeof store.subscribe).toBe("function");
    expect(store.getSnapshot().queuedCount).toBe(0);
    // No hooks, no renderer: just call it.
    store.select("a");
    expect(store.getSnapshot().selectedIds).toEqual(["a"]);
  });
});

describe("snapshot stability", () => {
  it("returns the identical reference until state actually changes", () => {
    const store = createApprovalStore({ items: [row("a")] });
    const first = store.getSnapshot();

    expect(store.getSnapshot()).toBe(first);

    // Same data, new object: the value comparison must settle, not notify.
    store.syncItems([row("a")]);
    expect(store.getSnapshot()).toBe(first);

    store.select("a");
    const second = store.getSnapshot();
    expect(second).not.toBe(first);
    expect(second.selectedIds).toEqual(["a"]);
  });

  it("does not notify for no-op updates", () => {
    const store = createApprovalStore({ items: [row("a")] });
    const listener = vi.fn();
    store.subscribe(listener);

    store.syncItems([row("a")]);
    store.syncItems([row("a")]);
    expect(listener).not.toHaveBeenCalled();

    store.syncItems([row("a"), row("b")]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops notifying after unsubscribe", () => {
    const store = createApprovalStore({ items: [row("a")] });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.select("a");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.select("b");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("setConfig swaps callbacks without touching state", () => {
    const store = createApprovalStore({ items: [row("a")] });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setConfig({ items: [row("z")], undoMs: 30000 });

    expect(listener).not.toHaveBeenCalled();
    expect(store.getState().records.map((r) => r.item.id)).toEqual(["a"]);
  });
});

describe("props sync", () => {
  it("adds new ids and refreshes untouched ones by value", () => {
    const store = createApprovalStore({ items: [row("a", "old")] });
    store.syncItems([row("a", "new"), row("b")]);

    const records = store.getState().records;
    expect(records.map((r) => r.item.id)).toEqual(["a", "b"]);
    expect(records[0].item.subject).toBe("new");
    expect(records[0].original.subject).toBe("new");
  });

  it("keeps a dismissed item out even when it is still in the list", () => {
    const store = createApprovalStore({ items: [row("a"), row("b")] });
    store.deny(["a"]);
    store.syncItems([row("a"), row("b")]);

    expect(store.getState().records.map((r) => r.item.id)).toEqual(["b"]);
  });
});

describe("partial failure", () => {
  it("splits one batch into successes and failures, then retries just the failure", async () => {
    let failing = true;
    const onExecute = vi.fn(async (items: Row[]): Promise<ApprovalResult<Row>> => {
      if (!failing) return { succeeded: items, failed: [] };
      const [ok, no] = items;
      return { succeeded: [ok], failed: [{ item: no, error: "quota exceeded" }] };
    });

    const store = createApprovalStore({
      items: [row("a"), row("b")],
      canUndo: false,
      onExecute,
    });

    const result = await store.approve(["a", "b"]);
    expect(result.succeeded.map((i) => i.id)).toEqual(["a"]);
    expect(result.failed.map((f) => f.error)).toEqual(["quota exceeded"]);

    expect(statusOf(store, "a")).toBe("success");
    expect(statusOf(store, "b")).toBe("failed");
    expect(store.getSnapshot().summary.failed).toBe(1);

    failing = false;
    await store.retryFailed();

    expect(statusOf(store, "b")).toBe("success");
    expect(onExecute).toHaveBeenLastCalledWith([expect.objectContaining({ id: "b" })]);
    expect(onExecute).toHaveBeenCalledTimes(2);
  });

  it("turns a thrown executor into a per-item failure", async () => {
    const store = createApprovalStore({
      items: [row("a")],
      canUndo: false,
      onExecute: () => {
        throw new Error("network down");
      },
    });

    await store.approve(["a"]);

    const record = store.getState().records[0];
    expect(record.status).toBe("failed");
    expect(record.error).toBe("network down");
  });

  it("succeeds without an executor at all", async () => {
    const store = createApprovalStore({ items: [row("a")], canUndo: false });
    await store.approve(["a"]);
    expect(statusOf(store, "a")).toBe("success");
  });
});

describe("edit before approve", () => {
  it("sends the edited payload, not the original", async () => {
    const onExecute = vi.fn(async (items: Row[]): Promise<ApprovalResult<Row>> => ({
      succeeded: items,
      failed: [],
    }));
    const store = createApprovalStore({ items: [row("a")], canUndo: false, onExecute });

    store.edit("a", { subject: "Rewritten" });
    expect(statusOf(store, "a")).toBe("editing");
    expect(store.getState().records[0].edited).toBe(true);

    await store.approve(["a"]);

    expect(onExecute).toHaveBeenCalledWith([{ id: "a", subject: "Rewritten" }]);
  });

  it("ignores edits when canEdit is false", () => {
    const store = createApprovalStore({ items: [row("a")], canEdit: false });
    store.edit("a", { subject: "nope" });
    expect(store.getState().records[0].item.subject).toBe("Subject a");
    expect(statusOf(store, "a")).toBe("needs_approval");
  });
});

describe("undo window", () => {
  it("opens a window on success and commits it when the timer fires", async () => {
    const store = createApprovalStore({ items: [row("a")], undoMs: 5000 });
    await store.approve(["a"]);

    expect(statusOf(store, "a")).toBe("undoing");
    expect(store.getSnapshot().canUndoUntil).not.toBeNull();

    vi.advanceTimersByTime(5000);
    expect(statusOf(store, "a")).toBe("success");
    expect(store.getSnapshot().canUndoUntil).toBeNull();
  });

  it("recalls inside the window and cancels its own timer", async () => {
    const onUndo = vi.fn();
    const store = createApprovalStore({ items: [row("a")], undoMs: 5000, onUndo });
    await store.approve(["a"]);

    store.undo("a");

    expect(onUndo).toHaveBeenCalledWith([expect.objectContaining({ id: "a" })]);
    expect(statusOf(store, "a")).toBe("needs_approval");

    // The cancelled timer must not expire a re-approval early.
    await store.approve(["a"]);
    expect(statusOf(store, "a")).toBe("undoing");
    vi.advanceTimersByTime(5000);
    expect(statusOf(store, "a")).toBe("success");
  });

  it("cannot recall when canUndo is false", async () => {
    const store = createApprovalStore({ items: [row("a")], canUndo: false });

    await store.approve(["a"]);
    expect(statusOf(store, "a")).toBe("success");
    expect(store.getSnapshot().canUndoUntil).toBeNull();

    store.undo("a");
    expect(statusOf(store, "a")).toBe("success");
  });

  it("destroy cancels pending timers", async () => {
    const store = createApprovalStore({ items: [row("a")], undoMs: 5000 });
    await store.approve(["a"]);
    expect(statusOf(store, "a")).toBe("undoing");

    store.destroy();
    vi.advanceTimersByTime(60000);

    expect(statusOf(store, "a")).toBe("undoing");
  });
});

describe("queue", () => {
  it("holds items that arrive mid-flight and releases them after", async () => {
    let settle: ((result: ApprovalResult<Row>) => void) | undefined;
    const store = createApprovalStore({
      items: [row("a")],
      canUndo: false,
      onExecute: () =>
        new Promise<ApprovalResult<Row>>((resolve) => {
          settle = resolve;
        }),
    });

    const inflight = store.approve(["a"]);

    // Execution is synchronous up to the await, so `a` is already executing.
    expect(store.getSnapshot().isExecuting).toBe(true);

    store.addItems(row("b"));
    store.syncItems([row("a"), row("b"), row("c")]);

    expect(store.getSnapshot().queuedCount).toBe(2);
    expect(store.getSnapshot().queuedItems.map((i) => i.id)).toEqual(["b", "c"]);

    settle?.({ succeeded: [row("a")], failed: [] });
    await inflight;

    expect(statusOf(store, "a")).toBe("success");
    expect(statusOf(store, "b")).toBe("needs_approval");
    expect(statusOf(store, "c")).toBe("needs_approval");
    expect(store.getSnapshot().queuedCount).toBe(0);
  });

  it("drops queued items on clearQueue", async () => {
    let settle: ((result: ApprovalResult<Row>) => void) | undefined;
    const store = createApprovalStore({
      items: [row("a")],
      canUndo: false,
      onExecute: () =>
        new Promise<ApprovalResult<Row>>((resolve) => {
          settle = resolve;
        }),
    });

    // `b` only becomes queued because `a` is still executing.
    const inflight = store.approve(["a"]);
    store.addItems([row("b")]);
    expect(store.getSnapshot().queuedCount).toBe(1);

    store.clearQueue();
    expect(store.getState().records.map((r) => r.item.id)).toEqual(["a"]);

    settle?.({ succeeded: [row("a")], failed: [] });
    await inflight;
  });
});

describe("selection", () => {
  it("approves every open item when nothing is selected", async () => {
    const store = createApprovalStore({ items: [row("a"), row("b")], canUndo: false });
    await store.approve();

    expect(store.getSnapshot().summary.success).toBe(2);
  });

  it("approves only the selection when there is one", async () => {
    const store = createApprovalStore({ items: [row("a"), row("b")], canUndo: false });
    store.select("b");
    await store.approve();

    expect(statusOf(store, "a")).toBe("needs_approval");
    expect(statusOf(store, "b")).toBe("success");
  });

  it("selectAll toggles only open items", () => {
    const store = createApprovalStore({ items: [row("a"), row("b")] });
    store.selectAll();
    expect(store.getSnapshot().selectedIds).toEqual(["a", "b"]);

    store.selectAll();
    expect(store.getSnapshot().selectedIds).toEqual([]);
  });

  it("select is a no-op when canSelect is false, and approve falls back to all open", async () => {
    const store = createApprovalStore({
      items: [row("a"), row("b")],
      canSelect: false,
      canUndo: false,
    });

    store.select("a");
    expect(store.getSnapshot().selectedIds).toEqual([]);

    await store.approve();
    expect(store.getSnapshot().summary.success).toBe(2);
  });
});
