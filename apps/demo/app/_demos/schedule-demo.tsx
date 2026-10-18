"use client";

import { useCallback, useState } from "react";

import { scheduleAdapter } from "agent-approval-machine/adapters";
import { useScheduleApproval } from "agent-approval-machine/machines";
import type { ScheduleItem } from "agent-approval-machine/machines";
import { ApprovalDialog, Button } from "agent-approval-machine/ui";
import type { ApprovalPhase } from "agent-approval-machine/ui";

import { MEETINGS } from "./fixtures";
import { bookMeeting, useExecutionLog } from "./mock-executors";
import { CodeBlock, LogPanel, Panel } from "./ui-kit";

const EXTENDED_STATE = `const schedule = useScheduleApproval({ items, onExecute: bookMeeting })

schedule.needsTimePick  // items with no slot chosen yet -> picking_time
schedule.pickTime(id, "Wed 14:00")

// The adapter's validate() blocks the approve button until a time is picked:
//   validate: (item) => item.selectedTime ? null : "Pick a time before approving"`;

export function ScheduleDemo() {
  const log = useExecutionLog();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [phase, setPhase] = useState<ApprovalPhase | null>("searching");
  const [running, setRunning] = useState(false);

  const onExecute = useCallback((batch: ScheduleItem[]) => bookMeeting(batch), []);

  const runAgent = useCallback(() => {
    setRunning(true);
    setItems([]);
    setPhase("searching");
    setTimeout(() => setPhase("drafting"), 1100);
    setTimeout(() => {
      setItems(MEETINGS);
      setPhase(null);
      setRunning(false);
    }, 2400);
  }, []);

  return (
    <Panel
      aside={
        <div className="flex gap-2">
          <Button disabled={running} onClick={runAgent} size="sm">
            {running ? "agent working…" : items.length ? "run again" : "ask the assistant"}
          </Button>
        </div>
      }
      description="The agent searches the calendar, proposes two slots, and hands over. The human picks one, then approves. A third state — picking_time — lives in the machine, not in the component."
      title="Demo 3 · AI exec assistant"
    >
      <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-3">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
            <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">you: </span>
            Book a 30 minute intro with Ali sometime this week.
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center dark:border-zinc-700">
              <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {phase === "searching"
                  ? "searching calendar…"
                  : phase === "drafting"
                    ? "found 2 slots — drafting the invite…"
                    : "nothing running. Ask the assistant."}
              </p>
            </div>
          ) : (
            <ApprovalDialog
              adapter={scheduleAdapter}
              description="Slots come from the agent. The choice comes from the human. Approve stays blocked until one is picked."
              items={items}
              machine={useScheduleApproval}
              onExecute={onExecute}
              phase={phase ?? undefined}
              title="Book with Ali"
            />
          )}
        </div>

        <div className="space-y-3">
          <LogPanel entries={log} />
          <CodeBlock code={EXTENDED_STATE} label="extended machine" />
        </div>
      </div>
    </Panel>
  );
}
