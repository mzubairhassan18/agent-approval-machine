/**
 * End-to-end check of the GitHub Pages demo (`docs/`) against the *packaged*
 * build, in jsdom. It caught a real bug before release (a `<textarea>` written
 * with self-closing syntax swallowed the rest of the row), so it is worth
 * re-running before publishing.
 *
 * Nothing in the library depends on this file, and it is not published
 * (`files` in package.json is dist + README + LICENSE). It needs jsdom, which
 * we do not want as a dependency, so copy it next to a scratch install and run
 * it from there (ESM resolves `jsdom` relative to this file, not the cwd):
 *
 *   mkdir verify-demo && cd verify-demo
 *   npm i jsdom
 *   tar -xzf ../_pkgs/agent-approval-machine-<version>.tgz   # unpacked build
 *   cp ../agent-approval-machine/notes/verify-pages-demo.mjs .
 *   $env:AAM_REPO="../agent-approval-machine"; $env:AAM_DIST="$PWD/package/dist/index.js"
 *   node verify-pages-demo.mjs
 *
 * The demo normally imports the package from esm.sh; the script points it at
 * the unpacked build through `window.AAM_PKG_URL` instead, so the check runs
 * offline. AAM_REPO and AAM_DIST default to this file's parent directory and
 * `./package/dist/index.js`.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { JSDOM } from "jsdom";

const REPO = process.env.AAM_REPO
  ? resolve(process.env.AAM_REPO)
  : fileURLToPath(new URL("..", import.meta.url)).replace(/[\\/]+$/, "");
const DIST = resolve(process.env.AAM_DIST ?? "package/dist/index.js");

const checks = [];
function check(label, ok, extra = "") {
  checks.push({ label, ok: Boolean(ok) });
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${extra ? `  [${extra}]` : ""}`);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const html = await readFile(`${REPO}/docs/index.html`, "utf8");
const dom = new JSDOM(html, { pretendToBeVisual: true, url: "https://example.test/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.AAM_PKG_URL = pathToFileURL(DIST).href;

await import(pathToFileURL(`${REPO}/docs/app.js`).href);
await sleep(400);

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

console.log("\nvanilla demo (docs/) against the packaged build\n");

check("boot banner reports the package loaded", $("#boot").className.includes("ok"), text($("#boot")).slice(0, 54));

const sections = $$("section.uc");
check("ten use-case sections rendered", sections.length === 10, `found ${sections.length}`);
check("the right-hand jump list has ten links", $$("#toc a").length === 10, `found ${$$("#toc a").length}`);

const first = sections[0];
check("section 1 is the support queue", text($(".uc-head h2", first)).includes("Support replies"));
check("flag chips show the machine's rules", text($(".flags", first)).includes("canEdit true"));
check("four rows to start", $$(".row", first).length === 4, `found ${$$(".row", first).length}`);

const firstRow = $(".row", first);
const editor = $(".row-edit", firstRow);
check("open rows render an editor", Boolean(editor));
editor.value = "Rewritten by a human before approving.";
editor.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
await sleep(60);
check("editing flips the row to edited", firstRow.className.includes("editing"), firstRow.className);
check("the edit hint appears", !$(".edit-hint", firstRow).hidden);

const approve = $('[data-act="approve"]', first);
check("approve button counts the open items", text(approve).includes("4"), text(approve));
approve.click();
await sleep(300);
check("rows move to executing", $$(".row.executing", first).length > 0, `${$$(".row.executing", first).length} executing`);

await sleep(700);
check("an item that arrived mid-flight is queued, not lost", $$(".row.queued", first).length === 1, `${$$(".row.queued", first).length} queued`);
check("the queue banner is shown", !$('[data-ref="queue"]', first).hidden, text($('[data-ref="queue-text"]', first)).slice(0, 46));

await sleep(2200);
check("partial failure: exactly one row failed", $$(".row.failed", first).length === 1, `${$$(".row.failed", first).length} failed`);
check("the failure carries the provider's reason", text($(".row.failed .row-error", first)).includes("rate limit"), text($(".row.failed .row-error", first)).slice(0, 44));
check("the three successes are in the undo window", $$(".row.undoing", first).length === 3, `${$$(".row.undoing", first).length} undoing`);
check("the queued item was released to needs_approval", $$(".row.needs_approval", first).length === 1, `${$$(".row.needs_approval", first).length} open`);
check("the undo window shows a live countdown", /^\d+\.\d+s$/.test(text($(".row.undoing .countdown", first))), text($(".row.undoing .countdown", first)));

const retry = $('[data-act="retry"]', first);
check("retry targets only the failure", text(retry) === "Retry 1 failed", text(retry));
retry.click();
await sleep(1400);
check("retrying the failure succeeds (no row left failed)", $$(".row.failed", first).length === 0, `${$$(".row.failed", first).length} failed`);
check("the retried row entered the undo window", $$(".row.undoing", first).length === 4, `${$$(".row.undoing", first).length} undoing`);

const recall = $(".row.undoing .recall", first);
check("recallable rows offer a Recall button", Boolean(recall));
recall.click();
await sleep(80);
check("recall returns that item to needs_approval", $$(".row.needs_approval", first).length === 2, `${$$(".row.needs_approval", first).length} open`);

check("section 2 formats money", text(sections[1]).includes("€4,120.50"));
check("section 4 shows the chosen slot", text(sections[3]).includes("slot: Thu 15:00 CET"));
check("section 5 renders no editor (canEdit false)", $$(".row-edit", sections[4]).length === 0);
check("section 5 renders no recall (canUndo false)", $$(".row.recall", sections[4]).length === 0);
check("destructive risk is surfaced", text(sections[4]).includes("destructive"));

const failed = checks.filter((c) => !c.ok);
console.log(`\nvanilla demo: ${checks.length - failed.length}/${checks.length} checks passed`);
// The demo keeps a refresh interval and undo timers alive; stop explicitly.
process.exit(failed.length ? 1 : 0);
