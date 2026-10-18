/**
 * agent-approval-machine
 *
 * Headless approval state machines for AI agents: edit before approve, partial
 * failure with a retry, undo windows, and a queue for items that arrive while a
 * tool call is still running.
 *
 * No framework, no UI, no CSS, no dependencies. This entry is plain state, so
 * it drives React, Vue, Svelte, Solid, Angular, a web worker or a <script>
 * tag. The glue for each is 5-15 lines, shown in the README.
 */

export * from "./store";
export * from "./presets";
