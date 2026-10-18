/**
 * Ten real-world approval flows on agent-approval-machine.
 *
 * Everything below is state plus DOM. There is no framework here on purpose:
 * the whole point of the package is that the five conditions every agent
 * rebuilds (select, edit, partial failure, undo window, queue) are plain state,
 * so a page like this one is glue, not architecture.
 */

const PKG_VERSION = "0.1.0";
const PKG_URL = `https://esm.sh/agent-approval-machine@${PKG_VERSION}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STATUS_LABEL = {
  needs_approval: "needs approval",
  editing: "edited",
  executing: "sending…",
  success: "done",
  failed: "failed",
  undoing: "sent · recallable",
  queued: "queued",
};

const isOpen = (status) => status === "needs_approval" || status === "editing";

const money = (value) =>
  "€" + Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ------------------------------------------------------------------ data */

/**
 * One entry per real-world flow. `flags` is a preset from the package; the rest
 * is the data a demo needs — items, an edit field, and which item the provider
 * rejects so partial failure is visible instead of theoretical.
 */
const USE_CASES = [
  {
    id: "support-replies",
    label: "Support replies",
    blurb:
      "An agent drafts replies to a support queue. A human reads each one, rewrites what is wrong, and sends. One mailbox is rate-limited, so that send fails alone.",
    flags: { canUndo: true, undoMs: 5000, canEdit: true, canSelect: true },
    edit: { key: "body", label: "Reply body", kind: "textarea" },
    items: [
      {
        id: "t-4412",
        title: "Re: Refund not received",
        subtitle: "to priya@acme.io · order #88213",
        body: "Hi Priya — the refund was issued on the 3rd and usually lands within 5 business days. I have asked the payment team to trace it and will update you tomorrow.",
      },
      {
        id: "t-4417",
        title: "Re: Cannot invite teammates",
        subtitle: "to dan@lumen.dev · plan: Team",
        body: "Hi Dan — invitations need the Team plan plus the Admin role. I have upgraded your seat and resent the invite; it should arrive in a minute.",
      },
      {
        id: "t-4420",
        title: "Re: Invoice address change",
        subtitle: "to legal@northwind.co · VAT update",
        body: "Hello — I have updated your billing entity and VAT number, and reissued last month's invoice with the new details. The original is now void.",
      },
      {
        id: "t-4421",
        title: "Re: API latency in EU region",
        subtitle: "to sre@finch.app · incident #1183",
        body: "Hi — we saw elevated p95 in eu-west between 09:12 and 09:41 UTC. The cause was a noisy neighbour on one node; it has been drained and your latency is back to baseline.",
      },
    ],
    fail: { "t-4420": "mailbox rate limit exceeded (429) — retry in a few seconds" },
    arrival: {
      after: 420,
      item: {
        id: "t-4433",
        title: "Re: Export stuck at 92%",
        subtitle: "to marco@terrace.io · arrived while sending",
        body: "Hi Marco — your export hit a large attachment table and timed out. I have split it into two jobs and both are running now.",
      },
    },
  },
  {
    id: "refunds",
    label: "Refunds and payments",
    blurb:
      "The agent proposes refunds and payouts from the finance queue. Amounts are not editable — that is the number the agent computed — and the recall window is 30 seconds because moving money by accident is expensive.",
    flags: { canUndo: true, undoMs: 30000, canEdit: false, canSelect: true },
    items: [
      { id: "p-901", title: "Refund — duplicate charge", subtitle: "stripe · customer #4412", amount: 249.0 },
      { id: "p-902", title: "Payout — contractor invoice", subtitle: "sepa · INV-2291", amount: 4120.5 },
      { id: "p-903", title: "Refund — goodwill credit", subtitle: "stripe · customer #7781", amount: 49.0, risk: "high" },
    ],
  },
  {
    id: "publishing",
    label: "Multi-platform publishing",
    blurb:
      "One post fans out to several platforms. The copy is editable per platform, one API rejects the payload, and a mistake can be recalled inside five seconds.",
    flags: { canUndo: true, undoMs: 5000, canEdit: true, canSelect: true },
    edit: { key: "body", label: "Post copy", kind: "textarea" },
    items: [
      {
        id: "pub-x",
        title: "X / Twitter — thread open",
        subtitle: "account @mzubairhassan18 · 3 posts",
        body: "We shipped a 2.5 kB state machine for agent approvals. Edit before approve, partial failure with retry, undo window, and a queue. No framework, no dependencies.",
      },
      {
        id: "pub-li",
        title: "LinkedIn — company page",
        subtitle: "account /agent-approval-machine",
        body: "Most agent approvals are one button. The hard parts are the other four conditions: editing before approving, retrying only what failed, undoing inside a window, and not losing items that arrive mid-flight.",
      },
      {
        id: "pub-bsky",
        title: "Bluesky — tech feed",
        subtitle: "account @approval.bsky.social",
        body: "Ten real approval flows on one 2.5 kB store: support replies, refunds, publishing, deploys, GDPR deletion and more.",
      },
    ],
    fail: { "pub-bsky": "platform API rejected the payload (422): link card missing" },
    arrival: {
      after: 380,
      item: {
        id: "pub-threads",
        title: "Threads — mirror of X thread",
        subtitle: "queued after the batch started",
        body: "Mirroring the announcement thread.",
      },
    },
  },
  {
    id: "meetings",
    label: "Meeting scheduling",
    blurb:
      "The agent proposes slots for external meetings. Nothing can be booked until a human picks a time, which is an edit to the payload the executor receives.",
    flags: { canUndo: true, undoMs: 5000, canEdit: true, canSelect: true },
    edit: { key: "slot", label: "Chosen slot", kind: "text" },
    items: [
      { id: "m-1", title: "Design review with Northwind", subtitle: "4 attendees · 45 min · Zoom", slot: "Thu 15:00 CET" },
      { id: "m-2", title: "Contract walkthrough", subtitle: "legal@northwind.co · 30 min", slot: "Fri 09:30 CET" },
      { id: "m-3", title: "Onboarding — Terrace.io", subtitle: "2 attendees · 60 min", slot: "Mon 11:00 CET" },
    ],
    fail: { "m-2": "calendar conflict: the slot was taken while the batch was in flight" },
  },
  {
    id: "account-cancellations",
    label: "Account cancellations",
    blurb:
      "Irreversible, so there is no undo and no editing — only a deliberate yes. This is the preset where the flags are switched off.",
    flags: { canUndo: false, canEdit: false, canSelect: true },
    items: [
      { id: "c-1", title: "Cancel workspace — Terrace.io", subtitle: "12 seats · data retained 30 days", risk: "destructive" },
      { id: "c-2", title: "Close enterprise trial — Finch", subtitle: "trial ends in 6 days", risk: "destructive" },
      { id: "c-3", title: "Downgrade plan — Lumen", subtitle: "Team → Free at period end", risk: "high" },
    ],
  },
  {
    id: "deploys",
    label: "CI/CD deploy approvals",
    blurb:
      "A release bot asks a human to ship. No undo window — you roll forward, not back — and a failed smoke test lands back on that one deployment, not the whole batch.",
    flags: { canUndo: false, canEdit: false, canSelect: true },
    items: [
      { id: "d-1", title: "web@2.14.0 → production", subtitle: "42 commits · canary 5%", risk: "high" },
      { id: "d-2", title: "api@1.9.3 → production", subtitle: "migration +2 · backwards compatible" },
      { id: "d-3", title: "worker@0.7.1 → eu-west", subtitle: "no schema change" },
    ],
    fail: { "d-1": "staging smoke test failed: /checkout returned 500 three times" },
  },
  {
    id: "gdpr",
    label: "GDPR deletion requests",
    blurb:
      "Data deletion cannot be recalled or rewritten, and every request carries an identity reference so the audit trail is intact.",
    flags: { canUndo: false, canEdit: false, canSelect: true },
    items: [
      { id: "g-1", title: "Erasure request — subject #1204", subtitle: "verified by ID · 17 records across 4 systems", risk: "destructive" },
      { id: "g-2", title: "Erasure request — subject #3391", subtitle: "verified by ID · 6 records", risk: "destructive" },
      { id: "g-3", title: "Export then erase — subject #0982", subtitle: "portability bundle attached", risk: "high" },
    ],
  },
  {
    id: "purchase-orders",
    label: "Purchase orders",
    blurb:
      "Procurement approvals need a human to correct the quantity or the amount before it goes out, with a long recall window because suppliers confirm fast.",
    flags: { canUndo: true, undoMs: 30000, canEdit: true, canSelect: true },
    edit: { key: "amount", label: "Order total (€)", kind: "number" },
    items: [
      { id: "po-77", title: "MacBook Pro × 4 — onboarding", subtitle: "supplier: Kessler IT · net 30", amount: 9600.0, risk: "high" },
      { id: "po-78", title: "Standing desk × 6", subtitle: "supplier: OfficeLoop", amount: 2340.0 },
      { id: "po-79", title: "GPU hours — training run", subtitle: "supplier: cloud credits", amount: 12200.0 },
    ],
    fail: { "po-79": "requires a second approver above €10,000" },
  },
  {
    id: "contracts",
    label: "Contract signing",
    blurb:
      "Signing is final and the document cannot be edited by the agent, so the flags are closed on both sides: no undo, no edit.",
    flags: { canUndo: false, canEdit: false, canSelect: true },
    items: [
      { id: "s-1", title: "MSA — Northwind Co", subtitle: "12 month term · auto-renew off", risk: "high" },
      { id: "s-2", title: "DPA addendum — Terrace.io", subtitle: "sub-processor list attached" },
      { id: "s-3", title: "SOW #14 — Finch", subtitle: "3 milestones · €48,000" },
    ],
  },
  {
    id: "ad-campaigns",
    label: "Ad campaign launches",
    blurb:
      "The agent writes the copy and proposes a daily budget. A human can edit the budget, and the 30 second window exists because spend starts the moment the campaign goes live.",
    flags: { canUndo: true, undoMs: 30000, canEdit: true, canSelect: true },
    edit: { key: "amount", label: "Daily budget (€)", kind: "number" },
    items: [
      { id: "ad-1", title: "Google Search — 'approval workflow'", subtitle: "keywords: 14 · geo: DE, NL", amount: 120.0 },
      { id: "ad-2", title: "Meta — retargeting lookalike", subtitle: "audience 2.1M · 3 creatives", amount: 240.0 },
      { id: "ad-3", title: "Reddit — r/SaaS awareness", subtitle: "12 subreddits", amount: 90.0, risk: "high" },
    ],
    fail: { "ad-2": "ad account spend limit reached — raise the limit and retry" },
    arrival: {
      after: 400,
      item: {
        id: "ad-4",
        title: "LinkedIn — job title targeting",
        subtitle: "arrived while launching",
        amount: 150.0,
      },
    },
  },
];

/* --------------------------------------------------------------- section */

class ApprovalSection {
  constructor(mod, uc, index) {
    this.mod = mod;
    this.uc = uc;
    this.index = index;
    this.rows = new Map();
    this.arrived = false;

    const el = document.createElement("section");
    el.className = "uc";
    el.id = uc.id;
    el.innerHTML = `
      <div class="uc-head">
        <h2><span class="uc-num">${String(index + 1).padStart(2, "0")}</span>${uc.label}</h2>
        <p>${uc.blurb}</p>
        <div class="flags">
          <span class="flag ${uc.flags.canSelect ? "on" : "off"}">canSelect ${uc.flags.canSelect}</span>
          <span class="flag ${uc.flags.canEdit ? "on" : "off"}">canEdit ${uc.flags.canEdit}</span>
          <span class="flag ${uc.flags.canUndo ? "on" : "off"}">canUndo ${uc.flags.canUndo}</span>
          <span class="flag ${uc.flags.canUndo ? "on" : "off"}">undoMs ${uc.flags.undoMs ?? 0}</span>
        </div>
      </div>
      <div class="toolbar">
        <button class="primary" data-act="approve"></button>
        <button class="ghost" data-act="deny">Deny selected</button>
        <button data-act="retry">Retry failed</button>
        <span class="spacer"></span>
        <span class="pill" data-ref="summary"></span>
        <button class="ghost" data-act="reset">Reset</button>
      </div>
      <div class="queue" data-ref="queue" hidden>
        <span data-ref="queue-text"></span>
        <span class="spacer"></span>
        <button class="ghost" data-act="clear">Clear queue</button>
      </div>
      <ul class="rows" data-ref="list"></ul>
    `;
    this.el = el;

    this.list = el.querySelector('[data-ref="list"]');
    this.summaryPill = el.querySelector('[data-ref="summary"]');
    this.queueBar = el.querySelector('[data-ref="queue"]');
    this.queueText = el.querySelector('[data-ref="queue-text"]');
    this.btnApprove = el.querySelector('[data-act="approve"]');
    this.btnDeny = el.querySelector('[data-act="deny"]');
    this.btnRetry = el.querySelector('[data-act="retry"]');

    this.store = mod.createApprovalStore({
      items: uc.items.map((item) => ({ ...item })),
      ...uc.flags,
      onExecute: (batch) => this.execute(batch),
      onUndo: async () => {
        await sleep(260);
      },
    });

    this.bind();
    this.unsubscribe = this.store.subscribe(() => this.render());
    this.render();
  }

  /* ---- behaviour ------------------------------------------------------ */

  async execute(batch) {
    if (this.uc.arrival && !this.arrived) {
      this.arrived = true;
      const arrival = this.uc.arrival;
      setTimeout(() => this.store.addItems([{ ...arrival.item }]), arrival.after);
    }

    // Pretend the provider takes a moment and answers per item.
    await sleep(700 + batch.length * 260);

    const succeeded = [];
    const failed = [];
    for (const item of batch) {
      const error = this.uc.fail?.[item.id];
      if (error) failed.push({ item, error });
      else succeeded.push(item);
    }
    return { succeeded, failed };
  }

  bind() {
    this.el.addEventListener("click", (event) => {
      const target = event.target.closest("[data-act]");
      if (!target) return;
      const act = target.dataset.act;
      if (act === "approve") void this.store.approve();
      if (act === "deny") this.store.deny();
      if (act === "retry") void this.store.retryFailed();
      if (act === "clear") this.store.clearQueue();
      if (act === "reset") {
        this.arrived = false;
        this.rows.forEach((row) => row.el.remove());
        this.rows.clear();
        this.store.reset(this.uc.items.map((item) => ({ ...item })));
      }
    });
  }

  createRow(record) {
    const item = record.item;
    const el = document.createElement("li");
    el.innerHTML = `
      <div class="row-pick"><input type="checkbox" aria-label="Select" /></div>
      <div class="row-main">
        <div class="row-title-wrap"><span class="row-title"></span><span class="risk" hidden></span></div>
        <div class="row-sub"></div>
        ${
          this.uc.edit
            ? `<${this.uc.edit.kind === "textarea" ? "textarea" : "input"} class="row-edit" rows="3" aria-label="${this.uc.edit.label}" />`
            : ""
        }
        <div class="edit-hint" hidden>edited — this is the value <code>onExecute</code> receives</div>
        <div class="row-error" hidden></div>
      </div>
      <div class="row-side">
        <span class="countdown" hidden></span>
        <span class="badge"></span>
        <button class="recall" hidden>Recall</button>
      </div>
    `;

    const row = {
      el,
      pick: el.querySelector("input[type=checkbox]"),
      title: el.querySelector(".row-title"),
      risk: el.querySelector(".risk"),
      sub: el.querySelector(".row-sub"),
      edit: el.querySelector(".row-edit"),
      hint: el.querySelector(".edit-hint"),
      error: el.querySelector(".row-error"),
      badge: el.querySelector(".badge"),
      countdown: el.querySelector(".countdown"),
      recall: el.querySelector(".recall"),
    };

    row.pick.addEventListener("change", () => this.store.select(item.id));
    row.recall.addEventListener("click", () => this.store.undo(item.id));
    if (row.edit) {
      row.edit.addEventListener("input", () => {
        const value = this.uc.edit.kind === "number" ? Number(row.edit.value) : row.edit.value;
        this.store.edit(item.id, { [this.uc.edit.key]: value });
      });
    }

    return row;
  }

  updateRow(record, snapshot) {
    let row = this.rows.get(record.item.id);
    if (!row) {
      row = this.createRow(record);
      this.rows.set(record.item.id, row);
      this.list.append(row.el);
    }

    const item = record.item;
    const open = isOpen(record.status);

    row.el.className = `row ${record.status}`;
    row.pick.checked = snapshot.selectedIds.includes(item.id);
    row.pick.disabled = !open;
    row.pick.parentElement.classList.toggle("empty", !this.uc.flags.canSelect);

    row.title.textContent = item.title;
    row.risk.hidden = !item.risk;
    row.risk.textContent = item.risk ?? "";
    row.risk.className = `risk ${item.risk ?? ""}`;

    const parts = [item.subtitle];
    if (item.amount != null) parts.push(money(item.amount));
    if (item.slot) parts.push(`slot: ${item.slot}`);
    row.sub.textContent = parts.filter(Boolean).join(" · ");

    if (row.edit) {
      const editable = open;
      row.edit.hidden = !editable;
      row.hint.hidden = record.status !== "editing";
      if (editable && document.activeElement !== row.edit) {
        row.edit.value = item[this.uc.edit.key] ?? "";
      }
    }

    row.badge.textContent = STATUS_LABEL[record.status];
    row.badge.className = `badge ${record.status}`;

    row.error.hidden = !record.error;
    row.error.textContent = record.error ?? "";

    const recallable = record.status === "undoing";
    row.recall.hidden = !recallable;
    row.countdown.hidden = !recallable;
    row.countdown.textContent = recallable
      ? ((record.undoDeadline - Date.now()) / 1000).toFixed(1) + "s"
      : "";
  }

  render() {
    const snapshot = this.store.getSnapshot();
    const { summary } = snapshot;

    const seen = new Set();
    for (const record of snapshot.itemsWithState) {
      seen.add(record.item.id);
      this.updateRow(record, snapshot);
    }
    for (const [id, row] of this.rows) {
      if (!seen.has(id)) {
        row.el.remove();
        this.rows.delete(id);
      }
    }

    const openCount = summary.needsApproval + summary.editing;
    const selected = summary.selected;
    this.btnApprove.disabled = openCount === 0 && summary.failed === 0;
    this.btnApprove.textContent = selected
      ? `Approve selected (${selected})`
      : `Approve all open (${openCount})`;
    this.btnDeny.disabled = selected === 0;
    this.btnRetry.disabled = summary.failed === 0;
    this.btnRetry.textContent = summary.failed ? `Retry ${summary.failed} failed` : "Retry failed";

    this.summaryPill.textContent =
      `${summary.needsApproval} open · ${summary.editing} edited · ` +
      `${summary.executing} sending · ${summary.undoing} recallable · ${summary.failed} failed`;

    this.queueBar.hidden = snapshot.queuedCount === 0;
    this.queueText.innerHTML = snapshot.queuedCount
      ? `<b>${snapshot.queuedCount} new item${snapshot.queuedCount > 1 ? "s" : ""}</b> arrived while a batch was in flight — held as <code>queued</code> and released when it settles.`
      : "";

    this.el.classList.toggle("is-executing", snapshot.isExecuting);
  }
}

/* ------------------------------------------------------------------- boot */

async function main() {
  const boot = document.getElementById("boot");

  let mod;
  try {
    mod = await import(/* @vite-ignore */ PKG_URL);
  } catch (error) {
    boot.className = "boot err";
    boot.textContent =
      `Could not load ${PKG_URL} (${error.message}). Check the network, then reload.`;
    return;
  }

  boot.className = "boot ok";
  boot.innerHTML =
    `Loaded <code>agent-approval-machine@${PKG_VERSION}</code> from esm.sh — the store below is the ` +
    `published package, driven by ~60 lines of DOM code and nothing else.`;

  const host = document.getElementById("usecases");
  const toc = document.getElementById("toc");
  const sections = [];

  USE_CASES.forEach((uc, index) => {
    const section = new ApprovalSection(mod, uc, index);
    host.append(section.el);
    sections.push(section);

    const link = document.createElement("a");
    link.href = `#${uc.id}`;
    link.innerHTML = `<span class="n">${String(index + 1).padStart(2, "0")}</span><span>${uc.label}</span>`;
    toc.append(link);
  });

  // Undo countdowns tick without touching focus or rebuilding rows.
  setInterval(() => sections.forEach((section) => section.render()), 150);

  // Highlight the section you are reading.
  const links = new Map([...toc.querySelectorAll("a")].map((a) => [a.getAttribute("href").slice(1), a]));
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((link) => link.classList.remove("active"));
        links.get(entry.target.id)?.classList.add("active");
      }
    },
    { rootMargin: "-88px 0px -70% 0px", threshold: 0 },
  );
  for (const section of sections) observer.observe(section.el);
}

main();
