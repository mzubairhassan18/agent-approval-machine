/**
 * useApproval - the React binding.
 *
 * All the state, the actions and the timers live in ./store, which imports
 * nothing. This file only wires the store into React so a component re-renders
 * when the machine moves. Every export from ./store is re-exported here, so
 * existing imports from this module keep working.
 *
 * React >= 18 (useSyncExternalStore). No other runtime requirements.
 */

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { createApprovalStore } from "./store";
import type { ApprovalStore, UseApprovalConfig, UseApprovalReturn } from "./store";

export * from "./store";

export function useApproval<T extends { id: string }>(
  config: UseApprovalConfig<T>,
): UseApprovalReturn<T> {
  // One store per component instance. Created during the first render so SSR
  // and the first client paint agree.
  const storeRef = useRef<ApprovalStore<T> | null>(null);
  if (storeRef.current === null) storeRef.current = createApprovalStore(config);
  const store = storeRef.current;

  // Flags and callbacks are read at call time from the latest config, so the
  // callbacks never go stale and no re-render is needed to pick them up.
  // This does not touch state (see setConfig).
  store.setConfig(config);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  // The item list is a source of truth: reconcile when it changes.
  const { items } = config;
  useEffect(() => {
    store.syncItems(items);
  }, [store, items]);

  // Undo timers outlive the component unless we stop them.
  useEffect(() => {
    return () => store.destroy();
  }, [store]);

  return useMemo(
    () => ({
      ...snapshot,
      select: store.select,
      selectAll: store.selectAll,
      edit: store.edit,
      approve: store.approve,
      deny: store.deny,
      undo: store.undo,
      retryFailed: store.retryFailed,
      addItems: store.addItems,
      clearQueue: store.clearQueue,
      reset: store.reset,
    }),
    [snapshot, store],
  );
}
