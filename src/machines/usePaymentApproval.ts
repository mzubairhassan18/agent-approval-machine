import { useEffect, useMemo, useState } from "react";

import { useApproval } from "../core/useApproval";
import type { ApprovalRecord, UseApprovalConfig, UseApprovalReturn } from "../core/useApproval";

export interface PaymentItem {
  id: string;
  amount: number;
  currency?: string;
  vendor: string;
  description: string;
}

/**
 * Money. Amounts are never editable and the undo window is long,
 * because "send $1200" deserves 30 seconds of regret.
 *
 * canUndo: true
 * undoMs:  30000
 * canEdit: false
 */
export type UsePaymentApprovalConfig = Omit<
  UseApprovalConfig<PaymentItem>,
  "canUndo" | "undoMs" | "canEdit"
>;

export interface UsePaymentApprovalReturn extends UseApprovalReturn<PaymentItem> {
  /** Total still awaiting a decision. */
  pendingTotal: number;
  /** Total already authorised (executing, undoing or settled). */
  committedTotal: number;
  /** Live countdown for the open undo window, in whole seconds. */
  undoSecondsLeft: number | null;
}

export function usePaymentApproval(config: UsePaymentApprovalConfig): UsePaymentApprovalReturn {
  const approval = useApproval<PaymentItem>({
    canUndo: true,
    undoMs: 30000,
    canEdit: false,
    ...config,
  });

  const { canUndoUntil, itemsWithState } = approval;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (canUndoUntil === null) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [canUndoUntil]);

  const pendingTotal = useMemo(
    () =>
      itemsWithState
        .filter((r: ApprovalRecord<PaymentItem>) =>
          ["needs_approval", "editing", "queued", "failed"].includes(r.status),
        )
        .reduce((sum, r) => sum + r.item.amount, 0),
    [itemsWithState],
  );

  const committedTotal = useMemo(
    () =>
      itemsWithState
        .filter((r: ApprovalRecord<PaymentItem>) => ["executing", "undoing", "success"].includes(r.status))
        .reduce((sum, r) => sum + r.item.amount, 0),
    [itemsWithState],
  );

  const undoSecondsLeft = useMemo(() => {
    if (canUndoUntil === null) return null;
    return Math.max(0, Math.ceil((canUndoUntil - now) / 1000));
  }, [canUndoUntil, now]);

  return { ...approval, pendingTotal, committedTotal, undoSecondsLeft };
}
