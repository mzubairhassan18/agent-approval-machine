# Launch runbook

## 0. What ships where

| Artifact | Where | Notes |
| --- | --- | --- |
| `agent-approval-machine` | npm | One package. Zero dependencies, no React, 33.8 kB tarball, 2.45 kB gzipped in a bundle. |
| The site | `docs/` on `main`, GitHub Pages | Ten use cases running on the published package, straight from esm.sh. |
| Next.js demo | separate repo + its own Pages site | shadcn/ui. The copy-paste React reference, including the moved `ApprovalDialog`. |
| Vue demo | separate repo + its own Pages site | Vuetify 3. |
| Angular demo | separate repo + its own Pages site | Angular Material. |

There is exactly one published package. Framework glue is 5-15 lines per framework and lives in
the demo repos, not on npm.

## 1. Publish the package (needs your authenticator)

npm requires a one-time password; only you can produce it.

```powershell
cd D:\framework\agent-approval-machine
npm publish --access public     # paste the 6-digit OTP when prompted
```

`prepublishOnly` runs `test && typecheck && build` first, so a red test blocks the publish.

Verify:

```powershell
npm view agent-approval-machine version            # 0.1.0
```

**Order matters:** the Pages site and all three demos install from the registry, so nothing else
can be verified until this succeeds.

Before publishing, the Pages demo can be driven end to end offline against a packed build — it
takes a minute and it has already caught one bug that would have shipped:

```powershell
cd D:\image-agent\tmp\opencode\verify-vanilla   # any scratch dir with jsdom installed
Copy-Item D:\framework\agent-approval-machine\notes\verify-pages-demo.mjs .
$env:AAM_REPO = "D:\framework\agent-approval-machine"
$env:AAM_DIST = "$PWD\extracted\package\dist\index.js"
node verify-pages-demo.mjs                      # expects 28/28
```

## 2. GitHub Pages (once)

```powershell
gh api -X POST repos/mzubairhassan18/agent-approval-machine/pages `
  -f "source[branch]=main" -f "source[path]=/docs"
```

Site: https://mzubairhassan18.github.io/agent-approval-machine/

## 3. The three demo repos

Each is an independent repository that only consumes the npm package, and each serves its own
GitHub Pages site — no CI, no external host. A push is the deploy:

```powershell
cd D:\framework\agent-approval-machine-demo-nextjs   # ..-vue, ..-angular
npm run build:pages                                   # build -> docs/ (with .nojekyll)
git add docs && git commit -m "chore: rebuild pages" && git push
```

Pages serves `main:/docs`, enabled once per repo with:

```powershell
gh api -X POST repos/mzubairhassan18/<repo>/pages -f "source[branch]=main" -f "source[path]=/docs"
```

| Demo | Live | Source |
| --- | --- | --- |
| Next.js + shadcn/ui | https://mzubairhassan18.github.io/agent-approval-machine-demo-nextjs/ | [repo](https://github.com/mzubairhassan18/agent-approval-machine-demo-nextjs) |
| Vue + Vuetify | https://mzubairhassan18.github.io/agent-approval-machine-demo-vue/ | [repo](https://github.com/mzubairhassan18/agent-approval-machine-demo-vue) |
| Angular Material | https://mzubairhassan18.github.io/agent-approval-machine-demo-angular/ | [repo](https://github.com/mzubairhassan18/agent-approval-machine-demo-angular) |

Cutting a new build after changing a demo: `npm run build:pages`, commit `docs/`, push. The library
is bundled into the build at that moment, so the live sites keep working even if npm is down.

## 4. Launch copy

The one-line pitch:

> Most "agent approvals" are one button. The other four conditions are the work: editing a payload
> before it is sent, retrying only what failed, undoing inside a window, and not dropping items that
> arrive while a tool call is still running. That logic is now a 2.5 kB, dependency-free state
> machine you can drive from any framework.

X / Bluesky thread:

1. Every agent ends up rebuilding the same five things. So I extracted them into one store.
2. 2.45 kB gzipped, zero dependencies, no framework, no UI. It is state.
3. Edit before approve — the executor receives the edited payload, not the draft.
4. Partial failure is first class: 2 succeed, 1 fails with a reason, `retryFailed()` retries only that one.
5. Undo window with a timer (5s for messages, 30s for money), then it commits.
6. New items arriving mid-flight are held as `queued`, not lost.
7. Ten real-world flows, live, no install: <pages url>
8. Next.js (shadcn), Vue (Vuetify) and Angular (Material) versions of the same ten flows, each ~60 lines of glue: https://mzubairhassan18.github.io/agent-approval-machine-demo-nextjs/

Show HN:

> **Show HN: A 2.5 kB framework-free approval state machine for AI agents**
>
> Every agent I built grew the same five conditions: select, edit before approve, partial failure
> with retry, an undo window, and a queue for items that arrive while a tool call is still running.
> I kept rewriting them, usually differently each time, usually subtly wrong.
>
> So they are now a store. `createApprovalStore` has no dependencies and imports nothing at all —
> you drive it from React, Vue, Svelte, Angular or a `<script>` tag (glue is 5-15 lines, all shown
> in the README). The published package contains no JSX, no components and no CSS.
>
> Ten real-world flows run on it here, no install: <pages url>. I deliberately skipped the usual
> v1 scope creep — no backend, no database, no auth, no persistence, no queue service. `onExecute`
> is your function.
>
> Happy to hear where this state model breaks for your agent.

Discords (Vercel AI SDK, AI Engineer): lead with the ten flows link and one concrete condition
(partial failure), not with the API.

## 5. Before posting

- `npm view agent-approval-machine version` returns 0.1.0.
- The Pages URL loads and all ten sections render (the boot banner says `Loaded ... from esm.sh`).
- The three Pages URLs load, and each shows `Retry 1 failed` after one Approve all click.
- The store-only bundle is still under ~3 kB gzipped:
  `esbuild` an entry that imports `createApprovalStore` and check.
