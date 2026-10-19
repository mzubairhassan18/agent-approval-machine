# The four projects — map, UI guide, deploy reference

One published package, three framework shells and one hand-written page. This file is the map: where
each UI actually lives, the loop for changing it, and the traps that already cost time once.

- **Change the UI** → section 3 (files) and section 4 (recipes).
- **Ship a change** → sections 5 and 6.
- **Change the library itself** (store behaviour, not UI) → section 7.

---

## 1. What exists

| Repo | What it is | Stack | Live |
| --- | --- | --- | --- |
| `agent-approval-machine` | The published package (src + tests + the Pages site in `docs/`) | TypeScript, tsup, vitest. Zero runtime deps | [site](https://mzubairhassan18.github.io/agent-approval-machine/) |
| `agent-approval-machine-demo-nextjs` | React reference: 10 flows + the prebuilt components, copy-paste source | Next 15, React 19, shadcn/ui + Radix, Tailwind 4 | [live](https://mzubairhassan18.github.io/agent-approval-machine-demo-nextjs/) |
| `agent-approval-machine-demo-vue` | The same flows, one file of glue | Vue 3.5, Vuetify 3, Vite 6 | [live](https://mzubairhassan18.github.io/agent-approval-machine-demo-vue/) |
| `agent-approval-machine-demo-angular` | The same flows | Angular 22 (standalone + signals), Angular Material | [live](https://mzubairhassan18.github.io/agent-approval-machine-demo-angular/) |

There is exactly one npm package. No framework gets its own package: the binding is 15–60 lines and
lives in the demo repo, because that is the thing a reader actually copies.

## 2. The invariant that keeps them comparable

All four render **the same ten use cases, in the same order, with the same ids, copy, failure
messages and arrival timings**. Only the framework glue differs. That parity is the selling point,
so if you change a flow's data, change it in all four (or accept that they diverge, and say so).

Canonical data and the generic renderer, per repo:

| | flow data | renders any flow | binding to the store |
| --- | --- | --- | --- |
| vanilla | `docs/app.js` → `USE_CASES` | `ApprovalSection` (same file) | same file: `store.subscribe(render)` |
| Next.js | `app/_demos/use-cases.tsx`; component demos in `app/_demos/fixtures.ts` | `app/_demos/use-case-section.tsx` | `src/core/useApproval.ts` |
| Vue | `src/use-cases.ts` | `src/components/UseCaseSection.vue` | `src/approval-store.ts` |
| Angular | `src/app/use-cases.ts` | `src/app/approval-section.ts` + `.html` | `src/app/approval-store.service.ts` |

`docs/app.js` is the original of the ten flows — the other three were written from it.

## 3. Where to change the UI

### The vanilla page (`agent-approval-machine/docs/`) — hand-written, not generated

| Change | Open |
| --- | --- |
| Page shell, header nav, sidebar lists | `docs/index.html` |
| Every colour, radius and font | `docs/styles.css` (`:root` tokens at the top) |
| A row, the toolbar, the queue banner, button behaviour | `docs/app.js` — `createRow()` builds the markup, `updateRow()` sets state, `bind()` wires clicks by `data-act="approve"` and friends |
| Which package version the page runs | `PKG_VERSION` in `docs/app.js` (see section 6) |

### Next.js (`app/` + `src/`)

| Change | Open |
| --- | --- |
| Shell, the 12 sections, sticky jump list | `app/page.tsx` |
| A flow's row layout / toolbar | `app/_demos/use-case-section.tsx` |
| A flow's data, adapters, executor | `app/_demos/use-cases.tsx` |
| The prebuilt dialog / card / table | `src/ui/approval-dialog.tsx`, `approval-card.tsx`, `approval-table.tsx` |
| Status pills, stepper, summary line | `src/ui/parts.tsx` |
| Buttons, badges, cards, checkbox, dialog primitives | `src/ui/components/*.tsx` (local shadcn/ui — edit these freely) |
| A payload kind | `src/adapters/*.tsx` (email, action, schedule, payment, publish) |
| Tailwind entry | `app/globals.css` (note `@source "../../../src"`, which scans the UI layer) |

### Vue (`src/`)

| Change | Open |
| --- | --- |
| Shell | `src/App.vue`, plus `components/TopBar.vue`, `components/SectionSidebar.vue` |
| The whole flow UI: toolbar, rows, edit field, undo, queue | `src/components/UseCaseSection.vue` |
| Colours, spacing, the Vuetify overrides | `src/styles.css` (`:root` tokens) |
| Which Vuetify components are registered, and the theme | `src/vuetify.ts` (explicit imports on purpose — read what's registered) |
| A flow's data | `src/use-cases.ts` |

### Angular (`src/app/`)

| Change | Open |
| --- | --- |
| Shell | `src/app/app.html`, `app.css`, `app.ts` |
| The flow UI | `src/app/approval-section.html`, `.css`, `.ts` |
| Two-way edit binding | `src/app/edit-value.directive.ts` |
| Design tokens + Material theming | `src/styles.css` |
| Material palette | `angular.json` → build options → `styles` (`azure-blue.css`) |
| A flow's data | `src/app/use-cases.ts` |

## 4. Recipes

**Restyle everything.** The three look-alike demos deliberately share token names (`--bg`, `--panel`,
`--line`, `--text`, ...) copied from the vanilla page. Change the `:root` block in
`docs/styles.css`, `src/styles.css` (Vue) and `src/styles.css` (Angular). Next has no tokens file:
its surface is Tailwind utility classes in `src/ui/**`, so restyle the primitives in
`src/ui/components/*.tsx` or add a theme block to `app/globals.css`.

**Change the approve / deny buttons.** vanilla: `createRow()` template in `docs/app.js`; Next:
`src/ui/approval-dialog.tsx`; Vue: the toolbar in `UseCaseSection.vue`; Angular:
`approval-section.html`.

**Add or rename a field on a row.** vanilla/vue/angular render rows in their one section file. Next
splits it: the payload shape and its display live in `src/adapters/<kind>.tsx`, and the ten flows use
a generic adapter in `app/_demos/use-cases.tsx`.

**Add an eleventh flow.** Add an entry to the repo's data file. The vanilla page, Vue, Angular and
Next's `use-case-section` all render from data, so it appears without new markup. Next also has a
"Prebuilt components" section whose demos are hand-written (`app/_demos/*-demo.tsx`) — a new entry
there needs a component.

**Keep retry working.** All four mocks fail an item's *first* attempt and let the retry through
(vanilla `failedOnce`, Next `createExecutor`, Vue `failedOnce`, Angular `failedOnce`). If you add a
failure case, follow that pattern or the demo contradicts its own error text.

## 5. The loop

```bash
# once
npm install

# vanilla page: no build step at all
npx serve docs         # then open the printed localhost URL
                       # (open it over http, not file://, so the CDN import is allowed)

# Next.js
npm run dev            # :3000
npm test               # 24 tests
npm run build:pages    # writes docs/

# Vue
npm run dev            # :5173
npm run store:check    # 18 checks, headless, no DOM
npm run render:check   # 17 checks via vue/server-renderer
npm run build:pages

# Angular
npm start              # :4200
npm test               # 4 tests
npm run store:check
npm run build:pages
```

`npm run build:pages` builds and writes the site into `docs/`. **`docs/` is generated in the three
demo repos — never hand-edit it.** Committing and pushing it *is* the deploy.

Before pushing, the honest minimum: the repo's own tests above, then open the live URL and click
"Approve all open" once — you should see one failure with its reason, a `Retry 1 failed` button and
no console errors.

For the vanilla page there is a stronger check: `notes/verify-pages-demo.mjs` drives the real page in
jsdom against a packed build (28 assertions covering the queue, partial failure, undo countdown,
retry and recall). How to run it is at the top of that file.

## 6. Deployment reference

Every repo serves its own GitHub Pages site from **`main`, `/docs`**. No CI, no external host.

```powershell
# once per repo
gh api -X POST repos/mzubairhassan18/<repo>/pages -f "source[branch]=main" -f "source[path]=/docs"

# each change
npm run build:pages
git add docs && git commit -m "chore: rebuild pages" && git push
```

Things that will bite you:

- **`.nojekyll` is mandatory** in the generated `docs/`. Pages runs Jekyll, which silently drops
  folders starting with `_` — that is all of Next's `_next/`. The build script writes it; don't
  delete it and don't "tidy" the folder.
- **Base paths**, because a project site lives under `/<repo>/`:
  Next bakes it in only for the Pages build (`PAGES_BASE_PATH` → `basePath` in `next.config.ts`),
  Angular passes `--base-href /agent-approval-machine-demo-angular/` from the script, Vue needs
  nothing (`base: "./"` is already relative). If you ever move a demo to a custom domain or the
  site root, remove all three.
- **The library repo is different**: `docs/` there holds hand-written source, not a build, and the
  page imports the package from a CDN at runtime. Bumping `PKG_VERSION` is what changes the version
  the page demonstrates.
- **CDNs need a fallback.** `docs/app.js` tries jsDelivr → unpkg → esm.sh, because esm.sh serves a
  build-on-first-request shim that fails a page load while it warms up. The banner names whichever
  answered, which makes this obvious in one glance.
- **Allow a minute** after pushing before judging a Pages change, then hard-refresh.
- **npm lockfile trap.** npm keeps an old resolution when the version still satisfies the range, so
  switching a demo off a `file:` tarball silently leaves `"resolved": "file:..."` in
  `package-lock.json`. Delete that entry (or the lockfile) and reinstall, then confirm:
  `Select-String -Path package.json,package-lock.json -Pattern 'file:'` should be empty.

## 7. Changing the library itself

The store is one file: `src/store.ts` (no imports), with presets in `src/presets.ts` and the public
surface in `src/index.ts`. Tests run in plain Node — no jsdom, no framework (`tests/framework.test.ts`
covers the Vue binding).

```powershell
cd D:\framework\agent-approval-machine
pnpm test && pnpm typecheck && pnpm build   # 33 tests
npm publish --access public                 # needs a 2FA code, interactive
```

`prepublishOnly` runs test, typecheck and build, so a red test blocks the publish. Note that npm is
restricting tokens that bypass 2FA (direct publishing from Jan 2027), so plan on interactive
publishing or Trusted Publishing from a workflow.

Then point the consumers at the new version:

```powershell
# each demo repo
npm install agent-approval-machine@^0.2.0   # or edit package.json and npm install
npm run build:pages
git add -A && git commit -m "chore: agent-approval-machine 0.2.0" && git push
```

The three demos **bundle** the library at build time, so a new version only reaches their live sites
after a rebuild and push. The vanilla page loads it from a CDN at runtime, so it tracks npm on its
own — bump `PKG_VERSION` in `docs/app.js` when you want that page to move deliberately.

## 8. Traps we already hit

1. **Non-void self-closing tags.** `docs/app.js` wrote `<textarea … />`, so the rest of the row became
   the textarea's text content and the row rendered broken. Close every non-void element explicitly.
2. **esm.sh's fresh-publish shim.** Covered in section 6; the fallback chain exists because of it.
3. **The npm lockfile** keeping a `file:` resolution. Covered in section 6.
4. **Retry looking broken.** The mocks originally failed an item on every attempt, so "Retry 1
   failed" failed forever and contradicted the error message. Now every mock fails only the first
   attempt.
5. **Verifying by eye.** Both real bugs above were found by driving the page, not by reading it. The
   checks in section 5 are cheap; run them.
