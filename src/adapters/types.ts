"use client";

import type { ReactNode } from "react";

import type { ApprovalStatus } from "../core/useApproval";

/** Extra context the dialog hands to an adapter. */
export interface AdapterRenderContext {
  status: ApprovalStatus;
  /** True when the machine allows editing AND the item is still open. */
  editable: boolean;
  /** True once the item is executing/settled - inputs should be inert. */
  disabled: boolean;
}

/**
 * An adapter is the only place that knows what an item *looks* like.
 * Swapping it swaps the dialog's meaning without touching state logic.
 */
export interface ApprovalAdapter<T extends { id: string }> {
  name: string;
  render: (item: T, onEdit: (patch: Partial<T>) => void, context: AdapterRenderContext) => ReactNode;
  /** Return an error string to block approval, or null when valid. */
  validate?: (item: T) => string | null;
  /** Metadata: which fields this adapter lets a human touch. */
  editFields?: (keyof T & string)[];
}
