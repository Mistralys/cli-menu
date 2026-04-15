# Plan — Phase A: Library Foundation

## Summary

Scaffold the `@mistralys/cli-menu` TypeScript library and implement
all non-interactive utility modules: type definitions, terminal color
helpers, script runners, changelog utilities, help renderer, argument
parser, and pre-flight check utility. Write tests for all modules,
create test fixtures, and verify the build produces correct dual
CJS + ESM output.

This phase produces a buildable, tested library that exports utility
modules independently. The `createMenu()` entry point and interactive
TUI features are deferred to Phase B.

## Architectural Context

### Source: AI Insights `scripts/cli.js`

A 1,209-line CJS file using only Node.js built-ins (`fs`, `path`,
`readline`, `child_process`, `os`). The scaffold spec at
`docs/agents/research/cli-menu-scaffold-spec.md`
documents the section-by-section architecture and serves as the
reference for extraction.

### Reference: `@mistralys/persona-builder`

An existing sibling library (`DEV/ai-persona-builder`) provides the
proven project scaffold:

- **Build:** tsup (dual CJS + ESM), TypeScript 5.8, target `node18`
- **Testing:** Vitest with v8 coverage, 80% thresholds
- **Package:** `"type": "module"`, exports map for subpath imports
- **Structure:** `src/` → `dist/`, `tests/` mirror, `fixtures/`

### Target Repository

Already initialized at `DEV/cli-menu` with MIT license, `.gitignore`,
and README stub. Added to the VS Code multi-root workspace.

### Module Structure (Phase A scope highlighted)

```
src/
├── index.ts                    # Public API re-exports (stub — full in Phase B)
├── types.ts                  ← Type definitions
├── parser.ts                 ← Argument parser
├── preflight.ts              ← Node version check + PreflightError
├── help.ts                   ← Help output renderer
├── terminal/
│   ├── index.ts                # Barrel export
│   ├── colors.ts             ← ANSI color helpers + log()
│   ├── raw-mode.ts           ← enterRawMode(), exitRawMode(), restoreTerminal()
│   └── screen.ts             ← clearScreen(), waitForKey()
├── runners/
│   ├── index.ts                # Barrel export + IS_WIN, NPM constants
│   ├── sync.ts               ← runScript() — blocking
│   ├── long-running.ts       ← runLongScript() — async, SIGINT forwarding
│   └── shell.ts              ← sh() — non-fatal, returns exit code
└── changelog/
    ├── index.ts                # Barrel export (subpath entry point)
    ├── version.ts             ← readChangelogVersion()
    ├── entry.ts               ← extractChangelogEntry()
    └── manifest.ts            ← readPackageVersion(), readPyprojectVersion()
```

Modules marked `←` are implemented in this phase. The `setup/`,
`menu/`, and `create-menu.ts` modules are deferred to Phase B.

### Target Package

| Property | Value |
|----------|-------|
| Package name | `@mistralys/cli-menu` |
| Language | TypeScript 5.8+ (ES2022) |
| Module format | Dual CJS + ESM (via tsup) |
| Runtime | Node.js ≥ 18 |
| Dependencies | Zero runtime dependencies |
| Build tool | tsup |
| Test framework | Vitest ^4.1 (v8 coverage, 80% thresholds) |
| License | MIT |

## Approach / Architecture

### Subpath Exports

| Import Path | Contents |
|-------------|----------|
| `@mistralys/cli-menu` | All types, terminal utilities, runners, help, parser, preflight |
| `@mistralys/cli-menu/changelog` | `readChangelogVersion()`, `extractChangelogEntry()`, `readPackageVersion()`, `readPyprojectVersion()`, `ChangelogEntry` type |

### Exit Code Contract

The library never calls `process.exit()`. All functions that need to
signal failure use return values (exit codes) or throw typed errors
(`PreflightError`). Consumers decide exit behavior.

## Rationale

- **Foundation first.** These modules have no interdependencies with
  the interactive TUI and are independently testable with pure unit
  tests (no stdin/stdout mocking). Building them first creates a
  stable base for Phase B.
- **Separate changelog subpath.** Changelog parsing is independently
  useful for CI/release scripts. Separate export avoids unnecessary
  menu engine imports.
- **Zero runtime dependencies.** Mirrors the source CLI's zero-dep
  design.
- **TypeScript with dual output.** The CJS + ESM build ensures
  `require()` works for CJS consumers.

## Detailed Steps

### Step 1 — Library Scaffolding

1. **Initialize the npm package.**
   - `npm init` with `name: @mistralys/cli-menu`, `type: module`.
   - Add `tsup`, `typescript`, `vitest`, `@vitest/coverage-v8`,
     `@types/node` as dev deps.
   - Create `tsconfig.json` matching persona-builder conventions
     (target ES2022, module ESNext, moduleResolution bundler, strict).
   - Create `tsup.config.ts` with two entry points:
     `index` (`src/index.ts`), `changelog` (`src/changelog/index.ts`).
     Format `['cjs', 'esm']`, dts, sourcemap, target `node18`.
   - Configure `package.json` exports map for both subpaths
     (`.` → `dist/index`, `./changelog` → `dist/changelog/index`),
     `files: ["dist"]`, `engines: { node: ">=18.0.0" }`.
   - Create `vitest.config.ts` with v8 coverage at 80% thresholds,
     excluding `src/create-menu.ts`, `src/terminal/raw-mode.ts`,
     `src/terminal/screen.ts`, `src/setup/**`, `src/menu/**`,
     and `*.d.ts`. These interactive modules require stdin/stdout
     mocking and are tested in Phase B; excluding them from coverage
     thresholds prevents false failures in Phase A.
   - Add npm scripts: `build`, `dev`, `test`, `test:watch`, `typecheck`.
   - Create directory structure: `src/`, `tests/`, `fixtures/`.
   - Verify `.gitignore` includes `dist/`, `node_modules/`,
     `coverage/`.

### Step 2 — Type Definitions

2. **Create `src/types.ts`** — all public interfaces:
   - `MenuConfig` — top-level configuration for `createMenu()`:
     `name`, `banner` (string[]), `version` (string | `() => string`),
     `commands` (Command[]), `setupComponents?` (SetupComponent[]),
     `preflightChecks?` (PreflightCheck[]),
     `categoryVersions?` (Record<string, () => string>),
     `workspaceRoot`.
   - `Command` — matches the scaffold spec §12.2: `id`, `key`
     (string | null), `label`, `category`, `description`,
     `run` ((args: string[]) => void | Promise<void>),
     `hidden?`, `helpHidden?`, `helpVariants?` (HelpVariant[]),
     `helpOrder?` (number).
   - `HelpVariant` — tuple `[command: string, description: string]`.
   - **`helpOrder` replaces the scaffold spec's `interleaveAfter`**
     mechanism. Instead of a complex cross-reference object
     (`{ command, variant }`), commands use a numeric sort key.
     Commands without `helpOrder` retain insertion order. Commands
     with `helpOrder` are positioned relative to other ordered
     entries. This is simpler to document, test, and consume.
     Consumers control ordering by assigning explicit numbers.
   - `SetupComponent` — `id`, `label`, `desc`,
     `detect` (() => boolean), `run` ((args: string[]) => boolean),
     `validate` (() => boolean).
   - `PreflightCheck` — `() => void` (throws `PreflightError` on
     failure; the library catches it and returns the appropriate
     exit code).
   - `PreflightError` — typed error class thrown by pre-flight
     checks. Contains `exitCode` (default 1) and `message`.
   - `ScriptRunnerOptions` — options for `sh()`.
   - `ChangelogEntry` — `{ version: string; title: string;
     body: string }`.

### Step 3 — Terminal Utilities

3. **Create `src/terminal/colors.ts`** — the `C` color helper object
   (matching scaffold spec §6) and `log(msg, color?)` function.
   Export `Colors` type for the color name union.
4. **Create `src/terminal/raw-mode.ts`** — `enterRawMode()`,
   `exitRawMode()`, `restoreTerminal()`, `isRawModeSupported()`.
   Wrap `setRawMode` in try/catch. Guarantee restoration on all exit
   paths (scaffold spec §14.6).
5. **Create `src/terminal/screen.ts`** — `clearScreen()` via
   `\x1b[2J\x1b[0;0H`, `waitForKey()` (scaffold spec §14.5).
   **Non-TTY guard:** `waitForKey()` must resolve immediately (no-op)
   when `!process.stdin.isTTY`. This prevents hangs when the library
   is used in CI or piped environments. Standalone utility consumers
   who call `waitForKey()` directly (outside `createMenu()`) get safe
   behavior without needing to check for a TTY themselves.
6. **Create `src/terminal/index.ts`** — barrel export.

### Step 4 — Script Runners

7. **Create `src/runners/sync.ts`** — `runScript(command, args,
   options)`: synchronous spawn, returns exit code on failure
   (scaffold spec §10.1). `command` is an absolute path to a script
   or a bare command name. `options.cwd` defaults to the
   `workspaceRoot` from `MenuConfig`. The consumer constructs paths:
   `runScript(path.join(SCRIPTS_DIR, 'sync-personas.js'))`.
8. **Create `src/runners/long-running.ts`** — `runLongScript(command,
   args, options)`: async spawn with SIGINT forwarding (scaffold spec
   §10.2). Same `command` semantics as `runScript`.
   Returns `{ child: ChildProcess; exitCode: Promise<number> }` —
   the `child` handle lets consumers add custom signal handlers or
   pipe output, while `exitCode` resolves when the child terminates.
   The library's `createMenu()` uses both: it registers its own
   SIGINT handler on the child and awaits the exit code to return
   from `run()`. The library never calls `process.exit()` — the
   consumer decides what to do with the resolved exit code.
9. **Create `src/runners/shell.ts`** — `sh(cmd, args, options)`:
   non-fatal spawn returning exit code. Default `shell: true` on
   Windows via `IS_WIN` (scaffold spec §10.3).
10. **Create `src/runners/index.ts`** — barrel export + `IS_WIN` and
    `NPM` constants.

### Step 5 — Changelog Utilities

11. **Create `src/changelog/version.ts`** —
    `readChangelogVersion(filePath)`: extract topmost version from a
    changelog file. Handles both `## v1.2.3` and `## [1.2.3]` heading
    formats (scaffold spec §9).
12. **Create `src/changelog/entry.ts`** —
    `extractChangelogEntry(filePath)`: parse topmost entry returning
    `ChangelogEntry` with version, title, and body. Uses the header
    regex from scaffold spec §17.4. Stops at next `##` heading.
    Handles CRLF.
    **Note:** This function does not exist in `scripts/cli.js`. It is
    a new implementation based on scaffold spec §17.4, modeled after
    the standalone `scripts/extract-changelog-entry.js` in AI
    Insights.
13. **Create `src/changelog/manifest.ts`** —
    `readPackageVersion(dir)`: read version from `package.json`.
    `readPyprojectVersion(dir)`: read version from `pyproject.toml`.
    **Known limitation:** `readPyprojectVersion()` uses a naive regex
    (`/^version\s*=\s*"([^"]+)"/m`) that matches the first
    `version = "..."` line in the file. This works for simple
    `pyproject.toml` files with a top-level `version` key, but may
    return incorrect results for complex TOML layouts where `version`
    appears under nested sections like `[tool.poetry]`. This is an
    acceptable v1 trade-off for the zero-dependency constraint.
    Document this limitation in the API docs.
14. **Create `src/changelog/index.ts`** — barrel export for the
    `@mistralys/cli-menu/changelog` subpath.

### Step 6 — Help Renderer

15. **Create `src/help.ts`** — `printHelp(commands, config)`: renders
    help output respecting `helpHidden`, `helpVariants`, and
    `helpOrder`. Commands are sorted by `helpOrder` (ascending) when
    present; commands without `helpOrder` retain their insertion
    order relative to each other. Formats: command name left-padded
    2 spaces, padded to 28 characters, description in dim color.
    `help` always appended as last entry (scaffold spec §13).

### Step 7 — Argument Parser

16. **Create `src/parser.ts`** — `parseArgs(argv)`: returns
    `{ command: string | null; flags: string[] }`. First non-flag
    argument is the command, rest are flags (scaffold spec §15).

### Step 8 — Pre-flight Check Utility

17. **Create `src/preflight.ts`** — `checkNodeVersion(minMajor?)`:
    built-in pre-flight check for minimum Node.js version (scaffold
    spec §8). Throws `PreflightError` on failure. Consumers can use
    this directly or provide custom checks.

### Step 9 — Public API Stub

18. **Create `src/index.ts`** — re-export all types and individual
    utilities (colors, log, runners, changelog, parser, help,
    preflight) for consumers who want granular access. The
    `createMenu` re-export is deferred to Phase B.

### Step 10 — Tests

19. **`tests/terminal/colors.test.ts`** — verify ANSI escape
    sequences, composition (`bold(cyan('text'))`), `log()` output.
20. **`tests/parser.test.ts`** — no args, flags only, command + flags,
    command with dashes, empty argv.
21. **`tests/changelog/version.test.ts`** — `## v1.2.3` format,
    `## [1.2.3]` format, missing file, empty file, no version heading.
22. **`tests/changelog/entry.test.ts`** — full entry extraction,
    multi-line body, stops at next `##`, CRLF handling.
23. **`tests/changelog/manifest.test.ts`** — valid `package.json`,
    valid `pyproject.toml`, missing files, malformed JSON.
24. **`tests/help.test.ts`** — category grouping, hidden commands
    excluded, helpVariants rendered, `helpOrder` sorting (explicit
    order, mixed with unordered commands), `help` always appended.
25. **`tests/preflight.test.ts`** — verify `checkNodeVersion()` throws
    `PreflightError` when Node version is below minimum (mock
    `process.versions.node`), succeeds when above minimum,
    verify `PreflightError` carries `exitCode` and `message`.
26. **Create `fixtures/`** — sample changelog files (various formats),
    sample `package.json`, sample `pyproject.toml` for test data.

**Note:** `src/terminal/raw-mode.ts` and `src/terminal/screen.ts` are
implemented in this phase but not unit-tested here. These modules
require stdin/stdout mocking (raw mode, keypress events) which is
scoped to Phase B's interactive test patterns.

### Step 11 — Build Verification

27. **Verify `npm run build`** produces correct dual output in
    `dist/`.
28. **Verify subpath exports** work:
    `require('@mistralys/cli-menu')` and
    `require('@mistralys/cli-menu/changelog')` with both `require()`
    and `import`.
29. **Verify TypeScript declarations** are emitted (`.d.ts` files).
30. **Verify `npm test`** passes with coverage thresholds met.

## Dependencies

- Node.js ≥ 18 (runtime)
- `tsup` ≥ 8 (build, dev dependency)
- `typescript` ≥ 5.8 (dev dependency)
- `vitest` ^4.1 (test, dev dependency)
- `@vitest/coverage-v8` (test, dev dependency)
- `@types/node` (dev dependency)
- Zero production dependencies

## Required Components

### New Files

**Configuration:**
- `package.json`
- `tsconfig.json`
- `tsup.config.ts`
- `vitest.config.ts`

**Source (16 files):**
- `src/index.ts` — public API stub
- `src/types.ts` — type definitions
- `src/parser.ts` — argument parser
- `src/preflight.ts` — Node version check + `PreflightError` class
- `src/help.ts` — help output renderer
- `src/terminal/index.ts`, `colors.ts`, `raw-mode.ts`, `screen.ts`
- `src/runners/index.ts`, `sync.ts`, `long-running.ts`, `shell.ts`
- `src/changelog/index.ts`, `version.ts`, `entry.ts`, `manifest.ts`

**Tests (7 suites):**
- `tests/terminal/colors.test.ts`
- `tests/parser.test.ts`
- `tests/preflight.test.ts`
- `tests/changelog/version.test.ts`
- `tests/changelog/entry.test.ts`
- `tests/changelog/manifest.test.ts`
- `tests/help.test.ts`

**Fixtures:**
- `fixtures/` — sample changelogs, package.json, pyproject.toml

## Assumptions

- The `@mistralys` npm scope is already configured.
- The scaffold spec document serves as the architectural reference
  for all extraction decisions.
- Phase B will add `createMenu()`, setup wizard, interactive menu,
  remaining tests, and documentation.

## Constraints

- **Zero runtime dependencies.** Only Node.js built-ins.
- **Cross-platform.** Windows, macOS, Linux. All path operations via
  `path.join()`, Windows `.cmd` spawn handling via `IS_WIN` gate.
- **CJS consumer compatibility.** The tsup dual build must produce
  working CJS output. Verify with
  `node -e "require('@mistralys/cli-menu')"`.
- **TypeScript strict mode.** `strict: true` in `tsconfig.json`.
- **No `process.exit()`.** Library never calls `process.exit()`.
  Pre-flight checks throw `PreflightError`; runners return exit
  codes.

## Out of Scope (deferred to Phase B or C)

- `createMenu()` factory and orchestrator (`src/create-menu.ts`)
- Setup wizard (checkbox TUI + runner)
- Interactive menu engine (renderer + keypress loop)
- Integration tests for `createMenu()`
- Library documentation (README, configuration docs)
- Agent documentation (AGENTS.md, project manifest)
- AI Insights migration
- CI/CD and npm publishing

## Acceptance Criteria

- `npm run build` produces `dist/index.js`, `dist/index.cjs`,
  `dist/changelog/index.js`, `dist/changelog/index.cjs` with
  corresponding `.d.ts` files.
- `require('@mistralys/cli-menu')` and
  `import from '@mistralys/cli-menu'` both resolve.
- `require('@mistralys/cli-menu/changelog')` and
  `import from '@mistralys/cli-menu/changelog'` both resolve.
- `readChangelogVersion()` parses both `## v1.2.3` and `## [1.2.3]`.
- `extractChangelogEntry()` returns version, title, and body.
- `parseArgs()` correctly splits command and flags.
- `printHelp()` respects `hidden`, `helpHidden`, `helpVariants`,
  and `helpOrder`.
- `checkNodeVersion()` throws `PreflightError` on old Node.
- All tests pass (`npm test`) with 80% coverage thresholds met.

## Testing Strategy

- **Terminal utilities:** Verify ANSI escape sequences, composition,
  `log()` output capture.
- **Argument parser:** Edge cases — no args, flags only, command +
  flags, command with dashes, empty argv.
- **Changelog version:** Multiple heading formats, missing file,
  empty file, no version heading.
- **Changelog entry:** Full entry extraction, multi-line body, stops
  at next `##`, CRLF handling.
- **Manifest readers:** Valid `package.json`, valid `pyproject.toml`,
  missing files, malformed JSON.
- **Help renderer:** Category grouping, hidden commands excluded,
  helpVariants rendered, `helpOrder` sorting (explicit order, mixed
  with unordered commands), `help` always appended.
- **Pre-flight checks:** `checkNodeVersion()` throws on old Node
  (mock `process.versions.node`), succeeds on current Node,
  `PreflightError` carries expected properties.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **CJS `require()` fails for the TS library** | tsup dual build is proven in persona-builder. Verify with `node -e "require('@mistralys/cli-menu')"`. |
| **Windows shell spawning regression** | The `IS_WIN` → `shell: true` default from scaffold spec §10.3 is preserved in `sh()`. |
| **Scope creep into interactive features** | Hard boundary: no `stdin` interaction, no `setRawMode`, no menu rendering in this phase. |
| **`runLongScript` lifecycle ambiguity** | Returns `{ child, exitCode }` — consumer owns process lifecycle. `createMenu()` (Phase B) wraps this internally. Documented in API docs. |
| **TOML parsing fails on nested sections** | Documented as known limitation. Regex matches first `version = "..."` line only. Acceptable for v1 zero-dependency constraint. |
