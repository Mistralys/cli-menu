# Project Synthesis — Phase C: Migration & CI
**Date:** 2026-04-16  
**Plan:** `docs/agents/plans/2026-04-15-phase-c-migration-ci/`  
**Status:** COMPLETE  
**Work Packages:** 9 / 9 COMPLETE

---

## Executive Summary

Phase C delivered three interrelated goals for the `@mistralys/cli-menu` ecosystem:

1. **Library quality hardening** (WP-001–004): Fixed a real interactive-menu bug (unhandled
   command errors crashing the loop), repaired silent test isolation failures, and formalized
   two undocumented behavioral contracts in JSDoc and the project manifest.

2. **Distribution infrastructure** (WP-005–006, WP-008): Installed the library into the AI
   Insights workspace via a local symlink, created a four-job GitHub Actions CI matrix
   (Node 18/22 × Ubuntu/Windows), and prepared the v0.1.0 package artifact — including a
   properly nested dual-CJS/ESM exports map and CHANGELOG.md.

3. **Consumer migration** (WP-007, WP-009): Refactored `scripts/cli.js` in AI Insights from
   1 209 lines to 708 lines by replacing all infrastructure code with `@mistralys/cli-menu`
   imports, and verified end-to-end integration via the npm link symlink.

The single deferred item — `npm publish` — is explicitly authorized and bounded to one command
plus a one-line `package.json` update after authentication is configured.

---

## Metrics

| Metric | Value |
|--------|-------|
| Work packages completed | 9 / 9 |
| Pipeline stages completed | 35 / 35 |
| Pipeline failures (rework) | 1 (WP-008 impl #1 — npm auth blocker) |
| cli-menu unit tests (final) | **229 / 229 PASS** |
| AI Insights scripts tests (final) | **51 / 51 PASS** |
| TypeScript typecheck | PASS (all WPs) |
| Reviewer Fix-Forward changes applied | 5 |
| Documentation-forward items addressed | 6 / 6 |
| Deferred items | 1 (npm publish) |

---

## Work Package Outcomes

| WP | Title | Outcome | Key Artifact |
|----|-------|---------|--------------|
| WP-001 | Interactive menu error handling | Error catch + loop recovery implemented | `src/menu/interactive.ts`, 5 new tests |
| WP-002 | Test isolation — isTTY save/restore | All 4 mutation sites fixed; convention documented | `tests/screen.test.ts`, `tests/create-menu.test.ts` |
| WP-003 | Document empty-args contract | `run([])` contract explicit in 3 locations | `src/types.ts`, `src/menu/interactive.ts`, `api-surface.md` |
| WP-004 | Documentation polish | SIGINT rationale, tmp-path rule, config link | `src/menu/interactive.ts`, `constraints.md`, `docs/configuration.md` |
| WP-005 | Install cli-menu in AI Insights | `file:../cli-menu` symlink; sibling layout documented | `ai-insights/package.json`, `ai-insights/README.md` |
| WP-006 | GitHub Actions CI workflow | 4-job matrix (Node 18/22 × Ubuntu/Windows) | `.github/workflows/ci.yml`, CI badge in README |
| WP-007 | Migrate scripts/cli.js | 1 209 → 708 lines; PreflightError refactor | `scripts/cli.js`, `ai-insights/package.json` |
| WP-008 | npm package prep + publish | v0.1.0 artifact ready; publish deferred | `CHANGELOG.md`, `package.json` (author, nested types) |
| WP-009 | Switch to registry version (deferred) | Symlink integration verified end-to-end | `ai-insights/README.md` (post-publish migration note) |

---

## Deferred / Open Items

| Item | Authorized By | Bounded Action |
|------|--------------|----------------|
| `npm publish` (WP-008 AC #2, WP-009 AC #1) | User (explicit, 2026-04-16) | Run `npm login` → `npm publish` from `cli-menu/`, then update `ai-insights/package.json` from `'file:../cli-menu'` to `'^0.1.0'` and run `npm install` |

---

## Strategic Recommendations

### 1. Publish First, Then Pin (High Priority)

The only remaining infrastructure step is `npm publish`. Once the package is on the registry,
update `ai-insights/package.json` to `'^0.1.0'`. The migration step is documented in
`ai-insights/README.md` — no manual archaeology needed.

### 2. Fix the Vite Advisory (Medium Priority)

A **pre-existing high-severity Vite advisory** in the AI Insights vitest transitive dependency
tree was flagged in WP-005 (and confirmed out of scope). Run `npm audit fix` in `ai-insights/`
before any developer-facing web server work.

### 3. Add the Missing Non-Error Throw Test (Low Priority)

WP-001's Reviewer identified that `tests/menu/interactive.test.ts` has no test for a non-Error
thrown value (the `String(err)` fallback path). The implementation handles it correctly, but
there is no test asserting that `throw 'string literal'` produces the expected output. Add one
test case covering the `String(err)` branch.

### 4. wire `workflow_dispatch` into CI (Low Priority)

The CI workflow (WP-006) has no `workflow_dispatch` trigger, meaning it cannot be re-run from
the GitHub Actions UI without a code push. Adding one line to `ci.yml` enables manual reruns
during debugging.

### 5. Consider SHA-Pinning GitHub Actions (Security Hardening)

Actions are currently pinned to major-version floating tags (`@v4`). For a package publishing to
npm, SHA-pinning (`actions/checkout@<sha>`) hardens the supply chain. This is a low-risk trade-off
at v0.1.0 but worth adopting before 1.0.

### 6. Extract `orchestrator/` setup to a Helper Module (Nice-to-Have)

`scripts/cli.js` landed at 708 lines — 18% over the ~600-line target. The orchestrator venv
creation and `cmdCleanAgents` are the main contributors. Extracting them to a
`scripts/setup-helpers.js` module would reach the stated target and improve readability, but is
not functionally necessary.

---

## Gold Nuggets — Architectural Insights

> High-signal facts captured during this session for future agents and contributors.

**`vi.restoreAllMocks()` does NOT revert `Object.defineProperty` mutations.**
This was a pre-existing silent-failure pattern in `tests/screen.test.ts` (WP-002). The test
passed individually but polluted the suite. The fix and the convention rule are now captured in
`docs/agents/project-manifest/constraints.md` and the Testing Conventions section.

**Nested import/require branches in the `exports` map matter for CJS TypeScript consumers.**
The original flat `"types": "./dist/index.d.ts"` condition resolves correctly for ESM but
TypeScript consumers using `moduleResolution: node16` in CJS context need
`"require": { "types": "./dist/index.d.cts" }`. Applied in WP-008's code-review Fix-Forward.
The `.d.cts` files are already produced by tsup — this was purely an exports-map wiring gap.

**The `file:` protocol symlink is functionally equivalent to a registry install for development.**
All sub-path exports, CJS `require()` calls, and type resolution work identically. The only
operational difference is the `package.json` reference string — a one-line change at publish time.

**`process.on('SIGINT', …)` vs `process.once('SIGINT', …)` matters in long-lived interactive
sessions.** Using `process.on` in command runners means repeated invocations accumulate handlers.
Fixed in WP-007 (Reviewer Fix-Forward). The library's own interactive loop uses `removeListener`
correctly; the consumer script was the inconsistency.

---

## Next Steps for the Planner

1. **Run `npm publish`** — prerequisites met; auth setup is the only gate.
2. **Update `ai-insights/package.json`** to `'^0.1.0'` after publish.
3. **Raise a QA follow-up task** for the non-Error throw test (String(err) fallback in
   `interactive.ts`'s catch handler).
4. **Run `npm audit fix`** in `ai-insights/` to clear the Vite advisory.
5. **(Optional, Phase D)** Add `workflow_dispatch` to `ci.yml` and consider SHA-pinning for
   supply-chain hardening before 1.0.
