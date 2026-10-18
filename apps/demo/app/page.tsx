"use client";

import { useEffect, useState } from "react";

import { Badge, Button } from "agent-approval-machine/ui";

import { ActionDemo } from "./_demos/action-demo";
import { DocsDemo } from "./_demos/docs-demo";
import { PaymentDemo } from "./_demos/payment-demo";
import { PublishDemo } from "./_demos/publish-demo";
import { ScheduleDemo } from "./_demos/schedule-demo";
import { SendDemo } from "./_demos/send-demo";

type TabKey = "sdr" | "support" | "exec" | "payments" | "publish" | "docs";

const TABS: { key: TabKey; label: string; machine: string; render: () => React.ReactElement }[] = [
  { key: "sdr", label: "AI SDR inbox", machine: "useSendApproval", render: () => <SendDemo /> },
  { key: "support", label: "Support refund", machine: "useActionApproval", render: () => <ActionDemo /> },
  { key: "exec", label: "Exec assistant", machine: "useScheduleApproval", render: () => <ScheduleDemo /> },
  { key: "payments", label: "Payments", machine: "usePaymentApproval", render: () => <PaymentDemo /> },
  { key: "publish", label: "Publisher", machine: "usePublishApproval", render: () => <PublishDemo /> },
  { key: "docs", label: "Docs", machine: "3 ways to use", render: () => <DocsDemo /> },
];

export default function Page() {
  const [tab, setTab] = useState<TabKey>("sdr");
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("aam-theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  const active = TABS.find((entry) => entry.key === tab) ?? TABS[0];

  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 lg:px-8">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-6 space-y-6">
          <div>
            <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
              agent-approval-machine
            </p>
            <h1 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Approval is a state machine,
              <br />
              not a pair of buttons.
            </h1>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Edit before approve, partial failure, undo windows, queued items. Same core,
              swappable adapters.
            </p>
          </div>

          <nav className="space-y-1">
            {TABS.map((entry, index) => {
              const isActive = entry.key === tab;
              return (
                <button
                  className={[
                    "w-full rounded-md px-3 py-2 text-left text-xs transition-colors",
                    isActive
                      ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                  ].join(" ")}
                  key={entry.key}
                  onClick={() => setTab(entry.key)}
                  type="button"
                >
                  <span className="block font-medium">
                    {entry.key === "docs" ? "" : `${index + 1}. `}
                    {entry.label}
                  </span>
                  <span
                    className={[
                      "font-mono text-[10px]",
                      isActive ? "opacity-70" : "text-zinc-400 dark:text-zinc-500",
                    ].join(" ")}
                  >
                    {entry.machine}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">no backend</Badge>
              <Badge variant="outline">no deps in core</Badge>
              <Badge variant="outline">React 19</Badge>
            </div>
            <Button className="w-full" onClick={toggleTheme} size="sm" variant="outline">
              {dark ? "☾ dark" : "☀ light"}
            </Button>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2 font-mono text-[10px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
              npm i agent-approval-machine
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 space-y-6">
        <div className="flex flex-wrap items-center gap-2 lg:hidden">
          {TABS.map((entry) => (
            <Button
              key={entry.key}
              onClick={() => setTab(entry.key)}
              size="sm"
              variant={entry.key === tab ? "default" : "outline"}
            >
              {entry.label}
            </Button>
          ))}
          <Button onClick={toggleTheme} size="sm" variant="ghost">
            {dark ? "☾" : "☀"}
          </Button>
        </div>

        <header className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {active.label}
          </h2>
          <p className="max-w-3xl text-xs text-zinc-500 dark:text-zinc-400">
            Mock agent tools run in the browser — no keys, no database. Every approval, failure and
            retry you see is produced by the same core hook the package ships.
          </p>
        </header>

        {active.render()}
      </main>
    </div>
  );
}
