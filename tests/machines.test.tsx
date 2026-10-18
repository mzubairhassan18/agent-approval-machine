import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ApprovalResult } from "../src/core/useApproval";
import {
  useActionApproval,
  usePaymentApproval,
  usePublishApproval,
  useScheduleApproval,
  useSendApproval,
} from "../src/machines";
import type { SendItem } from "../src/machines";

const emails: SendItem[] = [
  { id: "e1", to: "ali@acme.com", subject: "intro", body: "hi" },
  { id: "e2", to: "sam@acme.com", subject: "intro", body: "hi" },
];

describe("machines", () => {
  it("useSendApproval allows edits, tracks editedItems and recalls inside 5s", async () => {
    const onExecute = vi.fn(
      async (sent: SendItem[]): Promise<ApprovalResult<SendItem>> => ({ succeeded: sent, failed: [] }),
    );
    const onUndo = vi.fn();

    const { result } = renderHook(() =>
      useSendApproval({ items: emails, onExecute, onUndo }),
    );

    act(() => {
      result.current.edit("e1", { body: "hi, edited" });
    });
    expect(result.current.editedItems).toEqual([expect.objectContaining({ id: "e1", body: "hi, edited" })]);

    await act(async () => {
      await result.current.approve(["e1"]);
    });
    expect(result.current.itemsWithState[0].status).toBe("undoing");

    act(() => {
      result.current.undo("e1");
    });
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("useActionApproval refuses edits and undo", async () => {
    const onExecute = vi.fn(async (sent: { id: string }[]) => ({ succeeded: sent, failed: [] }));

    const { result } = renderHook(() =>
      useActionApproval({
        items: [
          { id: "a1", title: "Refund order #1042", description: "Customer says wrong size", risk: "high" as const },
          { id: "a2", title: "Delete draft", description: "Stale draft", risk: "low" as const },
        ],
        onExecute: onExecute as never,
      }),
    );

    act(() => {
      result.current.edit("a1", { title: "changed" });
    });
    expect(result.current.itemsWithState[0].item.title).toBe("Refund order #1042");
    expect(result.current.highRiskItems).toHaveLength(1);

    await act(async () => {
      await result.current.approve(["a1"]);
    });

    expect(result.current.itemsWithState[0].status).toBe("success");
    // Reduced machine: undo() is a no-op, not a crash.
    act(() => {
      result.current.undo("a1");
    });
    expect(result.current.itemsWithState[0].status).toBe("success");
  });

  it("useScheduleApproval adds picking_time via pickTime", async () => {
    const onExecute = vi.fn(async (sent: { id: string }[]) => ({ succeeded: sent, failed: [] }));

    const { result } = renderHook(() =>
      useScheduleApproval({
        items: [
          {
            id: "s1",
            title: "Book with Ali",
            proposedTimes: ["Tue 10:00", "Wed 14:00"],
            attendees: ["ali@acme.com"],
          },
        ],
        onExecute: onExecute as never,
      }),
    );

    expect(result.current.needsTimePick).toHaveLength(1);

    act(() => {
      result.current.pickTime("s1", "Wed 14:00");
    });

    expect(result.current.needsTimePick).toHaveLength(0);
    expect(result.current.itemsWithState[0].item.selectedTime).toBe("Wed 14:00");

    await act(async () => {
      await result.current.approve(["s1"]);
    });
    expect(onExecute.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: "s1", selectedTime: "Wed 14:00" }),
    ]);
  });

  it("usePaymentApproval gives money a 30s undo window and totals", async () => {
    const onExecute = vi.fn(
      async (sent: { id: string }[]) => ({ succeeded: sent, failed: [] }),
    );

    const { result } = renderHook(() =>
      usePaymentApproval({
        items: [
          { id: "p1", amount: 1200, vendor: "AWS", description: "Overdue invoice" },
          { id: "p2", amount: 49, vendor: "Vercel", description: "Pro plan" },
        ],
        onExecute: onExecute as never,
      }),
    );

    expect(result.current.pendingTotal).toBe(1249);

    await act(async () => {
      await result.current.approve(["p1"]);
    });

    expect(result.current.itemsWithState[0].status).toBe("undoing");
    expect(result.current.undoSecondsLeft).toBe(30);
    expect(result.current.committedTotal).toBe(1200);
    expect(result.current.pendingTotal).toBe(49);
  });

  it("usePublishApproval tracks edited content and platforms", async () => {
    const onExecute = vi.fn(async (sent: unknown[]) => ({ succeeded: sent, failed: [] }));

    const { result } = renderHook(() =>
      usePublishApproval({
        items: [
          { id: "x1", platform: "x" as const, content: "shipping today" },
          { id: "l1", platform: "linkedin" as const, content: "longer post" },
        ],
        onExecute: onExecute as never,
      }),
    );

    expect(result.current.platforms).toEqual(["x", "linkedin"]);

    act(() => {
      result.current.edit("x1", { content: "shipping today, for real" });
    });

    expect(result.current.editedItems).toHaveLength(1);
    expect(result.current.editedItems[0].content).toBe("shipping today, for real");
  });
});
