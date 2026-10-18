"use client";

import type { SendItem } from "../machines/useSendApproval";
import type { ApprovalAdapter } from "./types";

export const emailAdapter: ApprovalAdapter<SendItem> = {
  name: "email",
  editFields: ["subject", "body"],
  validate: (item) => {
    if (!item.to?.trim()) return "Missing recipient";
    if (!item.subject?.trim()) return "Missing subject";
    if (!item.body?.trim()) return "Missing body";
    return null;
  },
  render: (item, onEdit, ctx) => (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          To
        </span>
        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {item.to}
        </span>
      </div>

      {ctx.editable ? (
        <input
          aria-label="Subject"
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-blue-900/40"
          onChange={(event) => onEdit({ subject: event.target.value })}
          placeholder="Subject"
          value={item.subject}
        />
      ) : (
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.subject}</div>
      )}

      {ctx.editable ? (
        <div>
          <textarea
            aria-label="Body"
            className="w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:ring-blue-900/40"
            onChange={(event) => onEdit({ body: event.target.value })}
            rows={5}
            value={item.body}
          />
          <div className="mt-1 text-right font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
            {item.body.length} characters
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {item.body}
        </p>
      )}
    </div>
  ),
};
