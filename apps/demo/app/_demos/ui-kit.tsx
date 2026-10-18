"use client";

import { useState } from "react";

export function CodeBlock({
  code,
  label,
  className,
}: {
  code: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
        <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          {label ?? "tsx"}
        </span>
        <button
          className="rounded px-2 py-0.5 font-mono text-[11px] text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          onClick={copy}
          type="button"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[12px] leading-relaxed text-zinc-800 dark:text-zinc-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
  aside,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
          {description && (
            <p className="mt-0.5 max-w-2xl text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
          )}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function LogPanel({ entries }: { entries: { id: number; at: string; kind: string; message: string }[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="border-b border-zinc-200 px-3 py-1.5 font-mono text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        onExecute log (what the tool really received)
      </div>
      <div className="max-h-56 space-y-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
        {entries.length === 0 && (
          <p className="text-zinc-400 dark:text-zinc-600">
            nothing yet — approve something and watch the payload
          </p>
        )}
        {entries.map((entry) => (
          <p
            className={
              entry.kind === "error"
                ? "text-red-600 dark:text-red-400"
                : entry.kind === "success"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-600 dark:text-zinc-300"
            }
            key={entry.id}
          >
            <span className="text-zinc-400 dark:text-zinc-600">{entry.at} </span>
            {entry.message}
          </p>
        ))}
      </div>
    </div>
  );
}
