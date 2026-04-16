# Project Synthesis — Phase A: Library Foundation

**Plan:** `2026-04-15-phase-a-foundation`  
**Date:** 2026-04-15  
**Status:** COMPLETE — 10/10 work packages delivered  

---

## Executive Summary

Phase A scaffolded the `@mistralys/cli-menu` TypeScript library from an empty
repository to a fully buildable, tested, and documented package. All 10 work
packages delivered their targets on the same day.

**What was built:**

| Module | File | Exports |
|--------|------|---------|
| Project scaffold | `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts` | — |
| Type definitions | `src/types.ts` | 7 types/interfaces |
| ANSI color helpers | `src/colors.ts` | `C`, `Colors`, `log` |
| Terminal utilities | `src/raw-mode.ts`, `src/screen.ts` | 5 functions |
| Script runners | `src/runners.ts` | `IS_WIN`, `NPM`, 3 functions |
| Changelog utilities | `src/changelog/index.ts` | 4 functions |
| Help renderer | `src/help.ts` | `printHelp` |
| Argument parser | `src/parser.ts` | `parseArgs`, `ParsedArgs` |
| Preflight utilities | `src/preflight.ts` | `PreflightError`, `checkNodeVersion` |
| Barrel + integration | `src/index.ts` | 17 symbols (main), 4 (./changelog) |

The package produces correct dual CJS + ESM output with `.d.ts` declaration
files, has **zero runtime dependencies**, and meets all build and coverage
acceptance criteria.

---

## Metrics

| Metric | Value |
|--------|-------|
| Work packages | 10 / 10 COMPLETE |
| Pipeline stages executed | 43 (10 implementation · 10 QA · 1 security-audit · 10 code-review · 10 documentation) |
| WPs with all stages passing cleanly | 9 / 10 |
| WPs requiring rework | 1 (WP-004: 1 implementation rework + 1 QA bounce) |
| Tests passing | **94 / 94** (6 suites) |
| Statement coverage | **98.9%** |
| Branch coverage | **90%** |
| Function coverage | **100%** |
| Line coverage | **100%** |
| Security findings (Critical / High / Medium) | **0 / 0 / 0** |
| Reviewer Fix-Forwards applied | **7** |

### Fix-Forwards Applied (by Reviewers in-line)

| WP | Fix Applied |
|----|------------|
| WP-003 | `color in C` → `Object.hasOwn(C, color)` — prevents prototype-chain keys bypassing the invalid-color fallback |
| WP-004 | JSDoc on `exitRawMode()` expanded with usage distinction vs `restoreTerminal()` |
| WP-005 | `sh()` JSDoc: shell-injection warning added; `ScriptRunnerOptions.env` documented as replace-not-merge |
| WP-006 | `/dev/null` test comment corrected; `ChangelogEntry.version` JSDoc example fixed to `v1.2.3` |
| WP-007 | `workspaceRoot: '/tmp/test'` → `process.cwd()` in test helper (cross-platform policy compliance) |
| WP-008 | `flags: argv` → `flags: [...argv]` — consistent array-copy semantics on all return paths |
| WP-010 | Stale comment in `src/index.ts` corrected (misclassified `screen`/`raw-mode` as Phase B) |

---

## Failures & Blockers

### WP-004 — Coverage Config Path Mismatch (Resolved)

The only rework cycle in Phase A. `vitest.config.ts` contained exclusion paths
targeting the original plan's `src/terminal/` subdirectory structure
(`src/terminal/raw-mode.ts`, `src/terminal/screen.ts`). Implementation placed
both files at the flat `src/` level (`src/raw-mode.ts`, `src/screen.ts`). The
mismatch caused all four coverage thresholds to drop below 80%.

**Resolution:** A targeted one-line fix updated both exclusion paths. All
94 tests passed; coverage fully restored.

**Pattern note:** Config paths that reference unverified file locations are a
recurring issue class. A post-implementation assertion (e.g., a script that
verifies each `coverage.exclude` glob resolves to at least one real file)
could prevent this category of bounce entirely.

---

## Strategic Recommendations

### 1. Phase B: Harden `waitForKey()` via `enterRawMode()` Delegation

`waitForKey()` in `src/screen.ts` manually inline-replicates the three-line
`enterRawMode()` body (readline event setup, setRawMode, resume). This DRY
violation means `enterRawMode()` improvements (e.g., a missing `try/catch`
around `setRawMode(true)` after the TTY guard) will not propagate to
`waitForKey()` automatically. **Phase B should refactor `waitForKey()` to call
`enterRawMode()` directly.** This simultaneously eliminates the duplication and
adds the missing error-handling path in one change.

### 2. Phase B: Make `printHelp()` Usage Line Configurable

The usage line in `src/help.ts` is hardcoded to
`'node scripts/cli.js [command] [options]'`. This couples the library to the
`ai-insights` workspace's invocation pattern. Any consumer of
`@mistralys/cli-menu` in a different project will see an incorrect usage line.
**Add a `usageLine` or `invocationName` field to `MenuConfig`** (defaulting to
`process.argv[1]` as a reasonable fallback) in Phase B.

### 3. Phase B: Extract `resolveVersion()` to Shared Utilities

`resolveVersion()` is a private helper in `src/help.ts` that handles the
`string | (() => string)` version field on `MenuConfig`. The same logic will
be needed in the `createMenu()` entry point in Phase B. To prevent divergence,
**extract it to `src/utils.ts` or add it to the `src/index.ts` exports** when
Phase B introduces the menu engine.

### 4. Phase B: Guard `clearScreen()` on `process.stdout.isTTY`

`clearScreen()` in `src/screen.ts` writes ANSI escape bytes unconditionally
regardless of whether stdout is a TTY. In piped or CI output-capture
environments this produces garbage bytes in captured output.
**Add a `!process.stdout.isTTY` early-return guard** consistent with the
non-TTY guards already present in `isRawModeSupported()` and `waitForKey()`.

### 5. Phase B: Enforce `Command.key` Single-Character Constraint at Runtime

`Command.key` is typed `string | null` with a JSDoc note that it should be a
single character, but TypeScript cannot enforce length at the type level.
**Add a runtime validation in `createMenu()`** that throws a descriptive error
if any registered command's `key` exceeds one character. This converts a
silent footgun into an explicit early failure.

### 6. Phase B: Address the Duplicate `id: 'help'` Collision in `printHelp()`

If a caller registers a `Command` with `id: 'help'`, `printHelp()` will emit
that command line **and** the synthetic help entry, resulting in two `'help'`
lines. **Add a guard to filter or skip the synthetic entry** when a help
command is already registered in the commands array.

### 7. Phase A Holistic Review: Consolidate `ParsedArgs` into `types.ts`

`ParsedArgs` is currently defined locally in `src/parser.ts` (intentional per
the WP spec). At the Phase A wrap-up, consider whether it belongs alongside
the other shared types in `src/types.ts`. This is a low-priority housekeeping
decision but should be resolved before Phase B adds more types.

---

## Next Steps for Phase B

Phase B delivers the interactive TUI components (`createMenu()`,
`setup/`, `menu/`) that Phase A explicitly deferred. The following items are
carry-forwards from Phase A pipeline observations:

| Priority | Item | Source |
|----------|------|--------|
| High | Refactor `waitForKey()` to call `enterRawMode()` | WP-004 Reviewer |
| High | Add configurable `usageLine`/`invocationName` to `MenuConfig` | WP-007 Reviewer |
| Medium | Extract `resolveVersion()` to shared utils | WP-007 Developer |
| Medium | Add `process.stdout.isTTY` guard to `clearScreen()` | WP-004 QA/Reviewer |
| Medium | Runtime single-character validation for `Command.key` | WP-002 Reviewer |
| Medium | Guard duplicate `id: 'help'` in `printHelp()` | WP-007 QA |
| Low | Consider adding `coverage.exclude` for `src/index.ts` + `src/types.ts` | WP-010 Reviewer |
| Low | Decide placement of `ParsedArgs` interface (parser vs types) | WP-008 Reviewer |
| Low | WP spec had `src/args.ts` typo — correct in plan if referenced again | WP-008 QA |

---

## Appendix — WP Summary

| WP | Title | Rework | Tests | Key Outcome |
|----|-------|--------|-------|-------------|
| WP-001 | Project Scaffold | — | 0 | Full build/test toolchain wired |
| WP-002 | Type Definitions | — | 19 | 7 exported types incl. `Command`, `MenuConfig` |
| WP-003 | ANSI Color Helpers | — | 75 | `Object.hasOwn` prototype fix applied |
| WP-004 | Terminal Utilities | 1 cycle | 94 | Coverage config path mismatch resolved |
| WP-005 | Script Runners | — | 75 | Security-audited; 0 findings |
| WP-006 | Changelog Utilities | — | 75 | Dual-format parser + CRLF support |
| WP-007 | Help Renderer | — | 94 | Category grouping + stable sort |
| WP-008 | Argument Parser | — | 19 | Array-copy Fix-Forward applied |
| WP-009 | Preflight Utilities | — | 19 | `PreflightError` + `checkNodeVersion` |
| WP-010 | Barrel Export | — | 94 | 17 + 4 symbols exported, build verified |
