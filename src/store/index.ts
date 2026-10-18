/**
 * agent-approval-machine/store
 *
 * The framework-free entry. Nothing here imports React (or anything else), so
 * it runs in Vue, Svelte, Solid, Angular, Alpine, a web worker, a CLI, or a
 * plain <script type="module">. Write ~5 lines of glue for your framework:
 *
 *   const store = createApprovalStore({ items, onExecute });
 *   const unsub = store.subscribe(() => render(store.getSnapshot()));
 *   await store.approve();
 *   unsub(); store.destroy();
 *
 * The React binding lives in `agent-approval-machine/core`.
 */

export * from "../core/store";
