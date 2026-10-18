"use client";

import { useCallback, useMemo, useState } from "react";
import type * as React from "react";

import { isOpenStatus, useApproval } from "../core/useApproval";
import type {
  ApprovalExecutor,
  ApprovalRecord,
  ApprovalUndoHandler,
  UseApprovalConfig,
  UseApprovalReturn,
} from "../core/useApproval";
import type { AdapterRenderContext, ApprovalAdapter } from "../adapters/types";
import { derivePhase, useUndoCountdown } from "./parts";
import type { ApprovalActionsProps, ApprovalPhase } from "./parts";
import { isTextEntry } from "./lib/utils";

/**
 * The state owner behind a presentation. Defaults to `useApproval`; pass a
 * machine (`useSendApproval`, `usePaymentApproval`, ...) to get its defaults
 * and guards while keeping the same UI.
 */
export type ApprovalMachine<T extends { id: string }> = (
  config: UseApprovalConfig<T>,
) => UseApprovalReturn<T>;

export interface UseApprovalViewProps<T extends { id: string }> {
  items: T[];
  adapter: ApprovalAdapter<T>;
  onExecute?: ApprovalExecutor<T>;
  onUndo?: ApprovalUndoHandler<T>;
  canUndo?: boolean;
  undoMs?: number;
  canEdit?: boolean;
  canSelect?: boolean;
  /** Force the timeline phase (agent still searching, items not ready yet). */
  phase?: ApprovalPhase;
  /** Swap the machine. Defaults to the generic `useApproval`. */
  machine?: ApprovalMachine<T>;
}

export interface ApprovalView<T extends { id: string }> {
  approval: UseApprovalReturn<T>;
  records: ApprovalRecord<T>[];
  phase: ApprovalPhase;
  secondsLeft: number | null;
  validationError: string | null;
  editable: boolean;
  canSelect: boolean;
  contextFor: (record: ApprovalRecord<T>) => AdapterRenderContext;
  /** Validate + approve an explicit set of ids. Used by bulk and per-item buttons. */
  approveIds: (ids: string[]) => Promise<void>;
  /** Deny an explicit set of ids. */
  denyIds: (ids: string[]) => void;
  actions: ApprovalActionsProps;
  /** Attach to the container: Enter approves, Esc denies. Text fields stay safe. */
  hotkeys: (event: React.KeyboardEvent) => void;
}

/**
 * Shared logic behind every presentation of the machine (dialog, card, table).
 * Adapters render the payload; this renders the state.
 */
export function useApprovalView<T extends { id: string }>(
  props: UseApprovalViewProps<T>,
): ApprovalView<T> {
  const { items, adapter, onExecute, onUndo, canUndo, undoMs, phase: phaseOverride } = props;
  const editable = props.canEdit ?? true;
  const canSelect = props.canSelect ?? true;

  /**
   * Only defined keys reach the machine, so a machine's own defaults
   * (payment's 30s undo, for instance) survive an unset prop.
   */
  const machineConfig = useMemo<UseApprovalConfig<T>>(() => {
    const config: UseApprovalConfig<T> = { items };
    if (canUndo !== undefined) config.canUndo = canUndo;
    if (undoMs !== undefined) config.undoMs = undoMs;
    if (props.canEdit !== undefined) config.canEdit = props.canEdit;
    if (props.canSelect !== undefined) config.canSelect = props.canSelect;
    if (onExecute) config.onExecute = onExecute;
    if (onUndo) config.onUndo = onUndo;
    return config;
  }, [canUndo, items, onExecute, onUndo, props.canEdit, props.canSelect, undoMs]);

  const useMachine = props.machine ?? (useApproval as ApprovalMachine<T>);
  const approval = useMachine(machineConfig);

  const [validationError, setValidationError] = useState<string | null>(null);

  const records = approval.itemsWithState;

  const openRecords = useMemo(() => records.filter((r) => isOpenStatus(r.status)), [records]);
  const failedRecords = useMemo(() => records.filter((r) => r.status === "failed"), [records]);
  const undoRecords = useMemo(() => records.filter((r) => r.status === "undoing"), [records]);
  const executingCount = approval.summary.executing;

  const selectedOpen = useMemo(
    () => approval.selectedIds.filter((id) => openRecords.some((r) => r.item.id === id)),
    [approval.selectedIds, openRecords],
  );

  /** What a bare "Approve" click means right now. */
  const targetIds = useMemo(
    () => (canSelect && selectedOpen.length ? selectedOpen : openRecords.map((r) => r.item.id)),
    [canSelect, openRecords, selectedOpen],
  );

  const secondsLeft = useUndoCountdown(approval.canUndoUntil);
  const phase = phaseOverride ?? derivePhase(records);

  const { approve, deny, undo, retryFailed } = approval;

  const approveIds = useCallback(
    async (ids: string[]) => {
      const targets = openRecords.filter((r) => ids.includes(r.item.id));
      if (!targets.length) return;

      const invalid = targets
        .map((r) => adapter.validate?.(r.item) ?? null)
        .find((error) => error !== null);

      if (invalid) {
        setValidationError(invalid);
        return;
      }
      setValidationError(null);
      await approve(targets.map((r) => r.item.id));
    },
    [adapter, approve, openRecords],
  );

  const denyIds = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      setValidationError(null);
      deny(ids);
    },
    [deny],
  );

  const contextFor = useCallback(
    (record: ApprovalRecord<T>): AdapterRenderContext => ({
      status: record.status,
      editable: editable && isOpenStatus(record.status),
      disabled: record.status === "executing",
    }),
    [editable],
  );

  const hotkeys = useCallback(
    (event: React.KeyboardEvent) => {
      if (isTextEntry(event.target)) return;
      if (event.key === "Enter" && !event.shiftKey) {
        if (executingCount > 0 || !targetIds.length) return;
        event.preventDefault();
        void approveIds(targetIds);
      } else if (event.key === "Escape") {
        if (executingCount > 0 || !targetIds.length) return;
        event.preventDefault();
        denyIds(targetIds);
      }
    },
    [approveIds, denyIds, executingCount, targetIds],
  );

  const actions: ApprovalActionsProps = {
    canSelect,
    selectedCount: selectedOpen.length,
    approvableCount: openRecords.length,
    failedCount: failedRecords.length,
    executingCount,
    undoCount: undoRecords.length,
    secondsLeft,
    onApprove: () => void approveIds(targetIds),
    onDeny: () => denyIds(targetIds),
    onUndo: () => undo(),
    onRetry: () => void retryFailed(),
  };

  return {
    approval,
    records,
    phase,
    secondsLeft,
    validationError,
    editable,
    canSelect,
    contextFor,
    approveIds,
    denyIds,
    actions,
    hotkeys,
  };
}
