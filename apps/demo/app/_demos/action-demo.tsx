"use client";

import { useCallback, useState } from "react";

import { actionAdapter } from "agent-approval-machine/adapters";
import { useActionApproval } from "agent-approval-machine/machines";
import type { ActionItem } from "agent-approval-machine/machines";
import { ApprovalCard } from "agent-approval-machine/ui";

import { SUPPORT_REQUESTS } from "./fixtures";
import { executeActions, useExecutionLog } from "./mock-executors";
import { CodeBlock, LogPanel, Panel } from "./ui-kit";

const REDUCED_MACHINE = `useActionApproval({
  items: refunds,
  onExecute: executeActions,
})

// canUndo: false  -> you cannot un-refund a refund
// canEdit: false  -> the agent's proposal is the proposal
// risk: "high"    -> the adapter renders a warning badge

// No undo button is rendered at all. Nothing is configured twice.`;

export function ActionDemo() {
  const log = useExecutionLog();
  const [items] = useState<ActionItem[]>(SUPPORT_REQUESTS);

  const onExecute = useCallback((batch: ActionItem[]) => executeActions(batch), []);

  return (
    <Panel
      description="One consequential action, reduced machine. The card presentation gives each item its own Approve / Deny — no bulk toolbar, because there is nothing to bulk."
      title="Demo 2 · Support refund (irreversible)"
    >
      <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          <div className="flex justify-end">
            <div className="max-w-sm rounded-2xl rounded-br-sm bg-blue-600 px-4 py-3 text-sm text-white shadow-sm">
              My order arrived and the shirt shrank after one wash. I don&apos;t want a replacement.
              Just refund me.
              <div className="mt-1 font-mono text-[10px] text-blue-100">
                customer · 2 minutes ago
              </div>
            </div>
          </div>

          <ApprovalCard
            adapter={actionAdapter}
            canSelect={false}
            items={items}
            machine={useActionApproval}
            onExecute={onExecute}
            title="Refund request"
          />
        </div>

        <div className="space-y-3">
          <LogPanel entries={log} />
          <CodeBlock code={REDUCED_MACHINE} label="reduced machine" />
        </div>
      </div>
    </Panel>
  );
}
