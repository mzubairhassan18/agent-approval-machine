/**
 * Emits shadcn registry items for every machine.
 *
 *   npx shadcn@latest add https://approval-machines.vercel.app/r/use-send-approval.json
 *
 * Each item is self-contained source: the core hook plus one machine, with the
 * relative import rewritten so the files drop into a consumer's project.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

const CORE_SOURCE = read("src/core/useApproval.ts").replace(
  /from "\.\.\/core\/useApproval"/g,
  'from "./use-approval"',
);

const MACHINES = [
  {
    name: "use-send-approval",
    title: "useSendApproval",
    file: "src/machines/useSendApproval.ts",
    description:
      "Email / outbound message approval. canUndo 5s, canEdit, edited-item tracking, partial failure and queue on top of the headless core.",
    usage: "<ApprovalDialog machine={useSendApproval} items={emails} adapter={emailAdapter} />",
  },
  {
    name: "use-action-approval",
    title: "useActionApproval",
    file: "src/machines/useActionApproval.ts",
    description:
      "Consequential actions (delete, refund, cancel). Reduced machine: canUndo false, canEdit false, risk levels for the badge.",
    usage: "<ApprovalCard machine={useActionApproval} items={actions} adapter={actionAdapter} />",
  },
  {
    name: "use-schedule-approval",
    title: "useScheduleApproval",
    file: "src/machines/useScheduleApproval.ts",
    description:
      "Meeting booking with a picking_time step. pickTime(id, time) plus needsTimePick, so approve stays blocked until a human chooses.",
    usage: "schedule.pickTime(id, \"Wed 14:00\")",
  },
  {
    name: "use-payment-approval",
    title: "usePaymentApproval",
    file: "src/machines/usePaymentApproval.ts",
    description:
      "Money. canUndo with a 30s window, no editing, pending/committed totals and a live undoSecondsLeft countdown.",
    usage: "payment.undoSecondsLeft // 30",
  },
  {
    name: "use-publish-approval",
    title: "usePublishApproval",
    file: "src/machines/usePublishApproval.ts",
    description:
      "Public content: posts, blog drafts, uploads. canUndo 5s, canEdit, editedItems and platform tracking.",
    usage: "publish.platforms // [\"x\", \"blog\"]",
  },
];

function itemFor(machine) {
  const machineSource = read(machine.file).replace(
    /from "\.\.\/core\/useApproval"/g,
    'from "./use-approval"',
  );

  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: machine.name,
    type: "registry:hook",
    title: machine.title,
    description: machine.description,
    dependencies: [],
    registryDependencies: [],
    files: [
      {
        path: "hooks/use-approval.ts",
        type: "registry:hook",
        content: CORE_SOURCE,
      },
      {
        path: `hooks/${machine.name}.ts`,
        type: "registry:hook",
        content: `// ${machine.title} — from agent-approval-machine\n// ${machine.usage}\n\n${machineSource}`,
      },
    ],
  };
}

const items = MACHINES.map(itemFor);

const targets = [join(root, "registry"), join(root, "apps/demo/public/r")];
for (const target of targets) {
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const item of items) {
    const json = `${JSON.stringify(item, null, 2)}\n`;
    writeFileSync(join(target, `${item.name}.json`), json);
  }
  writeFileSync(
    join(target, "index.json"),
    `${JSON.stringify(
      {
        $schema: "https://ui.shadcn.com/schema/registry.json",
        name: "agent-approval-machine",
        homepage: "https://github.com/agent-approval-machine/agent-approval-machine",
        items,
      },
      null,
      2,
    )}\n`,
  );
}

console.log(`registry: wrote ${items.length} items to registry/ and apps/demo/public/r/`);
