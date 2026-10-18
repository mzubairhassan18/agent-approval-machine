/**
 * createApprovalStore - headless approval state machines.
 *
 * Zero dependencies, zero CSS, zero UI, zero framework imports. This file is
 * plain TypeScript: it runs in React, Vue, Svelte, Solid, Angular, a web worker
 * or a bare <script> tag. No binding ships in this package — the glue is 5-15
 * lines per framework, shown in the README.
 *
 * The 5 repetitive conditions every agent rebuilds:
 *   1. select all / select one
 *   2. edit before approve
 *   3. partial failure (2 succeed, 1 fails -> retry)
 *   4. undo window with a timer
 *   5. new items arriving while an execution is in flight (queue)
 *
 * Usage:
 *   const store = createApprovalStore({ items, onExecute });
 *   store.subscribe(() => render(store.getSnapshot()));
 *   await store.approve();
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/** Per-item lifecycle. `queued` items arrived while something was executing. */
export type ApprovalStatus =
  | "needs_approval"
  | "editing"
  | "executing"
  | "success"
  | "failed"
  | "undoing"
  | "queued";

export const APPROVAL_STATUSES: readonly ApprovalStatus[] = [
  "needs_approval",
  "editing",
  "executing",
  "success",
  "failed",
  "undoing",
  "queued",
] as const;

/** Terminal-ish statuses that no longer accept edits. */
const OPEN_STATUSES: readonly ApprovalStatus[] = ["needs_approval", "editing"];

export function isOpenStatus(status: ApprovalStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export interface ApprovalFailure<T> {
  item: T;
  error: string;
}

/** Partial failure is first class: 2 succeed, 1 fails, with the reason. */
export interface ApprovalResult<T> {
  succeeded: T[];
  failed: ApprovalFailure<T>[];
}

export type ApprovalExecutor<T> = (
  items: T[],
) => ApprovalResult<T> | Promise<ApprovalResult<T>>;

export type ApprovalUndoHandler<T> = (items: T[]) => void | Promise<void>;

/** One item plus where it is in the machine. */
export interface ApprovalRecord<T> {
  /** Live data. Contains edits once the user edits. */
  item: T;
  /** Data as it arrived, kept so undo/edit can be reasoned about. */
  original: T;
  status: ApprovalStatus;
  /** Only set on `failed`. */
  error?: string;
  /** True once `edit()` changed the payload that will be sent. */
  edited: boolean;
  /** Epoch ms when the undo window closes. Only set on `undoing`. */
  undoDeadline?: number;
}

export interface ApprovalSummary {
  total: number;
  needsApproval: number;
  editing: number;
  executing: number;
  success: number;
  failed: number;
  undoing: number;
  queued: number;
  selected: number;
}

export interface UseApprovalConfig<T extends { id: string }> {
  /** Items to track. New ids appearing here are picked up as `needs_approval`. */
  items: T[];
  /** Allow recall after success. Default: true. */
  canUndo?: boolean;
  /** Undo window in ms. Default: 5000. Money should use more (e.g. 30000). */
  undoMs?: number;
  /** Allow editing before approving. Default: true. */
  canEdit?: boolean;
  /** Allow selecting. When false, approve()/deny() default to all open items. Default: true. */
  canSelect?: boolean;
  /** Executor. Receives edited payloads. Return partial success, or throw. */
  onExecute?: ApprovalExecutor<T>;
  /** Called when the user recalls an item inside the undo window. */
  onUndo?: ApprovalUndoHandler<T>;
}

/** Everything a view needs to render, derived from state on every change. */
export interface ApprovalSnapshot<T extends { id: string }> {
  itemsWithState: ApprovalRecord<T>[];
  selectedIds: string[];
  queuedItems: T[];
  queuedCount: number;
  isExecuting: boolean;
  /** Epoch ms when the last undo window closes, or null. */
  canUndoUntil: number | null;
  summary: ApprovalSummary;
}

/** The verbs. Identical in every binding. */
export interface ApprovalActions<T extends { id: string }> {
  select: (id: string) => void;
  selectAll: () => void;
  edit: (id: string, patch: Partial<T>) => void;
  approve: (ids?: string[]) => Promise<ApprovalResult<T>>;
  deny: (ids?: string[]) => void;
  undo: (id?: string) => void;
  retryFailed: () => Promise<ApprovalResult<T>>;
  addItems: (items: T | T[]) => void;
  clearQueue: () => void;
  reset: (items?: T[]) => void;
}

/** What `useApproval()` returns: a snapshot plus the verbs. */
export interface UseApprovalReturn<T extends { id: string }>
  extends ApprovalSnapshot<T>,
    ApprovalActions<T> {}

/** Raw internal state. Exposed for devtools and debugging. */
export interface ApprovalState<T extends { id: string }> {
  records: ApprovalRecord<T>[];
  selected: string[];
  /** Denied ids. Kept so a still-present prop item does not come back. */
  dismissed: string[];
}

export interface ApprovalStore<T extends { id: string }> extends ApprovalActions<T> {
  /** Current view of state. Referentially stable until something changes. */
  getSnapshot: () => ApprovalSnapshot<T>;
  /** Raw records/selection/dismissals. */
  getState: () => ApprovalState<T>;
  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
  /**
   * Swaps flags and callbacks (canUndo, undoMs, canEdit, canSelect, onExecute,
   * onUndo). Never touches state and never notifies, so it is safe to call
   * during a render pass. Call `syncItems` to change the item list.
   */
  setConfig: (config: UseApprovalConfig<T>) => void;
  /**
   * Reconciles tracked records against a new source-of-truth item list:
   * unseen ids are added (queued if something is executing), untouched records
   * are refreshed by value, dismissed ids stay dismissed.
   */
  syncItems: (items: T[]) => void;
  /** Cancels pending undo timers. Call on unmount / scope dispose. */
  destroy: () => void;
}

/* -------------------------------------------------------------------------- */
/* Reducer                                                                     */
/* -------------------------------------------------------------------------- */

type Action<T> =
  | { type: "sync"; items: T[] }
  | { type: "select"; id: string }
  | { type: "selectAll" }
  | { type: "edit"; id: string; patch: Partial<T> }
  | { type: "start"; ids: string[] }
  | {
      type: "settle";
      ids: string[];
      succeeded: T[];
      failed: ApprovalFailure<T>[];
      canUndo: boolean;
      undoMs: number;
      at: number;
    }
  | { type: "undo"; ids: string[] }
  | { type: "expire"; ids: string[] }
  | { type: "dismiss"; ids: string[] }
  | { type: "add"; items: T[]; queued: boolean }
  | { type: "clearQueue" }
  | { type: "reset"; items: T[] };

function toRecord<T>(item: T, status: ApprovalStatus = "needs_approval"): ApprovalRecord<T> {
  return { item, original: item, status, edited: false };
}

/**
 * Key-order independent structural comparison.
 *
 * The props list is a source of truth, but callers build it inline
 * (`items={rows.map(toEmail)}`), so identities churn every render. Comparing by
 * identity here would re-render forever; comparing by value settles immediately.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function isSameData<T>(a: T, b: T): boolean {
  return a === b || stableStringify(a) === stableStringify(b);
}

function initState<T extends { id: string }>(items: T[]): ApprovalState<T> {
  return {
    records: items.map((item) => toRecord(item)),
    selected: [],
    dismissed: [],
  };
}

function isExecutingState<T>(records: ApprovalRecord<T>[]): boolean {
  return records.some((r) => r.status === "executing");
}

/** Queued items become actionable as soon as nothing is executing. */
function promoteQueue<T>(records: ApprovalRecord<T>[]): ApprovalRecord<T>[] {
  if (isExecutingState(records)) return records;
  let changed = false;
  const next = records.map((r) => {
    if (r.status !== "queued") return r;
    changed = true;
    return { ...r, status: "needs_approval" as ApprovalStatus };
  });
  return changed ? next : records;
}

/** Pure. Same input, same output, no timers, no framework. */
export function approvalReducer<T extends { id: string }>(
  state: ApprovalState<T>,
  action: Action<T>,
): ApprovalState<T> {
  switch (action.type) {
    case "sync": {
      const known = new Set(state.records.map((r) => r.item.id));
      const executing = isExecutingState(state.records);
      const dismissed = new Set(state.dismissed);

      let changed = false;

      // Refresh untouched records from the source of truth, by value.
      const records = state.records.map((r) => {
        if (r.edited || r.status === "executing" || r.status === "undoing") return r;
        if (r.status === "success" || r.status === "failed") return r;
        const next = action.items.find((i) => i.id === r.item.id);
        if (!next || isSameData(next, r.item)) return r;
        changed = true;
        return { ...r, item: next, original: next };
      });

      const additions: ApprovalRecord<T>[] = [];
      for (const item of action.items) {
        if (known.has(item.id) || dismissed.has(item.id)) continue;
        known.add(item.id);
        additions.push(toRecord(item, executing ? "queued" : "needs_approval"));
      }
      if (additions.length) changed = true;

      if (!changed) return state;
      return {
        ...state,
        records: additions.length ? [...records, ...additions] : records,
      };
    }

    case "select": {
      const has = state.selected.includes(action.id);
      return {
        ...state,
        selected: has
          ? state.selected.filter((id) => id !== action.id)
          : [...state.selected, action.id],
      };
    }

    case "selectAll": {
      const ids = state.records.filter((r) => isOpenStatus(r.status)).map((r) => r.item.id);
      const allSelected = ids.length > 0 && ids.every((id) => state.selected.includes(id));
      return { ...state, selected: allSelected ? [] : ids };
    }

    case "edit": {
      let changed = false;
      const records = state.records.map((r) => {
        if (r.item.id !== action.id || !isOpenStatus(r.status)) return r;
        changed = true;
        return {
          ...r,
          item: { ...r.item, ...action.patch },
          status: "editing" as ApprovalStatus,
          edited: true,
          error: undefined,
        };
      });
      return changed ? { ...state, records } : state;
    }

    case "start": {
      const ids = new Set(action.ids);
      const records = state.records.map((r) =>
        ids.has(r.item.id)
          ? { ...r, status: "executing" as ApprovalStatus, error: undefined }
          : r,
      );
      return {
        ...state,
        records,
        selected: state.selected.filter((id) => !ids.has(id)),
      };
    }

    case "settle": {
      const ids = new Set(action.ids);
      const okIds = new Set(action.succeeded.map((i) => i.id));
      const errors = new Map(action.failed.map((f) => [f.item.id, f.error]));

      const records = state.records.map((r) => {
        if (!ids.has(r.item.id)) return r;
        if (okIds.has(r.item.id)) {
          return {
            ...r,
            status: (action.canUndo ? "undoing" : "success") as ApprovalStatus,
            undoDeadline: action.canUndo ? action.at + action.undoMs : undefined,
            error: undefined,
            edited: false,
          };
        }
        return {
          ...r,
          status: "failed" as ApprovalStatus,
          error: errors.get(r.item.id) ?? "Execution returned no result for this item",
        };
      });

      return { ...state, records: promoteQueue(records) };
    }

    case "undo": {
      const ids = new Set(action.ids);
      let changed = false;
      const records = state.records.map((r) => {
        if (!ids.has(r.item.id) || r.status !== "undoing") return r;
        changed = true;
        return {
          ...r,
          status: "needs_approval" as ApprovalStatus,
          undoDeadline: undefined,
        };
      });
      return changed ? { ...state, records } : state;
    }

    case "expire": {
      const ids = new Set(action.ids);
      let changed = false;
      const records = state.records.map((r) => {
        if (!ids.has(r.item.id) || r.status !== "undoing") return r;
        changed = true;
        return {
          ...r,
          status: "success" as ApprovalStatus,
          undoDeadline: undefined,
        };
      });
      return changed ? { ...state, records } : state;
    }

    case "dismiss": {
      const ids = new Set(action.ids);
      if (!ids.size) return state;
      return {
        ...state,
        records: state.records.filter((r) => !ids.has(r.item.id)),
        selected: state.selected.filter((id) => !ids.has(id)),
        dismissed: [...state.dismissed, ...action.ids],
      };
    }

    case "add": {
      const known = new Set(state.records.map((r) => r.item.id));
      const additions = action.items
        .filter((i) => !known.has(i.id))
        .map((item) => toRecord(item, action.queued ? "queued" : "needs_approval"));
      if (!additions.length) return state;
      const readded = new Set(additions.map((r) => r.item.id));
      return {
        ...state,
        records: [...state.records, ...additions],
        // An explicitly re-added item is no longer considered dismissed.
        dismissed: state.dismissed.filter((id) => !readded.has(id)),
      };
    }

    case "clearQueue": {
      const records = state.records.filter((r) => r.status !== "queued");
      if (records.length === state.records.length) return state;
      return { ...state, records };
    }

    case "reset":
      return initState(action.items);

    default:
      return state;
  }
}

/* -------------------------------------------------------------------------- */
/* Derivation                                                                  */
/* -------------------------------------------------------------------------- */

/** Recomputes the view. Called once per state change, never per read. */
function derive<T extends { id: string }>(state: ApprovalState<T>): ApprovalSnapshot<T> {
  const queuedItems: T[] = [];
  let canUndoUntil: number | null = null;

  const summary: ApprovalSummary = {
    total: state.records.length,
    needsApproval: 0,
    editing: 0,
    executing: 0,
    success: 0,
    failed: 0,
    undoing: 0,
    queued: 0,
    selected: state.selected.length,
  };

  for (const record of state.records) {
    switch (record.status) {
      case "needs_approval":
        summary.needsApproval += 1;
        break;
      case "editing":
        summary.editing += 1;
        break;
      case "executing":
        summary.executing += 1;
        break;
      case "success":
        summary.success += 1;
        break;
      case "failed":
        summary.failed += 1;
        break;
      case "undoing":
        summary.undoing += 1;
        if (typeof record.undoDeadline === "number") {
          canUndoUntil =
            canUndoUntil === null
              ? record.undoDeadline
              : Math.max(canUndoUntil, record.undoDeadline);
        }
        break;
      case "queued":
        summary.queued += 1;
        queuedItems.push(record.item);
        break;
    }
  }

  return {
    itemsWithState: state.records,
    selectedIds: state.selected,
    queuedItems,
    queuedCount: queuedItems.length,
    isExecuting: summary.executing > 0,
    canUndoUntil,
    summary,
  };
}

/* -------------------------------------------------------------------------- */
/* Store                                                                       */
/* -------------------------------------------------------------------------- */

interface NormalizedConfig<T> {
  canUndo: boolean;
  undoMs: number;
  canEdit: boolean;
  canSelect: boolean;
  onExecute?: ApprovalExecutor<T>;
  onUndo?: ApprovalUndoHandler<T>;
}

function normalizeConfig<T extends { id: string }>(
  config: UseApprovalConfig<T>,
): NormalizedConfig<T> {
  return {
    canUndo: config.canUndo ?? true,
    undoMs: config.undoMs ?? 5000,
    canEdit: config.canEdit ?? true,
    canSelect: config.canSelect ?? true,
    onExecute: config.onExecute,
    onUndo: config.onUndo,
  };
}

export function createApprovalStore<T extends { id: string }>(
  config: UseApprovalConfig<T>,
): ApprovalStore<T> {
  let current = normalizeConfig(config);
  let state = initState(config.items);
  let snapshot = derive(state);

  const listeners = new Set<() => void>();
  // One timer per item, so a recall can cancel its own window.
  const undoTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function setState(next: ApprovalState<T>): void {
    if (next === state) return;
    state = next;
    snapshot = derive(state);
    for (const listener of [...listeners]) listener();
  }

  function openIds(): string[] {
    return state.records.filter((r) => isOpenStatus(r.status)).map((r) => r.item.id);
  }

  function defaultIds(): string[] {
    if (!current.canSelect) return openIds();
    return state.selected.length ? state.selected : openIds();
  }

  function clearTimer(id: string): void {
    const timer = undoTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      undoTimers.delete(id);
    }
  }

  /**
   * Runs the executor for the given ids and folds the result back in.
   * Partial failure, thrown errors and a missing executor are all handled here.
   */
  async function run(ids: string[]): Promise<ApprovalResult<T>> {
    const targets = state.records.filter(
      (r) => ids.includes(r.item.id) && (isOpenStatus(r.status) || r.status === "failed"),
    );
    if (!targets.length) return { succeeded: [], failed: [] };

    const batchIds = targets.map((r) => r.item.id);
    const batchItems = targets.map((r) => r.item);
    setState(approvalReducer(state, { type: "start", ids: batchIds }));

    let result: ApprovalResult<T>;
    try {
      result = current.onExecute
        ? await current.onExecute(batchItems)
        : { succeeded: batchItems, failed: [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result = {
        succeeded: [],
        failed: batchItems.map((item) => ({ item, error: message })),
      };
    }

    const { canUndo, undoMs } = current;
    const at = Date.now();
    setState(
      approvalReducer(state, {
        type: "settle",
        ids: batchIds,
        succeeded: result.succeeded ?? [],
        failed: result.failed ?? [],
        canUndo,
        undoMs,
        at,
      }),
    );

    if (canUndo && result.succeeded?.length) {
      for (const item of result.succeeded) {
        clearTimer(item.id);
        undoTimers.set(
          item.id,
          setTimeout(() => {
            undoTimers.delete(item.id);
            setState(approvalReducer(state, { type: "expire", ids: [item.id] }));
          }, undoMs),
        );
      }
    }

    return result;
  }

  return {
    getState: () => state,
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setConfig: (next) => {
      current = normalizeConfig(next);
    },
    syncItems: (items) => {
      setState(approvalReducer(state, { type: "sync", items }));
    },
    select: (id) => {
      if (!current.canSelect) return;
      setState(approvalReducer(state, { type: "select", id }));
    },
    selectAll: () => {
      setState(approvalReducer(state, { type: "selectAll" }));
    },
    edit: (id, patch) => {
      if (!current.canEdit) return;
      setState(approvalReducer(state, { type: "edit", id, patch }));
    },
    approve: async (ids) => run(ids ?? defaultIds()),
    deny: (ids) => {
      const target = ids ?? defaultIds();
      const valid = target.filter((id) =>
        state.records.some(
          (r) => r.item.id === id && (isOpenStatus(r.status) || r.status === "queued"),
        ),
      );
      if (valid.length) setState(approvalReducer(state, { type: "dismiss", ids: valid }));
    },
    undo: (id) => {
      const targets = state.records.filter(
        (r) => r.status === "undoing" && (id === undefined || r.item.id === id),
      );
      if (!targets.length) return;
      // Cancel this item's undo timer: the window is closed by the recall itself.
      for (const record of targets) clearTimer(record.item.id);
      setState(approvalReducer(state, { type: "undo", ids: targets.map((r) => r.item.id) }));
      void current.onUndo?.(targets.map((r) => r.item));
    },
    retryFailed: async () => {
      const ids = state.records.filter((r) => r.status === "failed").map((r) => r.item.id);
      if (!ids.length) return { succeeded: [], failed: [] };
      return run(ids);
    },
    addItems: (next) => {
      const list = Array.isArray(next) ? next : [next];
      if (!list.length) return;
      setState(
        approvalReducer(state, { type: "add", items: list, queued: isExecutingState(state.records) }),
      );
    },
    clearQueue: () => {
      setState(approvalReducer(state, { type: "clearQueue" }));
    },
    reset: (items) => {
      undoTimers.forEach((timer) => clearTimeout(timer));
      undoTimers.clear();
      setState(approvalReducer(state, { type: "reset", items: items ?? [] }));
    },
    destroy: () => {
      undoTimers.forEach((timer) => clearTimeout(timer));
      undoTimers.clear();
    },
  };
}
