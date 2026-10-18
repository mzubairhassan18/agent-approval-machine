"use client";

import { useCallback, useState } from "react";

import { paymentAdapter } from "agent-approval-machine/adapters";
import { usePaymentApproval } from "agent-approval-machine/machines";
import type { PaymentItem } from "agent-approval-machine/machines";
import { ApprovalDialog, ApprovalTimeline } from "agent-approval-machine/ui";

import { PAYMENTS } from "./fixtures";
import { approvePayments, useExecutionLog } from "./mock-executors";
import { CodeBlock, LogPanel, Panel } from "./ui-kit";

const MONEY = `const payment = usePaymentApproval({
  items: [invoice],
  onExecute: approvePayments,
})

// money gets a long undo window and no edit
payment.undoSecondsLeft   // 30 ... 29 ... 28
payment.pendingTotal      // 1200
payment.committedTotal    // 0 -> 1200 once approved

// The adapter renders the amount big and the risk badge high.
// Nothing is re-implemented per screen: same dialog, different adapter.`;

export function PaymentDemo() {
  const log = useExecutionLog();
  const [items] = useState<PaymentItem[]>(PAYMENTS);

  const onExecute = useCallback((batch: PaymentItem[]) => approvePayments(batch), []);

  return (
    <Panel
      description="Same dialog, different adapter. $1200 gets no edit field and a 30 second undo window, because that is what the machine says, not because a component decided."
      title="Demo 4 · Payments (money, 30s undo)"
    >
      <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-3">
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            A finance agent wants to pay an overdue invoice. Approve it, then undo it inside the
            window — the same machine, just <span className="font-mono">undoMs: 30000</span>.
          </div>

          <ApprovalDialog
            adapter={paymentAdapter}
            description="Amounts are not editable. Undo is, for 30 seconds."
            items={items}
            machine={usePaymentApproval}
            onExecute={onExecute}
            title="Approve payment"
          />

          <ApprovalTimeline />
        </div>

        <div className="space-y-3">
          <LogPanel entries={log} />
          <CodeBlock code={MONEY} label="money machine" />
        </div>
      </div>
    </Panel>
  );
}
