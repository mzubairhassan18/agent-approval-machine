"use client";

import type { PaymentItem } from "../machines/usePaymentApproval";
import type { ApprovalAdapter } from "./types";

function formatAmount(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export const paymentAdapter: ApprovalAdapter<PaymentItem> = {
  name: "payment",
  editFields: [],
  validate: (item) => (item.amount > 0 ? null : "Amount must be greater than zero"),
  render: (item, _onEdit, ctx) => (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {formatAmount(item.amount, item.currency)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          <span aria-hidden>▲</span> high risk
        </span>
      </div>

      <div className="text-sm text-zinc-900 dark:text-zinc-100">{item.vendor}</div>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{item.description}</p>

      <p className="font-mono text-[11px] text-amber-600 dark:text-amber-400">
        {ctx.status === "undoing"
          ? "undo window open: 30s. recall is free, refunds are not."
          : "amounts are not editable. 30s undo window after approval."}
      </p>
    </div>
  ),
};
