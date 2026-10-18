import { useCallback, useMemo } from "react";

import { useApproval, isOpenStatus } from "../core/useApproval";
import type { ApprovalRecord, UseApprovalConfig, UseApprovalReturn } from "../core/useApproval";

export interface ScheduleItem {
  id: string;
  title: string;
  proposedTimes: string[];
  selectedTime?: string;
  attendees: string[];
}

/**
 * Meeting / booking approval. Extends core with a `picking_time` step:
 * the agent proposes slots, a human picks one, then approves.
 *
 * canUndo: true
 * canEdit: true (editing == picking a time)
 */
export type UseScheduleApprovalConfig = Omit<
  UseApprovalConfig<ScheduleItem>,
  "canUndo" | "canEdit"
>;

export interface UseScheduleApprovalReturn extends UseApprovalReturn<ScheduleItem> {
  /** Open items with no time chosen yet - these are in `picking_time`. */
  needsTimePick: ScheduleItem[];
  /** Choose a proposed slot. Returns it so callers can chain an approve. */
  pickTime: (id: string, time: string) => string | undefined;
}

export function useScheduleApproval(config: UseScheduleApprovalConfig): UseScheduleApprovalReturn {
  const approval = useApproval<ScheduleItem>({
    canUndo: true,
    canEdit: true,
    undoMs: 5000,
    ...config,
  });

  const { edit } = approval;

  const pickTime = useCallback(
    (id: string, time: string): string | undefined => {
      edit(id, { selectedTime: time });
      return time;
    },
    [edit],
  );

  const needsTimePick = useMemo(
    () =>
      approval.itemsWithState
        .filter(
          (r: ApprovalRecord<ScheduleItem>) => isOpenStatus(r.status) && !r.item.selectedTime,
        )
        .map((r) => r.item),
    [approval.itemsWithState],
  );

  return { ...approval, needsTimePick, pickTime };
}
