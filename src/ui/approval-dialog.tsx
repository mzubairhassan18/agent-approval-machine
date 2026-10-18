"use client";

import * as React from "react";

import { isOpenStatus } from "../core/useApproval";
import type { ApprovalStatus } from "../core/useApproval";
import { Badge } from "./components/badge";
import { Button } from "./components/button";
import { Checkbox } from "./components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "./components/dialog";
import { cn } from "./lib/utils";
import {
  ApprovalActions,
  ApprovalQueueBanner,
  ApprovalStatusBadge,
  ApprovalTimeline,
} from "./parts";
import { useApprovalView } from "./use-approval-view";
import type { UseApprovalViewProps } from "./use-approval-view";

export interface ApprovalDialogProps<T extends { id: string }>
  extends UseApprovalViewProps<T> {
  /** Defaults to open: it is a panel, not a gate. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Render as a real overlay dialog instead of an inline panel. */
  modal?: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}

const ROW_TONE: Partial<Record<ApprovalStatus, string>> = {
  failed: "border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20",
  undoing: "border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20",
  success: "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/20",
  executing: "border-blue-200 bg-blue-50/30 dark:border-blue-900 dark:bg-blue-950/20",
  queued: "border-dashed border-zinc-300 bg-zinc-50/60 dark:border-zinc-700 dark:bg-zinc-900/40",
};

/**
 * The flagship presentation.
 *
 *   <ApprovalDialog items={emails} adapter={emailAdapter} onExecute={sendEmail} />
 *
 * Swap `adapter` and the same state machine reads as money or a meeting.
 */
export function ApprovalDialog<T extends { id: string }>(props: ApprovalDialogProps<T>) {
  const {
    open = true,
    onOpenChange,
    modal = false,
    title = "Approve before it happens",
    description,
    className,
  } = props;

  const view = useApprovalView(props);
  const { approval, records } = view;
  const { adapter } = props;

  const openRecords = records.filter((r) => isOpenStatus(r.status));
  const allOpenSelected =
    openRecords.length > 0 && openRecords.every((r) => approval.selectedIds.includes(r.item.id));

  const body = (
    <div className="space-y-3" onKeyDown={view.hotkeys}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {view.canSelect ? (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <Checkbox
              aria-label="Select all"
              checked={allOpenSelected}
              disabled={openRecords.length === 0}
              onCheckedChange={() => approval.selectAll()}
            />
            select all
          </label>
        ) : (
          <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
            canSelect: false — every open item is in scope
          </span>
        )}
        <div className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
          {approval.summary.needsApproval} open · {approval.summary.editing} in edit ·{" "}
          {approval.summary.failed} failed
        </div>
      </div>

      <ApprovalTimeline phase={view.phase} records={records} />

      <ApprovalQueueBanner
        count={approval.queuedCount}
        onClear={() => approval.clearQueue()}
      />

      {view.validationError && (
        <div
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          role="alert"
        >
          {view.validationError}
        </div>
      )}

      <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
        {records.length === 0 && (
          <p className="rounded-md border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
            Nothing waiting for approval.
          </p>
        )}

        {records.map((record, index) => {
          const id = record.item.id;
          const selected = approval.selectedIds.includes(id);
          const status = record.status;

          return (
            <div
              className={cn(
                "rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/60",
                ROW_TONE[status],
              )}
              key={id}
            >
              <div className="flex gap-3">
                {view.canSelect && (
                  <Checkbox
                    aria-label={`Select item ${index + 1}`}
                    checked={selected}
                    className="mt-1"
                    disabled={!isOpenStatus(status)}
                    onCheckedChange={() => approval.select(id)}
                  />
                )}

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                      #{index + 1}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {record.edited && status !== "editing" && <Badge variant="info">edited</Badge>}
                      <ApprovalStatusBadge status={status} />
                    </div>
                  </div>

                  {adapter.render(
                    record.item,
                    (patch) => approval.edit(id, patch),
                    view.contextFor(record),
                  )}

                  {record.error && (
                    <p className="rounded border border-red-200 bg-red-50 px-2 py-1 font-mono text-[11px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                      {record.error}
                    </p>
                  )}

                  {status === "undoing" && (
                    <Button onClick={() => approval.undo(id)} size="sm" variant="outline">
                      <span aria-hidden>↺</span>
                      Undo this one
                      {view.secondsLeft !== null ? ` (${view.secondsLeft}s)` : ""}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ApprovalActions {...view.actions} className="border-t border-zinc-100 pt-3 dark:border-zinc-800" />
    </div>
  );

  const content = (
    <DialogContent
      className={cn("max-w-2xl", modal && "", className)}
      onEscapeKeyDown={(event) => event.preventDefault()}
      onInteractOutside={(event) => {
        if (!modal) event.preventDefault();
      }}
      onPointerDownOutside={(event) => {
        if (!modal) event.preventDefault();
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {description ??
            "Edit, approve, undo, retry. The machine tracks every item — including the ones that fail."}
        </DialogDescription>
      </DialogHeader>
      {body}
    </DialogContent>
  );

  return (
    <Dialog modal={modal} onOpenChange={onOpenChange} open={open}>
      {modal ? (
        <DialogPortal>
          <DialogOverlay />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 p-4">
            {content}
          </div>
        </DialogPortal>
      ) : (
        content
      )}
    </Dialog>
  );
}
