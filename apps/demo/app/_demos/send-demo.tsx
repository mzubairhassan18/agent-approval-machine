"use client";

import { useCallback, useState } from "react";

import { emailAdapter } from "agent-approval-machine/adapters";
import { useSendApproval } from "agent-approval-machine/machines";
import type { SendItem } from "agent-approval-machine/machines";
import {
  ApprovalQueueBanner,
  ApprovalStatusBadge,
  ApprovalTable,
  ApprovalTimeline,
  Badge,
  Button,
} from "agent-approval-machine/ui";

import { SDR_LEADS } from "./fixtures";
import { resetAttempts, resetLog, sendEmails, useExecutionLog } from "./mock-executors";
import { CodeBlock, LogPanel, Panel } from "./ui-kit";

const STRAIGHT_USE = `import { ApprovalTable } from "agent-approval-machine/ui"
import { useSendApproval } from "agent-approval-machine/machines"
import { emailAdapter } from "agent-approval-machine/adapters"

<ApprovalTable
  machine={useSendApproval}   // canUndo 5s, canEdit, edited tracking
  items={leads}               // what the agent drafted
  adapter={emailAdapter}      // how an email looks
  onExecute={sendEmails}      // { succeeded: [], failed: [{ item, error }] }
/>`;

/** Headless: same machine, zero UI from the library except small primitives. */
function QueueDemo() {
  const [items, setItems] = useState<SendItem[]>(() => [SDR_LEADS[1], SDR_LEADS[3]]);
  const [arrivals, setArrivals] = useState(0);

  const onExecute = useCallback(async (batch: SendItem[]) => {
    await new Promise((resolve) => setTimeout(resolve, 2600));
    return { succeeded: batch, failed: [] };
  }, []);

  const machine = useSendApproval({ items, onExecute });

  function arrive() {
    const next = arrivals + 1;
    setArrivals(next);
    // While the batch above is executing this lands in the queue, not the list.
    machine.addItems({
      id: `lead-arrival-${next}`,
      to: `new-lead-${next}@acme.com`,
      subject: `Arrived mid-flight #${next}`,
      body: "The agent kept working while a human was still deciding.",
    });
  }

  return (
    <Panel
      aside={
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={arrive} size="sm" variant="outline">
            new lead arrives
          </Button>
          <Button
            disabled={machine.summary.executing > 0}
            onClick={() => void machine.approve()}
            size="sm"
            variant="success"
          >
            {machine.summary.executing > 0 ? "executing…" : "approve all"}
          </Button>
        </div>
      }
      description="Two items at a time, 2.6s per send. Click 'new lead arrives' while it executes: addItems() queues instead of losing the item."
      title="Demo 1b · Headless (the queue)"
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <ApprovalTimeline records={machine.itemsWithState} />

          <ApprovalQueueBanner count={machine.queuedCount} onClear={machine.clearQueue} />

          <ul className="space-y-2">
            {machine.itemsWithState.map((record) => (
              <li
                className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/60"
                key={record.item.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                    {record.item.subject}
                  </p>
                  <p className="truncate font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                    {record.item.to}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {record.edited && <Badge variant="info">edited</Badge>}
                  <ApprovalStatusBadge status={record.status} />
                  {record.status === "undoing" && (
                    <Button onClick={() => machine.undo(record.item.id)} size="sm" variant="ghost">
                      undo
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <CodeBlock
            code={`const machine = useSendApproval({ items, onExecute })

// the human is still deciding; the agent is still working
machine.addItems({ id: "42", to: "new@acme.com", ... })

machine.queuedCount // 1  -> queued, not lost
machine.isExecuting // true
machine.canUndoUntil // epoch ms`}
            label="headless"
          />
          <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
            <div className="rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
              <p className="text-zinc-400 dark:text-zinc-500">queued</p>
              <p className="text-lg text-zinc-900 dark:text-zinc-100">{machine.queuedCount}</p>
            </div>
            <div className="rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
              <p className="text-zinc-400 dark:text-zinc-500">executing</p>
              <p className="text-lg text-zinc-900 dark:text-zinc-100">{machine.summary.executing}</p>
            </div>
            <div className="rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
              <p className="text-zinc-400 dark:text-zinc-500">undoable</p>
              <p className="text-lg text-zinc-900 dark:text-zinc-100">{machine.summary.undoing}</p>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function SendDemo() {
  const log = useExecutionLog();
  const [runKey, setRunKey] = useState(0);

  const onExecute = useCallback((batch: SendItem[]) => sendEmails(batch), []);

  function reset() {
    resetAttempts();
    resetLog();
    setRunKey((key) => key + 1);
  }

  return (
    <div className="space-y-8">
      <Panel
        aside={
          <Button onClick={reset} size="sm" variant="outline">
            reset demo
          </Button>
        }
        description="The agent drafted 5 emails. Approve all: 3 land, one hits a daily quota, one gets rate limited. Edit a body first and the edited value is what gets sent."
        title="Demo 1 · AI SDR inbox"
      >
        <ApprovalTable
          adapter={emailAdapter}
          items={SDR_LEADS}
          key={runKey}
          machine={useSendApproval}
          onExecute={onExecute}
          title="5 drafted emails"
        />

        <div className="grid gap-3 lg:grid-cols-2">
          <LogPanel entries={log} />
          <CodeBlock code={STRAIGHT_USE} label="straight use" />
        </div>
      </Panel>

      <QueueDemo />
    </div>
  );
}
