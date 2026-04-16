# Project Status Report — Phase B: Interactive Engine
**@mistralys/cli-menu · Session date: 2026-04-15**
**Plan:** `docs/agents/plans/2026-04-15-phase-b-interactive-engine/`
**Status: COMPLETE — 12/12 work packages, 0 pending**

---

## Executive Summary

Phase B delivered the complete interactive runtime for `@mistralys/cli-menu`, elevating the
library from a Phase A bootstrap (parser + help + preflight + changelog utilities) to a
fully-featured, production-ready CLI menu framework.

The centrepiece is the **`createMenu(config).run(argv)`** public API factory (WP-007), wired
together from four independently-built and independently-verified components:

| Component | Source | Responsibility |
|-----------|--------|----------------|
| `renderMenu()` | `src/menu/renderer.ts` | ANSI-formatted menu output (banner, categories, footer, prompt) |
| `showInteractiveMenu()` | `src/menu/interactive.ts` | Keypress-driven TUI loop with SIGINT lifecycle |
| `runCheckboxMenu()` | `src/setup/checkbox-menu.ts` | Multi-select setup wizard with pre-detection |
| `runSetup()` | `src/setup/runner.ts` | CLI flag parsing (`--all`, `--components`) + summary table |

Two hardening WPs preceded the assembly: **WP-001** decoupled `screen.ts` from `readline` and
added a TTY guard to `clearScreen()`; **WP-002** extracted `resolveVersion()`, moved `ParsedArgs`
to `types.ts`, and added the `usageLine` + duplicate-help-guard features to `printHelp()`.

Two documentation WPs followed: **WP-009** rewrote the README (Quick Start, API overview,
launcher scripts, Phase A/B stale-content cleanup), and **WP-010** authored the full
configuration reference and changelog-utilities guide. **WP-011** built a complete agent
manifest (`AGENTS.md` + 6 manifest files). **WP-008** added 17 end-to-end integration tests
through `createMenu().run()`. **WP-012** enforced 80% coverage thresholds and verified the
dual-bundle build.

---

## Metrics

| Metric | Value |
|--------|-------|
| **Tests passed** | 224 |
| **Tests failed** | 0 |
| **Test files** | 13 |
| **Statement coverage** | 98.25% |
| **Branch coverage** | 93.1% |
| **Function coverage** | 100% |
| **Line coverage** | 98.43% |
| **TypeScript** | Clean (`tsc --noEmit`, 0 errors) |
| **Build** | CJS + ESM dual output (tsup) — clean |
| **CJS runtime** | `require('./dist/index.cjs').createMenu` resolves as function |
| **Rework cycles** | 1 FAIL → PASS (WP-006 code-review) |
| **Security issues closed** | 2 Medium (SIGINT spin loops) |

---

## Security Issue — Found and Resolved

### A04 Insecure Design — SIGINT Handler Re-entrancy (Medium)

**Identified by:** Security Auditor (WP-003 security-audit; WP-006 security-audit) and
Reviewer (WP-006 code-review FAIL)

Both TUI entry points (`src/menu/interactive.ts` and `src/setup/checkbox-menu.ts`) had the
same defect: the SIGINT handler called `restoreTerminal()` followed by
`process.kill(process.pid, 'SIGINT')` **without first removing itself** from the signal
listener chain.

Because `restoreTerminal()` removes the `stdin` keypress listener, the `waitForKeypress()`
Promise is permanently orphaned — its settle handler never fires, so the `finally` block
never executes. The re-raised SIGINT is then delivered back to the same still-registered
handler, creating an indefinite re-entrancy loop on every Ctrl+C press.

**Remediation applied (both files):**
```ts
// BEFORE (unsafe):
function sigintHandler() {
  restoreTerminal();
  process.kill(process.pid, 'SIGINT');
}

// AFTER (correct invariant):
function sigintHandler() {
  process.off('SIGINT', sigintHandler);  // ← self-unregister FIRST
  restoreTerminal();
  process.kill(process.pid, 'SIGINT');
}
```

Regression tests were added to both `tests/menu/interactive.test.ts` and
`tests/setup/checkbox-menu.test.ts` that capture the handler reference via a `process.on`
spy, instrument `process.off` during handler execution, and assert self-unregistration
occurs *inside* the handler body — not deferred to the finally block. Both regression
tests pass in the final suite.

The Security Auditor's re-audit (WP-006 2nd cycle) confirmed 0 Medium / 0 High findings
across both files after the fix.

---

## Work Package Summary

| WP | Title | Stages | Tests | Notes |
|----|-------|--------|-------|-------|
| WP-001 | screen.ts hardening | impl → qa → code-review | +7 | TTY guard + raw-mode delegation |
| WP-002 | Types + help improvements | impl → qa → code-review | +0 | ParsedArgs, usageLine, resolveVersion |
| WP-003 | Checkbox TUI | impl → qa → sec → code-review | +23 | runCheckboxMenu(); SIGINT fix cycle |
| WP-004 | Setup runner | impl → qa → code-review | +17 | runSetup(), barrel, flag parsing |
| WP-005 | Menu renderer | impl → qa → code-review | +17 | renderMenu(), category grouping |
| WP-006 | Interactive menu loop | impl → qa → sec → review(FAIL) → impl → qa → sec → review | +20 | showInteractiveMenu(); SIGINT fix |
| WP-007 | createMenu() factory | impl → qa → code-review | +25 | Main public API entry point |
| WP-008 | Integration tests | qa → code-review | +17 | End-to-end through createMenu().run() |
| WP-009 | README documentation | documentation | — | Quick Start, API, launcher scripts |
| WP-010 | Config reference + changelog docs | documentation | — | docs/configuration.md, docs/changelog-utilities.md |
| WP-011 | AGENTS.md + project manifest | documentation | — | 7 files: AGENTS.md + 6 manifest docs |
| WP-012 | Coverage + build validation | impl → qa → code-review | — | 98.25%/93.1%/100%/98.43%; vitest.config.ts |

---

## Strategic Recommendations (Gold Nuggets)

### 1. SIGINT Invariant — Apply Consistently to Any Future TUI Entry Point
The canonical pattern that emerged from this session:
```
sigintHandler():
  1. process.off('SIGINT', sigintHandler)   ← self-unregister FIRST
  2. restoreTerminal()                       ← clean up terminal state
  3. process.kill(process.pid, 'SIGINT')     ← re-raise for default handling
```
This invariant (and its rationale) is now documented in `docs/agents/project-manifest/constraints.md`
§6. Any new TUI widget that registers a SIGINT handler **must** follow this pattern.

### 2. `Object.defineProperty` on `process.stdin/stdout.isTTY` is Not Restored by `vi.restoreAllMocks()`
`vi.restoreAllMocks()` only restores `vi.spyOn()` mocks, not `Object.defineProperty` mutations.
Tests in WP-001, WP-003, WP-006, and WP-007 set `isTTY` values explicitly per-test, which
avoids failures today, but the suite has latent order-dependence. Consider a `beforeAll /
afterEach` pattern that captures the original `isTTY` value and restores it via
`Object.defineProperty` after each test.

### 3. `cmd.run([])` in Interactive Mode — Document the Empty Args Contract
`showInteractiveMenu()` always calls `cmd.run([])` with an empty args array. Any `Command.run`
implementation that depends on receiving CLI flags will silently not see them in interactive
mode. This is an acknowledged design limitation. Document it in the `Command` interface JSDoc
and in `api-surface.md` before the next consumer implementation is written.

### 4. `instanceof Promise` for Long-Running vs Blocking Distinction Is Fragile
The current discriminant (`result instanceof Promise`) is correct for the existing use case,
but breaks if a command inadvertently returns a non-Promise thenable or wraps the result.
A stronger contract would be an explicit `longRunning?: boolean` flag on `Command`, making
the intent declarative rather than inferred from the return type. Worth revisiting before
the API is finalised.

### 5. Cross-Platform Path Hygiene in Test Fixtures
Multiple test helpers hardcode Unix paths (`/tmp/test`, `/tmp/integration`). The current
tests pass because `workspaceRoot` is not accessed at runtime in these suites. Before any
test starts reading from `workspaceRoot`, replace with `os.tmpdir()` from `'node:os'`. This
is a `constraints.md` invariant for future test authors.

### 6. Unrecognised `--components` IDs Are Silently Dropped
`runSetup()` silently ignores unrecognised IDs when a `--components a,b` subset is specified —
if all supplied IDs are unknown it returns exit 1, but a partial mismatch produces no warning.
Adding a per-unknown-ID warning line would significantly improve setup wizard DX for callers
who mistype component IDs.

---

## Open Items for Next Session

| Priority | Item | Origin |
|----------|------|--------|
| Low | `vitest.config.ts` still has stale `Phase B` comments in the exclusion block | WP-011 observation |
| Low | `cmd.run([])` in `showInteractiveMenu()` has no try/catch; thrown exceptions propagate out of the loop (terminal is still restored via `finally`, but the loop exits unconditionally) | WP-006, WP-007 QA |
| Low | Empty commands array in `interactive.ts` not explicitly tested (correct behaviour, no coverage gap) | WP-006 QA |
| Low | `docs/configuration.md` has no cross-link back to README API reference | WP-010 documentation |
| Low | `showInteractiveMenu` JSDoc missing note that `cmd.run()` receives empty args in interactive mode | WP-006 Reviewer documentation-forward |
| Low | `waitForKeypress()` helper JSDoc should explain why self-unregistration must precede `restoreTerminal()` in sigintHandler | WP-006 Reviewer documentation-forward |

---

## Artifacts Produced

**New source files:**
- `src/menu/renderer.ts` — `renderMenu()`
- `src/menu/interactive.ts` — `showInteractiveMenu()`
- `src/menu/index.ts` — menu barrel
- `src/setup/checkbox-menu.ts` — `runCheckboxMenu()`
- `src/setup/runner.ts` — `runSetup()`, `validateCommandKeys()` (internal)
- `src/setup/index.ts` — setup barrel
- `src/create-menu.ts` — `createMenu()` factory
- `src/version.ts` — `resolveVersion()`

**Modified source files:**
- `src/types.ts` — `ParsedArgs` moved here; `usageLine?` added to `MenuConfig`
- `src/parser.ts` — `ParsedArgs` re-exported
- `src/help.ts` — `usageLine`, duplicate-help guard, imports `resolveVersion`
- `src/screen.ts` — TTY guard on `clearScreen()`; delegates to `enterRawMode()`
- `src/index.ts` — complete barrel; stale Phase A/B framing removed

**New test files:**
- `tests/screen.test.ts`, `tests/menu/renderer.test.ts`, `tests/menu/interactive.test.ts`
- `tests/setup/checkbox-menu.test.ts`, `tests/setup/runner.test.ts`
- `tests/create-menu.test.ts`, `tests/integration.test.ts`

**Documentation files:**
- `AGENTS.md` (new)
- `docs/agents/project-manifest/README.md`, `tech-stack.md`, `file-tree.md`,
  `api-surface.md`, `data-flows.md`, `constraints.md` (all new)
- `docs/configuration.md` (new)
- `docs/changelog-utilities.md` (new)
- `README.md` (major update — Quick Start, API sections, stale content removed)
- `vitest.config.ts` (coverage exclusions updated per S7)
