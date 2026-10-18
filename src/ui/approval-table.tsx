"use client";

import * as React from "react";

import { isOpenStatus } from "../core/useApproval";
import { Button } from "./components/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./components/card";
import { Checkbox } from "./components/checkbox";
import { cn } from "./lib/utils";
import { ApprovalActions, ApprovalQueueBanner, ApprovalStatusBadge, ApprovalTimeline } from "./parts";
import { useApprovalView } from "./use-approval-view";
import type { UseApprovalViewProps } from "./use-approval-view";

export interface ApprovalTableProps<T extends { id: string }> extends UseApprovalViewProps<T> {
  title?: React.ReactNode;
  className?: string;
}

/**
 * Table presentation: dense, scannable, bulk oriented.
 * Same core, same adapter — different chrome.
 */
export function ApprovalTable<T extends { id: string }>(props: ApprovalTableProps<T>) {
  const view = useApprovalView(props);
  const { approval, records } = view;
  const { adapter, title = "Approval queue" } = props;

  const openRecords = records.filter((r) => isOpenStatus(r.status));
  const allSelected =
    openRecords.length > 0 && openRecords.every((r) => approval.selectedIds.includes(r.item.id));

  return (
    <Card className={cn("w-full", props.className)} onKeyDown={view.hotkeys}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
            {records.length} rows
          </span>
        </div>
        <ApprovalTimeline className="pt-2" phase={view.phase} records={records} />
      </CardHeader>

      <CardContent className="space-y-2 px-0 pb-0">
        <div className="px-4">
          <ApprovalQueueBanner count={approval.queuedCount} onClear={() => approval.clearQueue()} />
        </div>

        {view.validationError && (
          <div
            className="mx-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            role="alert"
          >
            {view.validationError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-zinc-100 bg-zinc-50/60 text-left dark:border-zinc-800 dark:bg-zinc-900/40">
                {view.canSelect && (
                  <th className="w-10 px-4 py-2">
                    <Checkbox
                      aria-label="Select all"
                      checked={allSelected}
                      disabled={openRecords.length === 0}
                      onCheckedChange={() => approval.selectAll()}
                    />
                  </th>
                )}
                <th className="px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  item
                </th>
                <th className="w-32 px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  status
                </th>
                <th className="w-32 px-4 py-2" />
              </tr>
            </thead>

            <tbody>
              {records.map((record, index) => {
                const id = record.item.id;
                const open = isOpenStatus(record.status);

                return (
                  <tr
                    className={cn(
                      "border-b border-zinc-100 align-top dark:border-zinc-800",
                      record.status === "failed" && "bg-red-50/40 dark:bg-red-950/20",
                      record.status === "undoing" && "bg-amber-50/40 dark:bg-amber-950/20",
                      record.status === "success" && "bg-emerald-50/30 dark:bg-emerald-950/20",
                    )}
                    key={id}
                  >
                    {view.canSelect && (
                      <td className="px-4 py-3">
                        <Checkbox
                          aria-label={`Select item ${index + 1}`}
                          checked={approval.selectedIds.includes(id)}
                          disabled={!open}
                          onCheckedChange={() => approval.select(id)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {adapter.render(
                        record.item,
                        (patch) => approval.edit(id, patch),
                        view.contextFor(record),
                      )}
                      {record.error && (
                        <p className="mt-2 font-mono text-[11px] text-red-600 dark:text-red-400">
                          {record.error}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        <ApprovalStatusBadge status={record.status} />
                        {record.edited && record.status !== "editing" && (
                          <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">
                            edited
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        <Button
                          disabled={!open}
                          onClick={() => void view.approveIds([id])}
                          size="sm"
                          variant="outline"
                        >
                          Approve
                        </Button>
                        {record.status === "undoing" && (
                          <Button onClick={() => approval.undo(id)} size="sm" variant="ghost">
                            Undo
                          </Button>
                        )}
                        {record.status === "failed" && (
                          <Button
                            onClick={() => void approval.retryFailed()}
                            size="sm"
                            variant="ghost"
                          >
                            Retry
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {records.length === 0 && (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-xs text-zinc-400 dark:text-zinc-500"
                    colSpan={view.canSelect ? 4 : 3}
                  >
                    Nothing waiting for approval.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <CardFooter>
        <ApprovalActions {...view.actions} className="w-full" />
      </CardFooter>
    </Card>
  );
}
