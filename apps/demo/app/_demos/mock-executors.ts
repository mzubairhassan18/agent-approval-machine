"use client";

import { useEffect, useState } from "react";

import type { ApprovalResult } from "agent-approval-machine";
import type {
  ActionItem,
  PaymentItem,
  PublishItem,
  ScheduleItem,
  SendItem,
} from "agent-approval-machine/machines";

/* -------------------------------------------------------------------------- */
/* Tiny event bus so the demos can show what the executor actually received    */
/* -------------------------------------------------------------------------- */

export type LogKind = "info" | "success" | "error";

export interface LogEntry {
  id: number;
  at: string;
  kind: LogKind;
  message: string;
}

let sequence = 0;
let entries: LogEntry[] = [];
const listeners = new Set<(next: LogEntry[]) => void>();

export function log(kind: LogKind, message: string) {
  sequence += 1;
  entries = [
    ...entries.slice(-40),
    { id: sequence, at: new Date().toLocaleTimeString(), kind, message },
  ];
  listeners.forEach((listener) => listener(entries));
}

export function resetLog() {
  entries = [];
  listeners.forEach((listener) => listener(entries));
}

export function useExecutionLog(): LogEntry[] {
  const [snapshot, setSnapshot] = useState<LogEntry[]>(entries);

  useEffect(() => {
    listeners.add(setSnapshot);
    setSnapshot(entries);
    return () => {
      listeners.delete(setSnapshot);
    };
  }, []);

  return snapshot;
}

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                              */
/* -------------------------------------------------------------------------- */

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const attempts = new Map<string, number>();

function takeAttempt(id: string): number {
  const next = (attempts.get(id) ?? 0) + 1;
  attempts.set(id, next);
  return next;
}

export function resetAttempts() {
  attempts.clear();
}

/** Reports what was actually sent, so an edit is visible in the log. */
function reportEdited(original: string, sent: string, label: string) {
  if (original === sent) return;
  log("info", `${label}: payload differs from the draft — the edited value was sent`);
}

/* -------------------------------------------------------------------------- */
/* Executors (mock agent tools: no backend, no keys)                           */
/* -------------------------------------------------------------------------- */

export async function sendEmails(batch: SendItem[]): Promise<ApprovalResult<SendItem>> {
  log("info", `sendEmail(${batch.length}) → ${batch.map((item) => item.to).join(", ")}`);
  await wait(1300);

  const succeeded: SendItem[] = [];
  const failed: { item: SendItem; error: string }[] = [];

  for (const item of batch) {
    const attempt = takeAttempt(item.id);
    if (item.id === "lead-3" && attempt === 1) {
      failed.push({ item, error: "quota exceeded: 2/2 daily limit on acme.com" });
    } else if (item.id === "lead-5" && attempt === 1) {
      failed.push({ item, error: "429 rate limited by the mail provider — retryable" });
    } else {
      succeeded.push(item);
    }
  }

  if (succeeded.length) {
    log("success", `sent ${succeeded.length}: ${succeeded.map((i) => i.to).join(", ")}`);
  }
  for (const failure of failed) {
    log("error", `failed ${failure.item.to} — ${failure.error}`);
  }

  return { succeeded, failed };
}

export async function executeActions(batch: ActionItem[]): Promise<ApprovalResult<ActionItem>> {
  log("info", `stripe.refunds.create(${batch.length})`);
  await wait(1000);
  log("success", `refunded ${batch.map((item) => item.id).join(", ")} — irreversible, no undo offered`);
  return { succeeded: batch, failed: [] };
}

export async function bookMeeting(batch: ScheduleItem[]): Promise<ApprovalResult<ScheduleItem>> {
  for (const item of batch) {
    if (!item.selectedTime) {
      log("error", `${item.title}: no time picked`);
      return { succeeded: [], failed: [{ item, error: "Pick a time before approving" }] };
    }
  }
  log("info", `calendar.createEvent(${batch.map((item) => item.selectedTime).join(", ")})`);
  await wait(900);
  log("success", `booked ${batch.map((item) => `${item.title} @ ${item.selectedTime}`).join(", ")}`);
  return { succeeded: batch, failed: [] };
}

export async function approvePayments(batch: PaymentItem[]): Promise<ApprovalResult<PaymentItem>> {
  const total = batch.reduce((sum, item) => sum + item.amount, 0);
  log("info", `transfer.create({ amount: ${total}, vendor: "${batch[0]?.vendor}" })`);
  await wait(1100);
  log("success", `authorised $${total} — 30s undo window open`);
  return { succeeded: batch, failed: [] };
}

export async function publishPosts(batch: PublishItem[]): Promise<ApprovalResult<PublishItem>> {
  log("info", `publish(${batch.map((item) => item.platform).join(", ")})`);
  await wait(1100);

  const succeeded: PublishItem[] = [];
  const failed: { item: PublishItem; error: string }[] = [];

  for (const item of batch) {
    const attempt = takeAttempt(item.id);
    if (item.platform === "blog" && attempt === 1) {
      failed.push({ item, error: "CMS webhook timed out after 30s" });
    } else {
      succeeded.push(item);
    }
  }

  if (succeeded.length) log("success", `published: ${succeeded.map((i) => i.platform).join(", ")}`);
  for (const failure of failed) {
    log("error", `failed ${failure.item.platform} — ${failure.error}`);
  }

  return { succeeded, failed };
}

export { reportEdited };
