"use client";

import * as React from "react";

import { isOpenStatus } from "../core/useApproval";
import type { ApprovalStatus } from "../core/useApproval";
import { Badge } from "./components/badge";
import { Button } from "./components/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./components/card";
import { cn } from "./lib/utils";
import { ApprovalQueueBanner, ApprovalStatusBadge, ApprovalTimeline } from "./parts";
import { useApprovalView } from "./use-approval-view";
import type { UseApprovalViewProps } from "./use-approval-view";

export interface ApprovalCardProps<T extends { id: string }> extends UseApprovalViewProps<T> {
  title?: React.ReactNode;
  className?: string;
}

const ITEM_TONE: Partial<Record<ApprovalStatus, string>> = {
  failed: "border-red-200 dark:border-red-900",
  undoing: "border-amber-200 dark:border-amber-900",
  success: "border-emerald-200 dark:border-emerald-900",
  queued: "border-dashed border-zinc-300 dark:border-zinc-700",
};

/**
 * Card presentation: one card per item, with its own Approve / Deny.
 * Good when items are peers and deserve individual judgement.
 */
export function ApprovalCard<T extends { id: string }>(props: ApprovalCardProps<T>) {
  const view = useApprovalView(props);
  const { approval, records } = view;
  const { adapter, title = "Pending approval" } = props;

  return (
    <Card className={cn("w-full", props.className)} onKeyDown={view.hotkeys}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
            {records.length} items · {approval.summary.needsApproval} open
          </span>
        </div>
        <ApprovalTimeline className="pt-2" phase={view.phase} records={records} />
      </CardHeader>

      <CardContent className="space-y-3">
        <ApprovalQueueBanner count={approval.queuedCount} onClear={() => approval.clearQueue()} />

        {view.validationError && (
          <div
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            role="alert"
          >
            {view.validationError}
          </div>
        )}

        {records.map((record, index) => {
          const id = record.item.id;
          const open = isOpenStatus(record.status);

          return (
            <Card
              className={cn("bg-zinc-50/60 dark:bg-zinc-900/40", ITEM_TONE[record.status])}
              key={id}
            >
              <CardContent className="space-y-2 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                    #{index + 1}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {record.edited && record.status !== "editing" && <Badge variant="info">edited</Badge>}
                    <ApprovalStatusBadge status={record.status} />
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

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    disabled={!open}
                    onClick={() => void view.approveIds([id])}
                    size="sm"
                    variant="success"
                  >
                    Approve
                  </Button>
                  <Button
                    disabled={!open}
                    onClick={() => view.denyIds([id])}
                    size="sm"
                    variant="outline"
                  >
                    Deny
                  </Button>
                  {record.status === "undoing" && (
                    <Button onClick={() => approval.undo(id)} size="sm" variant="ghost">
                      <span aria-hidden>↺</span>
                      Undo{view.secondsLeft !== null ? ` (${view.secondsLeft}s)` : ""}
                    </Button>
                  )}
                  {record.status === "failed" && (
                    <Button onClick={() => void approval.retryFailed()} size="sm" variant="ghost">
                      Retry
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {records.length === 0 && (
          <p className="rounded-md border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
            Nothing waiting for approval.
          </p>
        )}
      </CardContent>

      <CardFooter className="justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {approval.summary.undoing > 0 && (
            <Button onClick={() => approval.undo()} size="sm" variant="outline">
              <span aria-hidden>↺</span>
              Undo all{view.secondsLeft !== null ? ` (${view.secondsLeft}s)` : ""}
            </Button>
          )}
          {approval.summary.failed > 0 && (
            <Button onClick={() => void approval.retryFailed()} size="sm" variant="destructive">
              Retry {approval.summary.failed} failed
            </Button>
          )}
        </div>
        <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
          {approval.summary.success} done · {approval.summary.failed} failed
        </span>
      </CardFooter>
    </Card>
  );
}
