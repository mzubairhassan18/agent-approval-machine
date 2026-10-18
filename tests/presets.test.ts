/**
 * The five machines, reduced to the four flags they always were.
 */
import { describe, expect, it } from "vitest";

import { actionApproval, approvalPresets, paymentApproval, sendApproval } from "../src/presets";
import { createApprovalStore } from "../src/store";

interface Row {
  id: string;
}

const row = (id: string): Row => ({ id });

describe("presets", () => {
  it("exposes the five machines as plain data", () => {
    expect(Object.keys(approvalPresets)).toEqual([
      "send",
      "action",
      "schedule",
      "payment",
      "publish",
    ]);
    for (const preset of Object.values(approvalPresets)) {
      expect(typeof preset.canUndo).toBe("boolean");
      expect(typeof preset.canEdit).toBe("boolean");
      expect(typeof preset.canSelect).toBe("boolean");
    }
  });

  it("encodes the rule that makes each machine different", () => {
    expect(sendApproval).toMatchObject({ canUndo: true, undoMs: 5000, canEdit: true });
    expect(actionApproval).toMatchObject({ canUndo: false, canEdit: false });
    expect(paymentApproval).toMatchObject({ canUndo: true, undoMs: 30000, canEdit: false });
  });

  it("spreads straight into the store", async () => {
    const store = createApprovalStore<Row>({ items: [row("a")], ...paymentApproval });

    await store.approve(["a"]);

    // Payment's whole point: a 30 second window before it is committed.
    expect(store.getState().records[0].status).toBe("undoing");
    expect(store.getSnapshot().canUndoUntil).toBeGreaterThan(Date.now());
  });

  it("commits an action immediately, with no window to take it back", async () => {
    const store = createApprovalStore<Row>({ items: [row("a")], ...actionApproval });

    await store.approve(["a"]);

    expect(store.getState().records[0].status).toBe("success");
    expect(store.getSnapshot().canUndoUntil).toBeNull();
  });

  it("never lets a preset edit an irreversible payload", () => {
    const store = createApprovalStore<Row>({
      items: [{ id: "a" }],
      ...actionApproval,
    });

    store.edit("a", { id: "changed" });

    expect(store.getState().records[0].item.id).toBe("a");
  });
});
