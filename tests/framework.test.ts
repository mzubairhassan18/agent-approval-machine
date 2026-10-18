/**
 * The core is not React-shaped.
 *
 * This suite imports `agent-approval-machine/store` - the framework-free entry -
 * and drives it from a real Vue component inside Vue's own render pass. No React
 * is imported, installed or involved. If this file passes, "usable from any
 * JavaScript framework" is a fact rather than a claim.
 */
import { computed, createSSRApp, h, onScopeDispose, shallowRef } from "vue";
import { renderToString } from "vue/server-renderer";
import { describe, expect, it, vi } from "vitest";
import type { ComputedRef } from "vue";

import { createApprovalStore } from "../src/store/index";
import type { ApprovalResult, ApprovalStore, UseApprovalConfig } from "../src/store/index";

interface Row {
  id: string;
  subject: string;
}

const row = (id: string, subject = `Subject ${id}`): Row => ({ id, subject });

/**
 * The entire Vue binding: five lines, no library needed.
 *
 * `shallowRef` + `subscribe` is the whole trick - the store hands out a
 * referentially stable snapshot, so Vue only re-renders when state changes.
 */
function useApprovalVue<T extends { id: string }>(config: UseApprovalConfig<T>) {
  const store = createApprovalStore(config);
  const snapshot = shallowRef(store.getSnapshot());
  const unsubscribe = store.subscribe(() => {
    snapshot.value = store.getSnapshot();
  });
  onScopeDispose(() => {
    unsubscribe();
    store.destroy();
  });
  return { store, snapshot };
}

describe("framework independence", () => {
  it("exports no hook from the framework-free entry", async () => {
    const module = await import("../src/store/index");
    expect(Object.keys(module)).not.toContain("useApproval");
    expect(Object.keys(module)).toContain("createApprovalStore");
  });

  it("renders inside a real Vue component", async () => {
    const app = createSSRApp({
      setup() {
        const { snapshot } = useApprovalVue({ items: [row("a"), row("b")] });
        return () =>
          h(
            "ul",
            snapshot.value.itemsWithState.map((record) =>
              h("li", { "data-id": record.item.id }, `${record.item.subject}:${record.status}`),
            ),
          );
      },
    });

    const html = await renderToString(app);

    expect(html).toContain("Subject a:needs_approval");
    expect(html).toContain("Subject b:needs_approval");
  });

  it("drives the machine from setup() and re-computes on change", async () => {
    const onExecute = vi.fn(
      async (items: Row[]): Promise<ApprovalResult<Row>> => ({ succeeded: items, failed: [] }),
    );

    let store: ApprovalStore<Row> | undefined;
    let successes: ComputedRef<number> | undefined;

    const app = createSSRApp({
      setup() {
        const { store: instance, snapshot } = useApprovalVue({
          items: [row("a")],
          canUndo: false,
          onExecute,
        });
        store = instance;
        successes = computed(() => snapshot.value.summary.success);
        return () => h("p", `success=${successes?.value ?? 0}`);
      },
    });

    const before = await renderToString(app);
    expect(before).toContain("success=0");
    expect(successes?.value).toBe(0);

    await store?.approve(["a"]);

    // The store changed outside of Vue, and Vue's reactivity followed.
    expect(successes?.value).toBe(1);
    expect(onExecute).toHaveBeenCalledWith([{ id: "a", subject: "Subject a" }]);
  });

  it("receives partial failure as data, not as an exception", async () => {
    const store = createApprovalStore<Row>({
      items: [row("a"), row("b")],
      canUndo: false,
      onExecute: async (items) => ({
        succeeded: items.slice(0, 1),
        failed: [{ item: items[1], error: "quota exceeded" }],
      }),
    });

    const result = await store.approve(["a", "b"]);

    expect(result.failed[0].error).toBe("quota exceeded");
    expect(store.getSnapshot().summary).toMatchObject({ success: 1, failed: 1 });
  });
});
