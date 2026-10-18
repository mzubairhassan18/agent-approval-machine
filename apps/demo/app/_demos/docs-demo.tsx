"use client";

import { CodeBlock, Panel } from "./ui-kit";

const INSTALL = `pnpm add agent-approval-machine
# headless only, React >= 16.8: import from "agent-approval-machine/core"
# UI layer needs React >= 18 + Tailwind: "agent-approval-machine/ui"

# or pull one machine into your own codebase as source:
npx shadcn@latest add https://approval-machines.vercel.app/r/use-send-approval.json`;

const STRAIGHT = `// 1. STRAIGHT — one line, batteries included
import { ApprovalDialog } from "agent-approval-machine/ui"
import { emailAdapter } from "agent-approval-machine/adapters"

<ApprovalDialog items={emails} adapter={emailAdapter} onExecute={sendEmails} />`;

const ADAPTABLE = `// 2. ADAPTABLE — same dialog, different meaning
<ApprovalDialog items={invoices} adapter={paymentAdapter} onExecute={payInvoices} />
<ApprovalDialog items={posts}    adapter={publishAdapter} onExecute={publish} />
<ApprovalDialog items={actions}  adapter={actionAdapter}  onExecute={execute} />

// swap the machine when the rules differ
<ApprovalDialog machine={usePaymentApproval} items={invoices} adapter={paymentAdapter} />`;

const HEADLESS = `// 3. HEADLESS — no UI from the library at all
import { useApproval } from "agent-approval-machine/core"

const machine = useApproval<Email>({
  items: drafted,
  canUndo: true, undoMs: 5000,
  canEdit: true, canSelect: true,
  onExecute: async (batch) => sendEmails(batch), // { succeeded, failed }
  onUndo: async (batch) => unsendEmails(batch),
})

machine.itemsWithState  // [{ item, original, status, error?, edited, undoDeadline? }]
machine.summary         // { needsApproval, executing, failed, undoing, queued, ... }
machine.queuedCount     // items that arrived while executing
machine.canUndoUntil    // epoch ms, or null

machine.select(id); machine.selectAll(); machine.edit(id, patch)
await machine.approve(ids); machine.deny(ids); machine.undo(id)
await machine.retryFailed(); machine.addItems(newItems); machine.clearQueue()`;

function Row({ cells }: { cells: React.ReactNode[] }) {
  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
      {cells.map((cell, index) => (
        <td className="py-1.5 pr-4 align-top text-xs" key={index}>
          {cell}
        </td>
      ))}
    </tr>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-zinc-200 dark:border-zinc-800">
          {head.map((cell) => (
            <th
              className="py-1.5 pr-4 font-mono text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500"
              key={cell}
            >
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <Row cells={row} key={index} />
        ))}
      </tbody>
    </table>
  );
}

const mono = (text: string) => (
  <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200">{text}</span>
);

export function DocsDemo() {
  return (
    <div className="space-y-8">
      <Panel
        description="Not a UI kit. The 5 conditions every agent rebuilds live in a headless state machine; the components are a thin, optional shell over it."
        title="Docs · how to use it"
      >
        <CodeBlock code={INSTALL} label="install" />
      </Panel>

      <Panel description="Pick the level you need. Same core at every level." title="Three ways">
        <div className="grid gap-3 lg:grid-cols-3">
          <CodeBlock code={STRAIGHT} label="1 · straight" />
          <CodeBlock code={ADAPTABLE} label="2 · adaptable" />
          <CodeBlock code={HEADLESS} label="3 · headless" />
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel description="Config is the whole API surface." title="5 machines, one core">
          <Table
            head={["machine", "item", "canUndo", "canEdit"]}
            rows={[
              [mono("useSendApproval"), mono("to, subject, body"), mono("5s"), mono("yes")],
              [mono("useActionApproval"), mono("title, risk"), mono("no"), mono("no")],
              [mono("useScheduleApproval"), mono("proposedTimes[]"), mono("5s"), mono("pickTime")],
              [mono("usePaymentApproval"), mono("amount, vendor"), mono("30s"), mono("no")],
              [mono("usePublishApproval"), mono("platform, content"), mono("5s"), mono("yes")],
            ]}
          />
        </Panel>

        <Panel description="An adapter only knows what an item looks like." title="5 adapters">
          <Table
            head={["adapter", "renders", "edits"]}
            rows={[
              [mono("emailAdapter"), "to chip, subject, body + count", mono("subject, body")],
              [mono("actionAdapter"), "title, risk badge", mono("—")],
              [mono("scheduleAdapter"), "attendees, time buttons", mono("selectedTime")],
              [mono("paymentAdapter"), "amount big, risk high", mono("—")],
              [mono("publishAdapter"), "platform, preview", mono("content")],
            ]}
          />
        </Panel>

        <Panel description="Set by the machine, rendered by whatever you like." title="Item states">
          <Table
            head={["status", "means"]}
            rows={[
              [mono("needs_approval"), "waiting on a human"],
              [mono("editing"), "a human changed the payload; that version will be sent"],
              [mono("executing"), "onExecute is in flight"],
              [mono("success"), "done, undo window closed"],
              [mono("failed"), "rejected by the tool, with a reason; retryable"],
              [mono("undoing"), "done, but recallable until undoDeadline"],
              [mono("queued"), "arrived while executing; released when the batch settles"],
            ]}
          />
        </Panel>

        <Panel description="What this repo actually promises." title="Acceptance">
          <ul className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-300">
            {[
              "build works, 5 demo tabs render",
              "partial failure: 2 succeed, 1 fails, error shown, retry sends only the failure",
              "edit then approve sends the edited value, never the draft",
              "undo shows a live countdown and calls onUndo inside the window",
              "new items during executing land in queuedCount, then are released",
              "<ApprovalDialog /> straight use, adapter swap, headless useApproval — all three wired",
              "core is dependency-free; React 19 + Next 15 + Tailwind 4",
            ].map((line) => (
              <li className="flex gap-2" key={line}>
                <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                {line}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        description="The core is ~600 lines of reducer plus a config object. Reading it is the fastest way to trust it."
        title="Why not just Approve/Deny buttons"
      >
        <Table
          head={["condition", "what it costs without a machine"]}
          rows={[
            ["select all / one", mono("selection state in the component")],
            ["edit before approve", mono("draft state + which version gets sent")],
            ["partial failure", mono("per-item status, error, retry scope")],
            ["undo window", mono("timer, countdown, cancellation on recall")],
            ["queue", mono("what happens to items that arrive mid-flight")],
          ]}
        />
      </Panel>
    </div>
  );
}
