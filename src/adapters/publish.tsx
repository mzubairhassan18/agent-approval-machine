"use client";

import type { PublishItem } from "../machines/usePublishApproval";
import type { ApprovalAdapter } from "./types";

const PLATFORM_LABEL: Record<PublishItem["platform"], string> = {
  x: "X",
  linkedin: "LinkedIn",
  blog: "Blog",
  youtube: "YouTube",
  other: "Other",
};

const PLATFORM_STYLES: Record<PublishItem["platform"], string> = {
  x: "border-zinc-300 bg-zinc-900 text-white dark:border-zinc-600",
  linkedin: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  blog: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  youtube: "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300",
  other: "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export const publishAdapter: ApprovalAdapter<PublishItem> = {
  name: "publish",
  editFields: ["content"],
  validate: (item) => (item.content.trim().length > 0 ? null : "Nothing to publish"),
  render: (item, onEdit, ctx) => (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${PLATFORM_STYLES[item.platform]}`}
        >
          {PLATFORM_LABEL[item.platform]}
        </span>
        {item.previewUrl && (
          <a
            className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-500 dark:text-blue-400"
            href={item.previewUrl}
            rel="noreferrer"
            target="_blank"
          >
            preview
          </a>
        )}
      </div>

      {ctx.editable ? (
        <div>
          <textarea
            aria-label="Content"
            className="w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:ring-blue-900/40"
            onChange={(event) => onEdit({ content: event.target.value })}
            rows={6}
            value={item.content}
          />
          <div className="mt-1 text-right font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
            {item.content.length} characters
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {item.content}
        </p>
      )}
    </div>
  ),
};
