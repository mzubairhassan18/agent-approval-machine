"use client";

import { useEffect, useState } from "react";

import { isOpenStatus } from "../core/useApproval";
import type { ApprovalRecord, ApprovalStatus } from "../core/useApproval";
import { Badge } from "./components/badge";
import { Button } from "./components/button";
import { cn } from "./lib/utils";

/* -------------------------------------------------------------------------- */
/* Phase timeline                                                              */
/* -------------------------------------------------------------------------- */

export type ApprovalPhase =
  | "searching"
  | "drafting"
  | "needs_approval"
  | "executing"
  | "success"
  | "partial"
  | "failed";

const STEPS: { key: ApprovalPhase; label: string }[] = [
  { key: "searching", label: "searching" },
  { key: "drafting", label: "drafting" },
  { key: "needs_approval", label: "needs approval" },
  { key: "executing", label: "executing" },
  { key: "success", label: "done" },
];

/** Fold item statuses into the single phase a demo can show as dots. */
export function derivePhase(records: ApprovalRecord<{ id: string }>[]): ApprovalPhase {
  const executing = records.filter((r) => r.status === "executing").length;
  const failed = records.filter((r) => r.status === "failed").length;
  const done = records.filter((r) => r.status === "success" || r.status === "undoing").length;
  const open = records.filter((r) => isOpenStatus(r.status) || r.status === "queued").length;

  if (executing) return "executing";
  if (failed && done) return "partial";
  if (failed && !done && !open) return "failed";
  if (done && !open) return "success";
  return "needs_approval";
}

function stepIndex(phase: ApprovalPhase): number {
  if (phase === "partial" || phase === "failed") return STEPS.length - 1;
  return Math.max(
    0,
    STEPS.findIndex((s) => s.key === phase),
  );
}

function dotTone(phase: ApprovalPhase, index: number, current: number) {
  if (index < current) return "bg-emerald-500";
  if (index > current) return "bg-zinc-300 dark:bg-zinc-700";
  if (phase === "failed") return "bg-red-500";
  if (phase === "partial") return "bg-amber-500";
  if (phase === "executing" || phase === "searching" || phase === "drafting")
    return "bg-blue-500 animate-pulse";
  return "bg-emerald-500";
}

export interface ApprovalTimelineProps {
  /** Force a phase (e.g. the agent is still searching, no items yet). */
  phase?: ApprovalPhase;
  records?: ApprovalRecord<{ id: string }>[];
  className?: string;
}

export function ApprovalTimeline({ phase, records = [], className }: ApprovalTimelineProps) {
  const active = phase ?? derivePhase(records);
  const current = stepIndex(active);

  return (
    <ol className={cn("flex items-center", className)} aria-label="approval progress">
      {STEPS.map((step, index) => (
        <li className="flex flex-1 items-center last:flex-none" key={step.key}>
          <div className="flex flex-col items-center gap-1">
            <span
              className={cn("h-2.5 w-2.5 rounded-full", dotTone(active, index, current))}
              aria-hidden
            />
            <span
              className={cn(
                "hidden whitespace-nowrap font-mono text-[10px] sm:block",
                index === current
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-400 dark:text-zinc-500",
              )}
            >
              {step.label}
            </span>
          </div>
          {index < STEPS.length - 1 && (
            <span
              className={cn(
                "-mt-4 h-px flex-1",
                index < current ? "bg-emerald-500/60" : "bg-zinc-200 dark:bg-zinc-800",
              )}
              aria-hidden
            />
          )}
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Status + queue + countdown                                                  */
/* -------------------------------------------------------------------------- */

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  needs_approval: "needs approval",
  editing: "edited",
  executing: "executing",
  success: "done",
  failed: "failed",
  undoing: "undo window",
  queued: "queued",
};

const STATUS_VARIANT: Record<ApprovalStatus, "muted" | "info" | "success" | "danger" | "warning"> = {
  needs_approval: "muted",
  editing: "info",
  executing: "info",
  success: "success",
  failed: "danger",
  undoing: "warning",
  queued: "muted",
};

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function ApprovalQueueBanner({
  count,
  onClear,
  className,
}: {
  count: number;
  onClear?: () => void;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
        className,
      )}
      role="status"
    >
      <span>
        <strong>{count}</strong> {count === 1 ? "item arrived" : "items arrived"} while executing —
        queued, not lost.
      </span>
      {onClear && (
        <Button onClick={onClear} size="sm" variant="ghost">
          clear
        </Button>
      )}
    </div>
  );
}

/** Ticks a countdown for the open undo window. */
export function useUndoCountdown(canUndoUntil: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (canUndoUntil === null) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [canUndoUntil]);

  if (canUndoUntil === null) return null;
  return Math.max(0, Math.ceil((canUndoUntil - now) / 1000));
}

/* -------------------------------------------------------------------------- */
/* Spinner + shared action bar                                                 */
/* -------------------------------------------------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn("h-3.5 w-3.5 animate-spin", className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
        fill="currentColor"
      />
    </svg>
  );
}

export interface ApprovalActionsProps {
  canSelect: boolean;
  selectedCount: number;
  approvableCount: number;
  failedCount: number;
  executingCount: number;
  undoCount: number;
  secondsLeft: number | null;
  onApprove: () => void;
  onDeny: () => void;
  onUndo: () => void;
  onRetry: () => void;
  denyLabel?: string;
  className?: string;
}

export function ApprovalActions({
  canSelect,
  selectedCount,
  approvableCount,
  failedCount,
  executingCount,
  undoCount,
  secondsLeft,
  onApprove,
  onDeny,
  onUndo,
  onRetry,
  denyLabel = "Deny",
  className,
}: ApprovalActionsProps) {
  const disabled = approvableCount === 0 || executingCount > 0;
  const approveLabel = canSelect && selectedCount > 0 ? `Approve ${selectedCount}` : "Approve all";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button disabled={disabled} onClick={onApprove} variant="success">
        {executingCount > 0 ? <Spinner /> : <span aria-hidden>✓</span>}
        {executingCount > 0 ? "executing…" : approveLabel}
      </Button>

      <Button
        disabled={disabled}
        onClick={onDeny}
        variant="outline"
      >
        {denyLabel}
        {canSelect && selectedCount > 0 ? ` ${selectedCount}` : ""}
      </Button>

      {undoCount > 0 && (
        <Button onClick={onUndo} variant="outline">
          <span aria-hidden>↺</span>
          Undo{secondsLeft !== null ? ` (${secondsLeft}s)` : ""}
        </Button>
      )}

      {failedCount > 0 && (
        <Button onClick={onRetry} variant="destructive">
          Retry {failedCount} failed
        </Button>
      )}

      <span className="ml-auto font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
        {approvableCount} open · {failedCount} failed · {undoCount} undoable
      </span>
    </div>
  );
}
