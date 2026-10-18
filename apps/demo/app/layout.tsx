import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "agent-approval-machine — 5 approval state machines for AI agents",
  description:
    "Headless state machines for human-in-the-loop approvals: edit before approve, partial failure, undo windows, queued items. Same core, swappable adapters.",
};

const THEME_SCRIPT = `
try {
  const stored = localStorage.getItem("aam-theme");
  const dark = stored ? stored === "dark" : true;
  document.documentElement.classList.toggle("dark", dark);
} catch (_) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">
        {children}
      </body>
    </html>
  );
}
