# agent-approval-machine

**Headless approval state machines for AI agents.** Edit before approve, partial failure, undo windows, and items that arrive while a tool is still running.

Not a UI kit. The UI is a thin, optional shell over a core that has no dependencies, no CSS, no components — and no framework in it.

```
Every AI agent rebuilds these 5 conditions:

  1. select all / select one
  2. edit before approve            (and send the edited value, not the draft)
  3. partial failure                2 succeed, 1 fails, with a reason and a retry
  4. undo window with a timer       recall inside 5s / 30s, cancel on recall
  5. queue                          new items arrive while executing — not lost

This package is that logic, five times over, with the same core.
```

Live demos: **[approval-machines.vercel.app](https://approval-machines.vercel.app)** — 5 tabs, mock agent tools, no backend.

---

## Install

```bash
pnpm add agent-approval-machine
# or: npm i agent-approval-machine
```

| Entry | Needs | For |
| --- | --- | --- |
| `agent-approval-machine/store` | nothing | the state machine itself, in **any** framework or plain JS |
| `agent-approval-machine/core` | React >= 18 | `useApproval`, the React binding (~40 lines) |
| `agent-approval-machine` | React >= 18 | everything (core + 5 machines) |
| `agent-approval-machine/machines` | React >= 18 | the 5 configured machines |
| `agent-approval-machine/adapters` | React >= 18 + Tailwind | how items look |
| `agent-approval-machine/ui` | React >= 18 + Tailwind | `ApprovalDialog`, `ApprovalCard`, `ApprovalTable` |

Nothing here has runtime dependencies except the UI layer (Radix Dialog/Checkbox, `clsx`, `tailwind-merge`). React is an *optional* peer dependency: you only need it for the React entries.

---

## Three ways to use it

### 1. Straight — one line

```tsx
import { ApprovalDialog } from "agent-approval-machine/ui";
import { emailAdapter } from "agent-approval-machine/adapters";

<ApprovalDialog items={emails} adapter={emailAdapter} onExecute={sendEmails} />;
```

### 2. Adaptable — same dialog, different meaning

```tsx
<ApprovalDialog items={invoices} adapter={paymentAdapter} onExecute={payInvoices} />
<ApprovalDialog items={posts}    adapter={publishAdapter} onExecute={publish} />
<ApprovalDialog items={actions}  adapter={actionAdapter}  onExecute={execute} />
```

Swap the machine when the rules differ — the UI follows:

```tsx
<ApprovalDialog machine={usePaymentApproval} items={invoices} adapter={paymentAdapter} />
```

### 3. Headless — no UI from the library at all

```ts
import { useApproval } from "agent-approval-machine/core";

const machine = useApproval<Email>({
  items: drafted,
  canUndo: true,
  undoMs: 5000,
  canEdit: true,
  canSelect: true,
  onExecute: async (batch) => sendEmails(batch), // { succeeded: [], failed: [{ item, error }] }
  onUndo: async (batch) => unsendEmails(batch),
});

machine.itemsWithState; // [{ item, original, status, error?, edited, undoDeadline? }]
machine.summary;        // { needsApproval, editing, executing, failed, undoing, queued, ... }
machine.queuedCount;    // items that arrived while executing
machine.canUndoUntil;   // epoch ms, or null

machine.select(id);
machine.selectAll();
machine.edit(id, patch);
await machine.approve(ids);
machine.deny(ids);
machine.undo(id);
await machine.retryFailed();
machine.addItems(newItems);
machine.clearQueue();
```

---

## Any framework (Vue, Svelte, Solid, vanilla)

`agent-approval-machine/store` is the same state machine with **no framework in it** — that file imports nothing at all. The React hook above is one binding on top of it, and it is ~40 lines. Write the same thing for yours:

```ts
import { createApprovalStore } from "agent-approval-machine/store";

const store = createApprovalStore<Email>({
  items: drafted,
  canUndo: true,
  undoMs: 5000,
  onExecute: sendEmails,
});

const unsubscribe = store.subscribe(() => render(store.getSnapshot()));

store.getSnapshot().queuedCount; // items that arrived while executing
store.edit(id, { subject: "Rewritten" });
await store.approve();
store.undo(id);

unsubscribe();
store.destroy(); // cancels any pending undo timer
```

Vue, in full:

```vue
<script setup>
import { onScopeDispose, shallowRef, watch } from "vue";
import { createApprovalStore } from "agent-approval-machine/store";

const props = defineProps({ items: Array });

const store = createApprovalStore({ items: props.items, onExecute: send });
const snapshot = shallowRef(store.getSnapshot());
const unsubscribe = store.subscribe(() => {
  snapshot.value = store.getSnapshot();
});

watch(() => props.items, store.syncItems);
onScopeDispose(() => {
  unsubscribe();
  store.destroy();
});
</script>

<template>
  <button @click="store.approve()">
    Approve {{ snapshot.summary.needsApproval }}
  </button>
</template>
```

Svelte, Solid, Angular, a web worker and a CLI need the same five lines.

Two details make this a drop-in for any framework:

- **`store.getSnapshot()` is referentially stable.** It returns the *same object* until state actually changes, so `useSyncExternalStore`, Vue's `shallowRef`, Svelte stores and Solid signals all behave — no tearing, no render loops.
- **`setConfig` never touches state.** Pass flags and callbacks through it (it is safe during a render pass); pass the item list through `syncItems(items)`. The store compares items **by value**, so an inline `items={rows.map(toEmail)}` that is rebuilt every render does not cause a loop.

`tests/framework.test.ts` runs this store inside a real Vue SSR render pass with React nowhere in the graph. If the claim ever stops being true, CI fails.

---

## The 5 machines

All five are the same core with a different config. Pick one, or copy it:

| Machine | Item | canUndo | canEdit | Extras |
| --- | --- | --- | --- | --- |
| `useSendApproval` | `{ id, to, subject, body }` | 5s | yes | `editedItems` |
| `useActionApproval` | `{ id, title, description, risk }` | no | no | `highRiskItems`, `destructiveCount` |
| `useScheduleApproval` | `{ id, title, proposedTimes[], selectedTime?, attendees[] }` | 5s | yes | `pickTime(id, time)`, `needsTimePick` |
| `usePaymentApproval` | `{ id, amount, vendor, description }` | 30s | no | `undoSecondsLeft`, `pendingTotal`, `committedTotal` |
| `usePublishApproval` | `{ id, platform, content, previewUrl? }` | 5s | yes | `editedItems`, `platforms` |

`risk` is `"low" | "medium" | "high" | "destructive"`. `selectedTime` is what makes the schedule machine's `picking_time` step: the agent proposes slots, a human chooses, then approves.

### Item states

| Status | Means |
| --- | --- |
| `needs_approval` | waiting on a human |
| `editing` | a human changed the payload; this version is what `onExecute` receives |
| `executing` | `onExecute` is in flight |
| `success` | done, undo window closed |
| `failed` | rejected by the tool, with a reason; only `retryFailed()` retries these |
| `undoing` | done, but recallable until `undoDeadline` |
| `queued` | arrived while executing; released as soon as the batch settles |

---

## The UI layer

Three presentations, one internal view hook — so they cannot drift apart:

| Component | Shape | Good for |
| --- | --- | --- |
| `ApprovalDialog` | inline panel (or `modal`), timeline, bulk actions | the default |
| `ApprovalCard` | one card per item, per-item Approve / Deny | items that need individual judgement |
| `ApprovalTable` | dense rows, bulk oriented | 10+ items |

They render `adapter.render(item, onEdit)` and nothing else from your data. Also exported: `ApprovalTimeline`, `ApprovalQueueBanner`, `ApprovalStatusBadge`, `Button`, `Badge`, `Card`, `Checkbox`, `Dialog`.

Keyboard: **Enter** approves what is selected, **Esc** denies it. Typing in a field never triggers either.

### Adapters

| Adapter | Renders | Edits |
| --- | --- | --- |
| `emailAdapter` | to chip, subject, body + character count | `subject`, `body` |
| `actionAdapter` | title, description, risk badge | — |
| `scheduleAdapter` | attendees, time-slot buttons | `selectedTime` |
| `paymentAdapter` | amount large, risk high, undo warning | — |
| `publishAdapter` | platform, content preview | `content` |

An adapter is just `{ name, render, validate?, editFields? }`. `validate(item)` returning a string blocks approval and shows the message — that is how the schedule adapter refuses to approve a meeting with no time picked.

---

## Copy a machine into your repo (shadcn registry)

```bash
npx shadcn@latest add https://approval-machines.vercel.app/r/use-send-approval.json
```

That writes `hooks/use-approval.ts` and `hooks/use-send-approval.ts` as **your** source — no dependency, no version to track. Replace `use-send-approval` with any of the five names.

---

## Why not just Approve / Deny buttons

A pair of buttons is the easy 10%. The rest is state:

| Condition | What it costs without a machine |
| --- | --- |
| select all / one | selection state plus partial-selection rules |
| edit before approve | draft state, and which version actually gets sent |
| partial failure | per-item status, per-item error, retry scope |
| undo window | timer, countdown, and cancellation when the human recalls |
| new items mid-flight | deciding whether to drop, block, or queue them |

Every screen that answers one of those differently is a bug waiting to be reported. Here they are answered once, in ~600 lines you can read.

---

## What this is not

No backend, no database, no auth, no persistence, no queue service. `onExecute` is your function — it runs in your process, with your credentials. No UI variants beyond the three above, no design system, no chart of every edge case.

Deliberately out of scope for v1: workflow engines, multi-step approvals, role hierarchies, scheduling/cron, audit logs.

---

## Development

```bash
pnpm install
pnpm test          # 51 tests: store, framework, partial failure, edit-then-approve, undo timer, queue
pnpm typecheck
pnpm build         # tsup -> ESM + CJS + d.ts, then re-applies "use client"
pnpm registry      # regenerate registry/*.json and apps/demo/public/r/*.json
pnpm demo          # builds the library, then Next 15 on :3000
```

Layout:

```
src/
  core/store.ts            the state machine: types + reducer + store, imports nothing
  core/useApproval.ts      the React binding (useSyncExternalStore, ~40 lines)
  store/index.ts           the framework-free package entry
  machines/                5 configs over the core
  adapters/                5 shapes for adapters to render
  ui/                      dialog, card, table, timeline, primitives
tests/                     store (no React), framework (real Vue), core, machines, UI
apps/demo/                 Next 15 + Tailwind 4, 5 tabs + docs tab
registry/                  shadcn registry items (generated)
```

There is one deliberate quirk worth knowing: the core compares item data by value, not by reference. Callers build `items` inline (`items={rows.map(toEmail)}`), so identity churns every render; a reference comparison re-renders forever. `stableStringify` avoids that while still letting the agent's own streaming updates through — unless a human has edited that item, in which case the human wins.

MIT.
