# Launch assets

Everything that is text is below. The only thing missing is screen recordings, which need a machine with a display.

## 0. Ship commands

```bash
# library
pnpm install
pnpm test && pnpm typecheck && pnpm build
pnpm registry                     # refresh registry + demo public/r

# npm (name must be free: npm view agent-approval-machine)
npm publish --access public

# demo
cd apps/demo && npx vercel --prod   # Root Directory: apps/demo

# registry URLs only work after the demo is live
#   https://approval-machines.vercel.app/r/use-send-approval.json
```

## 1. Three GIFs (15s each, 1200x720, dark mode)

Add them to `docs/media/` and link them at the top of the README.

### gif-1-partial-failure.gif — the differentiator

| Time | Do | Why it is on screen |
| --- | --- | --- |
| 0-3s | Tab 1, click **Approve all** | 5 leads go to `executing` |
| 3-6s | Let it settle | 3 land, two rows turn red with the quota and 429 reasons |
| 6-9s | Click **Retry 2 failed** | only the failures re-run — the point |
| 9-12s | Open the log panel | the retry payload has 2 items, not 5 |
| 12-15s | Cut to the "3 done · 2 failed" footer | it was never an error modal |

### gif-2-edit-and-undo.gif — the human edge

| Time | Do | Why |
| --- | --- | --- |
| 0-4s | Edit the body of lead #1, watch the `edited` badge appear | the draft is not what will be sent |
| 4-8s | Approve all, open the log | the log line says the payload differs from the draft |
| 8-13s | Click **Undo this one**, countdown visible | recall inside the window |
| 13-15s | Approved again, countdown hits 0, row goes green | the window is a real timer |

### gif-3-queue.gif — the one nobody handles

| Time | Do | Why |
| --- | --- | --- |
| 0-3s | Tab 1b, click **approve all** (2.6s per send) | two rows executing |
| 3-6s | Click **new lead arrives** twice mid-flight | the amber queue banner counts 2 |
| 6-9s | Banner says queued, not lost | the list did not grow mid-execution |
| 9-13s | Batch settles | the queued rows appear as `needs approval` |
| 13-15s | Cut to `machine.queuedCount` | the number is in the state, not the UI |

## 2. X / Twitter

> Every AI agent rebuilds approval state: edit before approve, partial failure, undo, queue.
>
> I built 5 headless machines — send, action, schedule, payment, publish. Same core, swappable adapters. Not a UI kit.
>
> React 19 + Next 15 + Tailwind 4. npm + live demos ↓

Reply thread:

> The part nobody handles: 2 of 5 succeed, 1 fails with a quota error. The card has to show per-item reasons, retry only the failures, and not lose the message that arrived while it was executing.
>
> That is now `machine.summary` + `machine.queuedCount`.

> Money gets `undoMs: 30000` and no edit field. Meetings get a `picking_time` step so approve stays blocked until a human picks a slot. Same core, different config.

Tag 3-4 builders, not companies. Do not name competitors.

## 3. Discords (Vercel AI SDK, AI Engineer)

> Built a headless approval machine for AI agents and the thing that took longest was not the UI — it was state.
>
> Handing a human a batch of `toolCalls` means answering: which ones are selected, what happens when they edit one, what a 2-succeed-1-fail result looks like, how long the undo window is, and where the message that arrives mid-execution goes.
>
> `useApproval` answers those once. 5 machines on the same core (`send`, `action`, `schedule`, `payment`, `publish`), plus `ApprovalDialog` if you want it for free. `onExecute` is a plain function returning `{ succeeded, failed: [{ item, error }] }`, so it drops onto tool results directly.
>
> Demo: https://approval-machines.vercel.app — repo: <link>. Happy to hear where the state model breaks for your agent.

## 4. Show HN

**Title**

> Show HN: Headless approval state machines for AI agents (partial failure, undo, queue)

**Body**

> I kept writing the same approval code in every agent project: which items are selected, editing one before approving, showing 2 successes and 1 failure with a reason, retrying only the failure, letting a human recall something for 5 seconds, and deciding what to do with items that arrive while a tool call is still running.
>
> This is that logic as a headless state machine. `useApproval` is a reducer with `itemsWithState`, selection, `edit`, `approve`, `deny`, `undo`, `retryFailed`, `addItems`, plus `summary` and `queuedCount`. `onExecute` is your function and returns partial results (`{ succeeded, failed: [{ item, error }] }`), which is how you find out that an email provider enforced a quota.
>
> Five machines are the same core with different config: send (undo 5s, editable), action (no undo, no edit — you cannot un-refund), schedule (adds a picking_time step so approve is blocked until a slot is chosen), payment (undo 30s, not editable), publish (editable, partial failure on one platform).
>
> The UI is optional and thin: `ApprovalDialog` / `ApprovalCard` / `ApprovalTable` render an adapter's `render(item, onEdit)` and nothing else. Core has zero dependencies; React >= 16.8.
>
> Demo (mock tools, no backend): https://approval-machines.vercel.app — Code: <repo> — npm: `agent-approval-machine`.
>
> Known limits: no persistence, no audit log, no multi-step approval chains. It is in-memory per screen, deliberately.

## 5. When the nudges land

- Registry URLs only resolve once the demo deploy is live — check `/r/use-send-approval.json` before posting.
- `npm view agent-approval-machine version` should show the published version.
- If someone asks "why not TanStack Query mutations?" the honest answer: this is per-item state across a batch, not one mutation. That is the whole point of `summary`.
