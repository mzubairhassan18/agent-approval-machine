import { useMemo } from "react";

import { useApproval } from "../core/useApproval";
import type { ApprovalRecord, UseApprovalConfig, UseApprovalReturn } from "../core/useApproval";

export interface SendItem {
  id: string;
  to: string;
  subject: string;
  body: string;
}

/**
 * Email / DM / outbound message approval.
 *
 * canUndo: true   - a sent message can be recalled inside the window
 * canEdit: true   - fix the body before it goes out
 * undoMs:  5000
 */
export type UseSendApprovalConfig = Omit<
  UseApprovalConfig<SendItem>,
  "canUndo" | "canEdit" | "undoMs"
>;

export interface UseSendApprovalReturn extends UseApprovalReturn<SendItem> {
  /** Items carrying an edit that has not been sent yet. */
  editedItems: SendItem[];
}

export function useSendApproval(config: UseSendApprovalConfig): UseSendApprovalReturn {
  const approval = useApproval<SendItem>({
    canUndo: true,
    canEdit: true,
    undoMs: 5000,
    ...config,
  });

  const editedItems = useMemo(
    () => approval.itemsWithState.filter((r: ApprovalRecord<SendItem>) => r.edited).map((r) => r.item),
    [approval.itemsWithState],
  );

  return { ...approval, editedItems };
}
