import { useMemo } from "react";

import { useApproval } from "../core/useApproval";
import type { ApprovalRecord, UseApprovalConfig, UseApprovalReturn } from "../core/useApproval";

export type PublishPlatform = "x" | "linkedin" | "blog" | "youtube" | "other";

export interface PublishItem {
  id: string;
  platform: PublishPlatform;
  content: string;
  previewUrl?: string;
}

/**
 * Content going out in public: posts, blog drafts, uploads.
 *
 * canUndo: true
 * canEdit: true
 * undoMs:  5000
 */
export type UsePublishApprovalConfig = Omit<
  UseApprovalConfig<PublishItem>,
  "canUndo" | "canEdit"
>;

export interface UsePublishApprovalReturn extends UseApprovalReturn<PublishItem> {
  editedItems: PublishItem[];
  /** Distinct platforms in play, useful for a "1 X, 2 LinkedIn" header. */
  platforms: PublishPlatform[];
}

export function usePublishApproval(config: UsePublishApprovalConfig): UsePublishApprovalReturn {
  const approval = useApproval<PublishItem>({
    canUndo: true,
    canEdit: true,
    undoMs: 5000,
    ...config,
  });

  const editedItems = useMemo(
    () =>
      approval.itemsWithState
        .filter((r: ApprovalRecord<PublishItem>) => r.edited)
        .map((r) => r.item),
    [approval.itemsWithState],
  );

  const platforms = useMemo(
    () => Array.from(new Set(approval.itemsWithState.map((r) => r.item.platform))),
    [approval.itemsWithState],
  );

  return { ...approval, editedItems, platforms };
}
