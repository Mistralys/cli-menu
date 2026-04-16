# Plan — Phase B: Interactive Engine + Documentation

## Summary

Implement the interactive TUI features of `@mistralys/cli-menu`: the
setup wizard with checkbox selector, the interactive menu engine with
keypress dispatch, and the `createMenu()` factory that wires everything
together. Integrate Phase A synthesis carry-forward items (DRY
refactors, runtime validations, TTY guards). Write remaining test
suites, complete library documentation, and create agent documentation
(AGENTS.md + project manifest).

**Prerequisite:** Phase A must be complete — this phase depends on the
terminal utilities, runners, help renderer, parser, and type
definitions implemented there.

**Deliverable:** A complete, documented library ready for consumption.
All tests pass, documentation is written, agent manifest is in place.

## Architectural Context

### Phase A Deliverables (available as dependencies)

Phase A produced the following tested modules:

- `src/types.ts` — all public interfaces (`MenuConfig`, `Command`,
  `SetupComponent`, `PreflightCheck`, `PreflightError`, etc.)
- `src/colors.ts` — ANSI color helpers (`C`, `Colors`, `log`)
- `src/raw-mode.ts` — raw mode management (`enterRawMode()`,
  `exitRawMode()`, `restoreTerminal()`, `isRawModeSupported()`)
- `src/screen.ts` — screen utilities (`clearScreen()`, `waitForKey()`)
- `src/runners.ts` — `runScript()`, `runLongScript()`, `sh()`,
  `IS_WIN`, `NPM`
- `src/changelog/index.ts` — `readChangelogVersion()`,
  `extractChangelogEntry()`, `readPackageVersion()`,
  `readPyprojectVersion()`
- `src/help.ts` — `printHelp()`
- `src/parser.ts` — `parseArgs()`, `ParsedArgs`
- `src/preflight.ts` — `checkNodeVersion()`, `PreflightError`
- `src/index.ts` — public API barrel (re-exports all Phase A modules)

### Phase A Synthesis Carry-Forwards

The Phase A synthesis identified 8 actionable items to integrate into
Phase B. These are incorporated into the Detailed Steps below.

| # | Item | Priority | Step |
|---|------|----------|------|
| S1 | Refactor `waitForKey()` to delegate to `enterRawMode()` | High | Step 1A |
| S2 | Add `usageLine` field to `MenuConfig` | High | Step 1B |
| S3 | Extract `resolveVersion()` from `help.ts` to shared util | Medium | Step 1B |
| S4 | Add `process.stdout.isTTY` guard to `clearScreen()` | Medium | Step 1A |
| S5 | Runtime `Command.key` single-char validation in `createMenu()` | Medium | Step 3 |
| S6 | Guard duplicate `id: 'help'` in `printHelp()` | Medium | Step 1B |
| S7 | Coverage exclude for `src/index.ts` + `src/types.ts` | Low | Step 8 |
| S8 | Move `ParsedArgs` to `src/types.ts` | Low | Step 1B |

### Module Structure (Phase B scope highlighted)

```
src/
├── index.ts                  ← Update: add createMenu re-export
├── types.ts                  ← Update: add usageLine to MenuConfig;
│                                receive ParsedArgs from parser.ts [S2, S8]
├── create-menu.ts            ← createMenu() factory (key validation [S5])
├── version.ts                ← NEW: extracted resolveVersion() [S3]
├── parser.ts                 ← Update: re-export ParsedArgs from types [S8]
├── preflight.ts                # (Phase A — no changes)
├── help.ts                   ← Update: use usageLine [S2], guard
│                                duplicate help ID [S6], import
│                                resolveVersion from version.ts [S3]
├── colors.ts                   # (Phase A — no changes)
├── raw-mode.ts                 # (Phase A — no changes)
├── screen.ts                 ← Update: waitForKey() delegates to
│                                enterRawMode() [S1]; clearScreen()
│                                TTY guard [S4]
├── runners.ts                  # (Phase A — no changes)
├── changelog/
│   └── index.ts                # (Phase A — no changes)
├── setup/
│   ├── index.ts              ← Barrel export
│   ├── checkbox-menu.ts      ← Interactive checkbox TUI
│   └── runner.ts             ← runSetup() orchestrator
└── menu/
    ├── index.ts              ← Barrel export
    ├── renderer.ts           ← renderMenu()
    └── interactive.ts        ← showInteractiveMenu()
```

Modules marked `←` are implemented or modified in this phase.
Annotations like `[S1]` reference the synthesis carry-forward table.

> **Design note — `interleaveAfter` replaced by `helpOrder`.**
> Phase A replaces the scaffold spec's `interleaveAfter` mechanism
> (a cross-reference object `{ command, variant }`) with a simpler
> `helpOrder?: number` property on `Command`. Consumers control help
> output ordering by assigning explicit numeric sort keys. Commands
> without `helpOrder` retain insertion order. This is simpler to
> implement, test, and document.

### Consumer Usage

```ts
import { createMenu } from '@mistralys/cli-menu';

const menu = createMenu({
  name: 'AI Insights CLI',
  banner: BANNER_LINES,
  version: () => readVersion(),
  usageLine: 'node scripts/cli.js [command] [options]',
  categoryVersions: { 'MCP Server': () => readSubVersion(MCP_DIR) },
  commands: COMMANDS,
  setupComponents: SETUP_COMPONENTS,
  preflightChecks: [checkWorkspaceRoot],
  workspaceRoot: WORKSPACE_ROOT,
});

const exitCode = await menu.run(process.argv.slice(2));
process.exit(exitCode);
```

### Exit Code Contract

`createMenu(config).run(argv)` returns `Promise<number>`:
- `0` — success (help printed, command dispatched, interactive menu
  exited normally)
- Non-zero — failure (unknown command, setup component failed,
  pre-flight check threw `PreflightError`)

The library never calls `process.exit()`.

## Rationale

- **Interactive features depend on Phase A utilities.** The menu
  renderer uses `colors.ts`, `clearScreen()`, and `waitForKey()`.
  The setup wizard uses `restoreTerminal()` and raw mode management.
  Building on tested foundations ensures reliability.
- **stdin/stdout mocking tests are separate.** The interactive modules
  require different test patterns (mocking `process.stdin`,
  `setRawMode`, etc.) that are cleanly separated from the pure unit
  tests in Phase A.
- **Documentation before migration.** Writing docs while the API is
  fresh ensures accuracy. The migration in Phase C benefits from
  having complete documentation to reference.

## Detailed Steps

### Step 1A — Phase A Hardening: Terminal Modules [S1, S4]

1. **Update `src/screen.ts` — refactor `waitForKey()`** to delegate
   to `enterRawMode()` from `raw-mode.ts` instead of inlining the
   three raw-mode setup lines. This eliminates the DRY violation
   identified by the WP-004 reviewer and ensures future improvements
   to `enterRawMode()` (e.g., error handling) automatically apply to
   `waitForKey()`. [S1]
2. **Update `src/screen.ts` — add TTY guard to `clearScreen()`.**
   Add an early return when `!process.stdout.isTTY` to prevent ANSI
   escape garbage in piped or CI output-capture environments.
   Consistent with the existing guards in `isRawModeSupported()` and
   `waitForKey()`. [S4]
3. **Update tests** — extend `tests/help.test.ts` (or add a screen
   test) to verify `clearScreen()` is a no-op when stdout is not a
   TTY. Verify `waitForKey()` still works correctly after the
   delegation refactor.

### Step 1B — Phase A Hardening: Types, Help, Utilities [S2, S3, S6, S8]

4. **Move `ParsedArgs` to `src/types.ts`.** Add the interface to
   `types.ts` alongside the other exported types. Update
   `src/parser.ts` to import and re-export `ParsedArgs` from
   `types.ts` so existing consumers are unaffected. [S8]
5. **Add `usageLine` to `MenuConfig` in `src/types.ts`.** Add an
   optional `usageLine?: string` field. When omitted, `printHelp()`
   falls back to `process.argv[1]` to derive a reasonable default.
   [S2]
6. **Create `src/version.ts`** — extract `resolveVersion()` from
   `src/help.ts` into this new module. The function signature:
   `resolveVersion(config: MenuConfig): string`. Both `help.ts` and
   the upcoming `create-menu.ts` import from here. [S3]
7. **Update `src/help.ts`** — import `resolveVersion` from
   `version.ts`. Use `config.usageLine` (with `process.argv[1]`
   fallback) for the usage line instead of the hardcoded string.
   Add a guard to skip the synthetic `help` footer entry when the
   commands array already contains a command with `id: 'help'`. [S6]
8. **Update `src/index.ts`** — add `resolveVersion` re-export.
9. **Update tests** — extend `tests/help.test.ts` to cover:
   `usageLine` appears in output when provided; default fallback
   when omitted; duplicate `id: 'help'` suppresses synthetic entry.

### Step 2 — Setup Wizard

10. **Create `src/setup/checkbox-menu.ts`** — `runCheckboxMenu(
    components)`: interactive TUI checkbox selector
    (scaffold spec §11.2). Uses `enterRawMode()` for single-keypress
    input. Supports ↑/↓, j/k, Space, `a` (toggle all), Enter
    (run selected), `q` (cancel). Returns `Promise<string[] | null>`
    (selected IDs or null on cancel). Shows `(done)` for pre-detected
    components.
11. **Create `src/setup/runner.ts`** — `runSetup(components, args)`:
    orchestrates component execution with `--all` / `--components` /
    interactive selection. Non-TTY detection: requires `--all` or
    `--components` if `!process.stdin.isTTY` (scaffold spec §11.3).
    Prints summary table with success/failure counts (scaffold spec
    §11.4). Returns exit code 1 if any component failed.
12. **Create `src/setup/index.ts`** — barrel export.

### Step 3 — Interactive Menu Engine

13. **Create `src/menu/renderer.ts`** — `renderMenu(config)`: clears
    screen, draws banner in cyan, version in dim, category headers
    (bold, with optional sub-project versions), commands with hotkeys,
    `[h] Help [q] Quit` footer, `Choose:` prompt (scaffold spec
    §14.2).
14. **Create `src/menu/interactive.ts`** — `showInteractiveMenu(
    config)`: keypress loop via `readline.emitKeypressEvents`.
    Dispatches hotkeys to command handlers. Distinguishes long-running
    commands (take over the process) from blocking commands
    (`waitForKey` after completion, then re-render). Restores terminal
    state before running any command (scaffold spec §14.4).
    **SIGINT cleanup:** `showInteractiveMenu()` must register a
    `process.on('SIGINT')` handler that calls `restoreTerminal()`
    and then re-raises the signal (`process.kill(process.pid,
    'SIGINT')`). The handler must be unregistered when the menu exits
    cleanly. This prevents terminal corruption if the user presses
    Ctrl+C while in raw mode. The same pattern applies to the
    checkbox TUI in `src/setup/checkbox-menu.ts`.
15. **Create `src/menu/index.ts`** — barrel export.

### Step 4 — Main Entry Point

16. **Create `src/create-menu.ts`** — `createMenu(config)`: returns
    `{ run(argv: string[]): Promise<number> }`. The returned number
    is the exit code (0 = success). Pre-flight check failures are
    caught as `PreflightError` exceptions and mapped to exit codes.
    Wires argument parsing, `help` dispatch, direct CLI command
    dispatch, and interactive menu fallback (scaffold spec §16).
    Non-TTY detection for interactive mode.
    **Runtime validation [S5]:** On construction, validate that every
    `Command` with a non-null `key` has exactly one character. Throw
    a descriptive error if any key exceeds one character. This
    converts a silent footgun into an explicit early failure.
    For long-running commands, `createMenu` internally uses the
    `{ child, exitCode }` return value from `runLongScript()` to
    register its own SIGINT handler and await the exit code — the
    library never calls `process.exit()`.
17. **Update `src/index.ts`** — add `createMenu` re-export alongside
    existing utility exports. This completes the public API.

### Step 5 — Launcher Script Documentation

18. **Document launcher scripts in README.md** — provide copy-paste
    `menu.sh` (bash) and `menu.cmd` (Windows batch) snippets in the
    README under a "Launcher Scripts" section (scaffold spec §3.1).
    These are 3-line wrapper scripts; inline documentation is
    sufficient.

### Step 6 — Remaining Tests

19. **`tests/setup/runner.test.ts`** — `--all` selects all,
    `--components a,b` selects subset, summary counts, exit code on
    failure.
20. **`tests/setup/checkbox-menu.test.ts`** — mock stdin keypress
    sequences to verify: cursor navigation (↑/↓, j/k), space
    toggles individual items, `a` toggles all, Enter returns
    selected IDs, `q` returns null (cancel), pre-detected components
    show `(done)` and are pre-checked.
21. **`tests/menu/renderer.test.ts`** — output contains banner lines,
    version string, category headers, command labels with keys,
    footer.
22. **`tests/menu/interactive.test.ts`** — mock keypress dispatch:
    verify known hotkey resolves to correct command, unknown key
    triggers re-render, `q` exits, `h` triggers help, SIGINT handler
    is registered and calls `restoreTerminal()`.
23. **`tests/integration.test.ts`** — `createMenu()` with minimal
    config: verify `run(['help'])` produces expected output and
    returns `0`; `run(['some-command'])` dispatches correctly;
    `run(['unknown'])` returns non-zero exit code; verify
    `Command.key` > 1 character throws on construction [S5].

### Step 7 — Library Documentation

24. **Write `README.md`** — installation, quick start, API overview,
    configuration reference, launcher scripts section, migration
    guide from the scaffold spec.
25. **Write `docs/configuration.md`** — detailed `MenuConfig`,
    `Command`, and `SetupComponent` schemas with examples. Include
    the new `usageLine` field [S2].
26. **Write `docs/changelog-utilities.md`** — standalone usage of the
    changelog subpath export.

### Step 8 — Agent Documentation

27. **Create `AGENTS.md`** for the cli-menu repo following the
    persona-builder pattern.
28. **Create `docs/agents/project-manifest/`** with README.md,
    tech-stack.md, constraints.md, file-tree.md, api-surface.md,
    data-flows.md.

### Step 9 — Final Verification

29. **Verify `npm test`** passes with all suites (Phase A + B) and
    80% coverage thresholds met.
30. **Verify `npm run build`** still produces correct dual output.
31. **Verify CJS compatibility:**
    `node -e "require('@mistralys/cli-menu')"` resolves `createMenu`.
32. **Update `vitest.config.ts`** — remove coverage exclusions for
    interactive modules that now have test suites (e.g.,
    `src/setup/**`, `src/menu/**`, `src/raw-mode.ts`, `src/screen.ts`).
    Add exclusions for `src/index.ts` and `src/types.ts` (re-export
    barrel and type-only module have no testable logic) [S7].
    Keep exclusions only for modules that genuinely cannot be
    meaningfully covered.

## Required Components

### New Files

**Source (7 files):**
- `src/version.ts` — extracted `resolveVersion()` [S3]
- `src/create-menu.ts` — `createMenu()` factory
- `src/setup/index.ts`, `checkbox-menu.ts`, `runner.ts`
- `src/menu/index.ts`, `renderer.ts`, `interactive.ts`

**Tests (5 suites):**
- `tests/setup/runner.test.ts`
- `tests/setup/checkbox-menu.test.ts`
- `tests/menu/renderer.test.ts`
- `tests/menu/interactive.test.ts`
- `tests/integration.test.ts`

**Docs:**
- `README.md` (rewrite from stub)
- `docs/configuration.md`
- `docs/changelog-utilities.md`
- `AGENTS.md`
- `docs/agents/project-manifest/` (6 manifest files)

### Modified Files (Phase A modules)

- `src/types.ts` — add `usageLine` to `MenuConfig`; receive
  `ParsedArgs` [S2, S8]
- `src/parser.ts` — re-export `ParsedArgs` from `types.ts` [S8]
- `src/screen.ts` — `waitForKey()` delegation + `clearScreen()` TTY
  guard [S1, S4]
- `src/help.ts` — `usageLine` support, `resolveVersion` import,
  duplicate help ID guard [S2, S3, S6]
- `src/index.ts` — add `createMenu` + `resolveVersion` re-exports

## Assumptions

- Phase A is complete and all its tests pass.
- The types defined in Phase A (`MenuConfig`, `Command`,
  `SetupComponent`, etc.) are stable. The only type modification is
  adding `usageLine` to `MenuConfig` and relocating `ParsedArgs` to
  `types.ts` — both are additive/non-breaking.
- `@mistralys/persona-builder` serves as the AGENTS.md pattern
  reference.

## Constraints

- **No terminal state corruption.** Every code path that enters raw
  mode must guarantee restoration. The library handles this
  internally — consumers never manage raw mode. Both
  `showInteractiveMenu()` and `runCheckboxMenu()` must register a
  `process.on('SIGINT')` cleanup handler that restores terminal
  state before re-raising the signal. The handler must be
  unregistered on clean exit to avoid listener leaks.
- **No `process.exit()`.** The library returns exit codes; consumers
  decide process lifecycle.
- **Cross-platform.** The checkbox TUI and interactive menu must work
  on Windows, macOS, and Linux. `setRawMode` availability is checked
  at runtime.

## Out of Scope (deferred to Phase C)

- AI Insights migration (installing the library, refactoring
  `scripts/cli.js`)
- CI/CD setup (GitHub Actions)
- npm publishing

## Acceptance Criteria

- `createMenu(config).run([])` launches an interactive menu when
  stdin is a TTY and returns exit code `0`.
- `createMenu(config).run(['help'])` prints help and returns `0`.
- `createMenu(config).run(['some-command'])` dispatches to the
  correct handler and returns `0` (or non-zero on failure).
- `createMenu(config).run(['setup', '--all'])` runs all setup
  components non-interactively and returns `1` if any failed.
- `createMenu()` throws if any `Command.key` exceeds one character
  [S5].
- The library never calls `process.exit()`.
- The setup wizard's checkbox TUI works with keyboard navigation
  (↑/↓, j/k, space, a, enter, q).
- Help output correctly handles `hidden`, `helpHidden`,
  `helpVariants`, and `helpOrder`.
- Help usage line uses `config.usageLine` when provided, otherwise
  falls back to `process.argv[1]` [S2].
- When a command with `id: 'help'` is registered, `printHelp()` does
  not emit a duplicate synthetic help entry [S6].
- `clearScreen()` is a no-op when `process.stdout.isTTY` is false
  [S4].
- `waitForKey()` delegates to `enterRawMode()` — no inline raw-mode
  setup [S1].
- All tests pass (`npm test`) with 80% coverage thresholds met.
  Phase B must either remove interactive module exclusions from
  `vitest.config.ts` (if the new stdin-mocking tests provide
  sufficient coverage) or keep targeted exclusions for modules that
  cannot be meaningfully covered.
- `README.md` documents installation, quick start, configuration,
  and launcher scripts.
- `AGENTS.md` and project manifest are complete.

## Testing Strategy

### Automated Tests

- **Phase A hardening (Steps 1A–1B):** Existing `tests/help.test.ts`
  extended with `usageLine` rendering, duplicate help ID suppression.
  New assertions for `clearScreen()` no-op on non-TTY.
  `waitForKey()` delegation is implicitly tested by existing tests.
- **Setup runner:** `--all` selects all, `--components a,b` selects
  subset, summary counts, exit code on failure.
- **Checkbox TUI:** Mock stdin keypress sequences. Verify cursor
  navigation, space toggle, toggle-all, Enter returns selected IDs,
  `q` cancels, pre-detected items shown as `(done)`.
- **Menu renderer:** Output contains banner lines, version string,
  category headers, command labels with keys, footer.
- **Interactive menu:** Mock keypress dispatch. Verify hotkey
  resolution, unknown-key re-render, `q` exit, `h` help dispatch,
  SIGINT handler registration.
- **Integration:** `createMenu()` with minimal config, verify direct
  CLI dispatch resolves the correct command, exit codes are correct,
  multi-char `Command.key` throws on construction [S5].

### Manual Tests

- **Interactive menu:** Verify rendering, hotkey dispatch, screen
  clearing, `waitForKey` cycle.
- **Checkbox TUI:** Keyboard navigation, toggle, toggle-all, enter,
  quit.
- **Long-running commands:** SIGINT forwarding via `child` handle,
  process exit propagation via `exitCode` promise.
- **SIGINT during raw mode:** Ctrl+C while in interactive menu or
  checkbox TUI restores terminal state (no corruption).
- **Cross-platform:** Verify on macOS (primary), Windows via manual
  test or CI.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Terminal state corruption if library throws** | The `restoreTerminal()` safety pattern from scaffold spec §14.6 is preserved. All keypress handlers wrapped in try/catch. |
| **`process.stdin.setRawMode` differs across Node versions** | Test on Node 18 and 22. Existing code handles this with try/catch and `isRawModeSupported()`. |
| **stdin/stdout mocking complexity** | Follow established Vitest patterns. Keep mocking scoped to individual tests. |
| **SIGINT leaves terminal in raw mode** | Both `showInteractiveMenu()` and `runCheckboxMenu()` register a SIGINT cleanup handler. Handler unregistered on clean exit. |
| **Coverage threshold failure from interactive modules** | Phase A excludes interactive modules from coverage. Phase B adds stdin-mocking tests and removes exclusions for covered modules. |
| **Scope creep into project-specific features** | Hard rule: the library provides menu infrastructure only. All project-specific logic stays in the consumer. |
| **Phase A module changes break existing tests** | Steps 1A–1B are executed first with test verification before new modules are added. Changes are additive or mechanical refactors. |
