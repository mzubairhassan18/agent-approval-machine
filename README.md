# agent-approval-machine

**Headless approval state machines for AI agents.** Edit before approve, partial failure with retry, undo windows, and a queue for items that arrive while a tool call is still running.

Not a UI kit, not a React library. Plain TypeScript state with **zero dependencies** and no framework in it — the published package contains no JSX, no components, no CSS, and imports nothing at all. Drive it from React, Vue, Svelte, Angular, Solid, a web worker, a CLI, or a `<script>` tag.

```
Every AI agent rebuilds these 5 conditions:

  1. select all / select one
  2. edit before approve         (and send the edited value, not the draft)
  3. partial failure             2 succeed, 1 fails, with a reason and a retry
  4. undo window with a timer    recall inside 5s / 30s, cancel on recall
  5. queue                       new items arrive while executing — not lost

This package is that logic, five times over, on one core.
```

**Live demos:** [10 real-world use cases, no install](https://mzubairhassan18.github.io/agent-approval-machine/) — plus the same ten flows as full apps: [Next.js + shadcn/ui](https://mzubairhassan18.github.io/agent-approval-machine-demo-nextjs/), [Vue + Vuetify](https://mzubairhassan18.github.io/agent-approval-machine-demo-vue/) and [Angular Material](https://mzubairhassan18.github.io/agent-approval-machine-demo-angular/) (source: [Next](https://github.com/mzubairhassan18/agent-approval-machine-demo-nextjs) · [Vue](https://github.com/mzubairhassan18/agent-approval-machine-demo-vue) · [Angular](https://github.com/mzubairhassan18/agent-approval-machine-demo-angular)).

---

## Install

```bash
npm i agent-approval-machine
```

Zero dependencies. 2.5 kB gzipped. The whole package is one file of state.

| | |
| --- | --- |
| minified | 6.5 kB |
| **gzipped** | **2.45 kB** |
| dependencies | **none** |
| peer dependencies | **none** |
| ships | ESM + CJS + types |

---

## Quick start

```ts
import { createApprovalStore } from "agent-approval-machine";

const store = createApprovalStore({
  items: draftedReplies,          // T[] where T extends { id: string }
  canUndo: true,                  // default true
  undoMs: 5000,                   // default 5000
  canEdit: true,                  // default true
  canSelect: true,                // default true
  onExecute: async (batch) => send(batch),   // may return partial success
  onUndo: async (batch) => unsend(batch),
});

store.subscribe(() => render(store.getSnapshot()));

const s = store.getSnapshot();
s.itemsWithState;   // [{ item, original, status, error?, edited, undoDeadline? }]
s.summary;          // { needsApproval, editing, executing, failed, undoing, queued, ... }
s.queuedCount;      // items that arrived while executing
s.canUndoUntil;     // epoch ms, or null

store.select(id);
store.selectAll();
store.edit(id, patch);
await store.approve(ids);     // no ids -> selection, or everything open
store.deny(ids);
store.undo(id);
await store.retryFailed();
store.addItems(newItems);
store.clearQueue();
store.destroy();              // cancels pending undo timers
```

Two things make this work in any framework:

- **`getSnapshot()` is referentially stable.** It returns the *same object* until state actually changes, so `useSyncExternalStore`, Vue's `shallowRef`, Svelte stores and Solid signals all behave — no tearing, no render loops.
- **`setConfig` never touches state.** Pass flags and callbacks through it (safe during a render pass); pass the item list through `syncItems(items)`. Items are compared **by value**, so rebuilding `items` inline every render does not loop.

---

## The five machines

These were five React hooks. The rules were never React — they are four flags, so they ship as plain data you spread into the store:

```ts
import { createApprovalStore, paymentApproval } from "agent-approval-machine";

const store = createApprovalStore({ items, ...paymentApproval, onExecute: pay });
```

| Preset | canUndo | undoMs | canEdit | Why |
| --- | --- | --- | --- | --- |
| `sendApproval` | yes | 5000 | yes | drafts are meant to be rewritten |
| `actionApproval` | no | — | no | you cannot un-refund |
| `scheduleApproval` | yes | 5000 | yes | pick a slot, then commit |
| `paymentApproval` | yes | 30000 | no | moving money by accident costs more than waiting |
| `publishApproval` | yes | 5000 | yes | content is editable until it is live |

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

## Partial failure is the point

`onExecute` returns per-item outcomes instead of throwing away the batch:

```ts
onExecute: async (batch) => ({
  succeeded: batch.filter((r) => r.ok),
  failed: batch
    .filter((r) => !r.ok)
    .map((item) => ({ item, error: "provider quota exceeded" })),
});
```

Two items land in `success` (or `undoing`), one lands in `failed` with its reason attached to that item. `retryFailed()` retries **only** the failures. A thrown error is caught and converted into a per-item failure, and `onExecute` is optional — with none, approving succeeds immediately.

---

## Using it in your framework

### React (18+)

The entire binding. Copy these ~30 lines into your app; there is nothing to install.

```tsx
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { createApprovalStore } from "agent-approval-machine";
import type { ApprovalStore, UseApprovalConfig } from "agent-approval-machine";

export function useApproval<T extends { id: string }>(config: UseApprovalConfig<T>) {
  const ref = useRef<ApprovalStore<T> | null>(null);
  if (ref.current === null) ref.current = createApprovalStore(config);
  const store = ref.current;

  store.setConfig(config);                       // flags + callbacks, no state change
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  useEffect(() => { store.syncItems(config.items); }, [config.items]);
  useEffect(() => () => store.destroy(), [store]);

  return useMemo(
    () => ({
      ...snapshot,
      select: store.select, selectAll: store.selectAll, edit: store.edit,
      approve: store.approve, deny: store.deny, undo: store.undo,
      retryFailed: store.retryFailed, addItems: store.addItems,
      clearQueue: store.clearQueue, reset: store.reset,
    }),
    [snapshot, store],
  );
}
```

### Vue 3

```vue
<script setup>
import { onScopeDispose, shallowRef, watch } from "vue";
import { createApprovalStore } from "agent-approval-machine";

const props = defineProps({ items: Array });
const store = createApprovalStore({ items: props.items, onExecute: send });

const snapshot = shallowRef(store.getSnapshot());
const unsubscribe = store.subscribe(() => { snapshot.value = store.getSnapshot(); });

watch(() => props.items, store.syncItems);
onScopeDispose(() => { unsubscribe(); store.destroy(); });
</script>

<template>
  <button @click="store.approve()">Approve {{ snapshot.summary.needsApproval }}</button>
</template>
```

### Angular

```ts
import { Injectable, signal, OnDestroy } from "@angular/core";
import { createApprovalStore } from "agent-approval-machine";
import type { ApprovalSnapshot, ApprovalStore, UseApprovalConfig } from "agent-approval-machine";

@Injectable({ providedIn: "root" })
export class ApprovalService<T extends { id: string }> implements OnDestroy {
  readonly snapshot = signal<ApprovalSnapshot<T> | null>(null);
  private store?: ApprovalStore<T>;
  private unsubscribe?: () => void;

  attach(config: UseApprovalConfig<T>): ApprovalStore<T> {
    this.unsubscribe?.();
    this.store?.destroy();
    this.store = createApprovalStore(config);
    this.snapshot.set(this.store.getSnapshot());
    this.unsubscribe = this.store.subscribe(() => this.snapshot.set(this.store.getSnapshot()!));
    return this.store;
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
    this.store?.destroy();
  }
}
```

### Vanilla JS

```html
<script type="module">
  import { createApprovalStore } from "https://esm.sh/agent-approval-machine";

  const store = createApprovalStore({ items, onExecute: mockSend });
  const paint = () => { list.replaceChildren(...store.getSnapshot().itemsWithState.map(renderRow)); };
  store.subscribe(paint);
  paint();
</script>
```

Svelte, Solid and everything else are the same three lines: `createApprovalStore`, `subscribe`, and put the snapshot in your framework's reactive primitive. Working end-to-end versions of React, Vue, Angular and vanilla live in the demo repos linked at the top.

---

## Development

```bash
pnpm install
pnpm test          # 33 tests: store, presets, and the store driven from real Vue
pnpm typecheck
pnpm build         # tsup -> ESM + CJS + d.ts
```

Layout:

```
src/store.ts       the state machine: types + pure reducer + createApprovalStore
src/presets.ts     the 5 machines as plain data
tests/             store (no framework), presets, framework (real Vue SSR)
docs/              the GitHub Pages demo site
notes/PROJECTS.md  the four repos: file map, UI-change recipes, deploy reference
```

The test suite runs in plain Node — no jsdom, no DOM, no renderer — and one guard test asserts the package declares **no dependencies and no framework peer**. If someone ever adds React back to this package, CI fails.

There is one deliberate quirk worth knowing: items are compared by value, not by reference, because callers build lists inline. `stableStringify` avoids a re-render loop while still letting the agent's own streaming updates through — unless a human has edited that item, in which case the human wins.

---

## What this is not

No UI, no components, no CSS, no theme. No backend, no database, no auth, no persistence, no queue service. `onExecute` is your function — it runs in your process, with your credentials. Deliberately out of scope: workflow engines, multi-step approvals, role hierarchies, cron, audit logs.

You are not locked out of a nice UI, though: the demo repos show a complete shadcn/ui (Next.js), Vuetify (Vue) and Angular Material implementation of all ten use cases, built on this package.

MIT.
