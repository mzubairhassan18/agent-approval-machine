/**
 * The five machine presets, as plain data.
 *
 * These used to be five React hooks. The rules were never React: they are four
 * flags. Keeping them as data means they apply unchanged in Vue, Svelte,
 * Angular or vanilla JS, and you can spread one straight into the store:
 *
 *   createApprovalStore({ items, ...paymentApproval, onExecute: pay })
 */
import type { UseApprovalConfig } from "./store";

/** The behavioural rules of a machine, without items or executor. */
export interface ApprovalPreset {
  /** May a human recall a success while the undo window is open? */
  canUndo: boolean;
  /** How long that window is, in ms. */
  undoMs?: number;
  /** May a human change the payload before approving? */
  canEdit: boolean;
  /** May a human pick items, or does every request act on everything open? */
  canSelect: boolean;
}

/**
 * Send: outbound messages. A human reads the draft, rewrites it if needed,
 * sends the batch, and can recall a send for 5 seconds.
 */
export const sendApproval: ApprovalPreset = {
  canUndo: true,
  undoMs: 5000,
  canEdit: true,
  canSelect: true,
};

/**
 * Action: consequential and irreversible. You cannot un-refund or un-delete,
 * so there is no undo and no editing — only a deliberate yes.
 */
export const actionApproval: ApprovalPreset = {
  canUndo: false,
  canEdit: false,
  canSelect: true,
};

/**
 * Schedule: committing something to a future time. Editable and recallable,
 * and the batch stays open until a human picks a slot.
 */
export const scheduleApproval: ApprovalPreset = {
  canUndo: true,
  undoMs: 5000,
  canEdit: true,
  canSelect: true,
};

/**
 * Payment: money. Not editable — the amount is what the agent computed — and a
 * long 30 second window, because moving money by accident costs far more than
 * waiting to confirm it.
 */
export const paymentApproval: ApprovalPreset = {
  canUndo: true,
  undoMs: 30000,
  canEdit: false,
  canSelect: true,
};

/**
 * Publish: content going public. Editable, and recallable while the window
 * is open.
 */
export const publishApproval: ApprovalPreset = {
  canUndo: true,
  undoMs: 5000,
  canEdit: true,
  canSelect: true,
};

/** All five, keyed by short name. */
export const approvalPresets = {
  send: sendApproval,
  action: actionApproval,
  schedule: scheduleApproval,
  payment: paymentApproval,
  publish: publishApproval,
} as const;

export type ApprovalPresetName = keyof typeof approvalPresets;
