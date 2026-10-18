"use client";

import type { ActionRisk } from "../machines/useActionApproval";
import type { ActionItem } from "../machines/useActionApproval";
import type { ApprovalAdapter } from "./types";

const RISK_STYLES: Record<ActionRisk, string> = {
  low: "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  medium:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  high: "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  destructive:
    "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300",
};

export function RiskBadge({ risk }: { risk: ActionRisk }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${RISK_STYLES[risk]}`}
    >
      {risk === "destructive" && <span aria-hidden>▲</span>}
      {risk} risk
    </span>
  );
}

export const actionAdapter: ApprovalAdapter<ActionItem> = {
  name: "action",
  editFields: [],
  render: (item) => (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</div>
        <RiskBadge risk={item.risk} />
      </div>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{item.description}</p>
      <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
        read-only: no edit, no undo. approve or deny.
      </p>
    </div>
  ),
};
