"use client";

import type { ScheduleItem } from "../machines/useScheduleApproval";
import type { ApprovalAdapter } from "./types";

export const scheduleAdapter: ApprovalAdapter<ScheduleItem> = {
  name: "schedule",
  editFields: ["selectedTime"],
  validate: (item) => (item.selectedTime ? null : "Pick a time before approving"),
  render: (item, onEdit, ctx) => (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</div>

      <div className="flex flex-wrap gap-1.5">
        {item.attendees.map((attendee) => (
          <span
            className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            key={attendee}
          >
            {attendee}
          </span>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {item.proposedTimes.map((time) => {
          const selected = item.selectedTime === time;
          return (
            <button
              className={[
                "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                selected
                  ? "border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-200 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-100 dark:ring-blue-900"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
                !ctx.editable ? "cursor-not-allowed opacity-70" : "",
              ].join(" ")}
              disabled={!ctx.editable}
              key={time}
              onClick={() => onEdit({ selectedTime: time })}
              type="button"
            >
              <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
                {selected ? "selected" : "slot"}
              </span>
              <div>{time}</div>
            </button>
          );
        })}
      </div>

      {!item.selectedTime && ctx.editable && (
        <p className="font-mono text-[11px] text-amber-600 dark:text-amber-400">
          picking_time: waiting on a human to choose a slot
        </p>
      )}
    </div>
  ),
};
