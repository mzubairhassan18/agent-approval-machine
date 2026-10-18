import { useMemo } from "react";

import { useApproval } from "../core/useApproval";
import type { ApprovalRecord, UseApprovalConfig, UseApprovalReturn } from "../core/useApproval";

export type ActionRisk = "low" | "medium" | "high" | "destructive";

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  risk: ActionRisk;
}

/**
 * Consequential actions: delete, refund, cancel, revoke.
 *
 * Reduced machine.
 * canUndo: false - you cannot un-refund a refund
 * canEdit: false - the AI's proposal is the proposal; approve or deny
 */
export type UseActionApprovalConfig = Omit<
  UseApprovalConfig<ActionItem>,
  "canUndo" | "canEdit"
>;

export interface UseActionApprovalReturn extends UseApprovalReturn<ActionItem> {
  /** Anything above `low`. These want a deliberate click. */
  highRiskItems: ActionItem[];
  destructiveCount: number;
}

export function useActionApproval(config: UseActionApprovalConfig): UseActionApprovalReturn {
  const approval = useApproval<ActionItem>({
    canUndo: false,
    canEdit: false,
    ...config,
  });

  const highRiskItems = useMemo(
    () =>
      approval.itemsWithState
        .filter((r: ApprovalRecord<ActionItem>) => r.item.risk !== "low")
        .map((r) => r.item),
    [approval.itemsWithState],
  );

  const destructiveCount = useMemo(
    () =>
      approval.itemsWithState.filter(
        (r: ApprovalRecord<ActionItem>) => r.item.risk === "destructive",
      ).length,
    [approval.itemsWithState],
  );

  return { ...approval, highRiskItems, destructiveCount };
}
