"use client";

import { useCallback, useState } from "react";

import { publishAdapter } from "agent-approval-machine/adapters";
import { usePublishApproval } from "agent-approval-machine/machines";
import type { PublishItem } from "agent-approval-machine/machines";
import { ApprovalDialog, Button } from "agent-approval-machine/ui";

import { POSTS } from "./fixtures";
import { publishPosts, resetAttempts, useExecutionLog } from "./mock-executors";
import { CodeBlock, LogPanel, Panel } from "./ui-kit";

const CONTENT = `const publish = usePublishApproval({
  items: posts,                  // an X post and a blog draft
  onExecute: publishPosts,       // blog fails the first time
})

publish.editedItems              // drafts a human touched
publish.platforms                // ["x", "blog"]

// Partial failure is not special: one success, one failure,
// a per-item reason, and a retry that only retries the failure.`;

export function PublishDemo() {
  const log = useExecutionLog();
  const [runKey, setRunKey] = useState(0);

  const onExecute = useCallback((batch: PublishItem[]) => publishPosts(batch), [
  ]);

  return (
    <Panel
      aside={
        <Button
          onClick={() => {
            resetAttempts();
            setRunKey((key) => key + 1);
          }}
          size="sm"
          variant="outline"
        >
          reset demo
        </Button>
      }
      description="Two platforms, one dialog. The blog webhook times out; the X post goes out. Edit either draft before approving — the edited text is what publishing receives."
      title="Demo 5 · Publisher"
    >
      <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr]">
        <ApprovalDialog
          adapter={publishAdapter}
          items={POSTS}
          key={runKey}
          machine={usePublishApproval}
          onExecute={onExecute}
          title="2 drafts ready to publish"
        />

        <div className="space-y-3">
          <LogPanel entries={log} />
          <CodeBlock code={CONTENT} label="content machine" />
        </div>
      </div>
    </Panel>
  );
}
