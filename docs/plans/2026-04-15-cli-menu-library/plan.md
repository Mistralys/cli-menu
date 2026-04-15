# Plan — `@mistralys/cli-menu` Library

## Summary

Extract the reusable interactive CLI menu system from the AI Insights
workspace CLI (`scripts/cli.js`) into a standalone, zero-dependency
TypeScript npm library (`@mistralys/cli-menu`), then migrate AI Insights
to consume it. The library provides an interactive TUI menu engine,
setup wizard with checkbox selector, categorized command registry, help
generator, script runners, changelog utilities, and cross-platform
terminal management. Consumers provide configuration (commands, setup
components, banner) via a factory function; the library handles all
rendering, keypress routing, terminal state management, and process
lifecycle. AI Insights migration serves as the first real-world
validation.

## Architectural Context

### Source: AI Insights `scripts/cli.js`

A 1,209-line CJS file using only Node.js built-ins (`fs`, `path`,
`readline`, `child_process`, `os`). Contains two interleaved concerns:

1. **Infrastructure** (~600 lines) — ANSI colors, terminal state,
   keypress handling, menu rendering, checkbox TUI, help renderer,
   script runners, argument parser, `waitForKey`, screen clearing,
   version readers, changelog entry extractor.
2. **Configuration** (~600 lines) — Project-specific constants, command
   handlers, setup components, build logic, orchestrator support,
   persona sync, `.mcp.json` scaffolding.

The boundary is clean: infrastructure never references project-specific
paths or logic. The existing scaffold spec at
`docs/plans/2026-04-15-cli-menu-library/cli-menu-scaffold-spec.md`
documents the section-by-section architecture and serves as the
reference for extraction.

| Section (from scaffold spec) | Reusable? | Notes |
|------------------------------|-----------|-------|
| ANSI color helpers (`C`) | **Yes** | Generic utility |
| `log()` | **Yes** | Trivial wrapper over `C` |
| Pre-flight checks | **Partially** | Node version check is generic; workspace root check needs a user-supplied landmark |
| Version readers (`readVersion`, `readSubVersion`, `readPyprojectVersion`) | **Yes** | Renamed for clarity in the library |
| Changelog entry extractor | **Yes** | Useful for CI/CD release automation |
| Script runners (`runScript`, `runLongScript`, `sh`) | **Yes** | Core infrastructure |
| Setup wizard (components + checkbox TUI) | **Yes** | Parameterized by component array |
| Command registry schema + dispatch | **Yes** | The engine; commands themselves are project-specific |
| `printHelp()` | **Yes** | Driven by the command registry |
| `parseArgs()` | **Yes** | Trivial but important |
| `renderMenu()` + `showInteractiveMenu()` | **Yes** | Parameterized by banner, commands, version |
| `waitForKey()` | **Yes** | Generic utility |
| Terminal state management | **Yes** | Critical safety pattern |
| AI Insights commands, constants, banner | **No** | Stay in `scripts/cli.js` |
| `publish-locations.js` dependency | **No** | AI Insights–specific |
| `findPython`, `venvBin`, `scaffoldMcpJson` | **No** | AI Insights–specific |

### Reference: `@mistralys/persona-builder`

An existing sibling library in this workspace provides the proven
project scaffold:

- **Build:** tsup (dual CJS + ESM), TypeScript 5.8, target `node18`
- **Testing:** Vitest with v8 coverage, 80% thresholds
- **Package:** `"type": "module"`, exports map for subpath imports
- **Structure:** `src/` → `dist/`, `tests/` mirror, `fixtures/`

### Target Repository

Already initialized at `DEV/cli-menu` with MIT license, `.gitignore`,
and README stub. Added to the VS Code multi-root workspace.

## Approach / Architecture

### Layered Design

```
Consumer code (e.g. ai-insights scripts/cli.js)
    ↓ provides config objects
@mistralys/cli-menu
    ├── createMenu()           ← main entry point
    ├── Menu engine             (rendering, keypress dispatch, lifecycle)
    ├── Setup wizard            (checkbox TUI, component runner)
    ├── Help renderer           (helpVariants, interleaveAfter, hidden/helpHidden)
    ├── Script runners          (sync, long-running, shell)
    ├── Terminal utilities      (colors, rawMode, waitForKey, screen clear)
    ├── Changelog utilities     (version extraction, entry parsing) ← subpath export
    └── Types                   (MenuConfig, Command, SetupComponent, etc.)
```

### Consumer Usage

```ts
// Consumer example (scripts/cli.js in ai-insights)
import { createMenu } from '@mistralys/cli-menu';

const menu = createMenu({
  name: 'AI Insights CLI',
  banner: BANNER_LINES,
  version: () => readVersion(),
  categoryVersions: { 'MCP Server': () => readSubVersion(MCP_DIR) },
  commands: COMMANDS,
  setupComponents: SETUP_COMPONENTS,
  preflightChecks: [checkWorkspaceRoot],
  workspaceRoot: WORKSPACE_ROOT,
  scriptsDir: SCRIPTS_DIR,
});

menu.run(process.argv.slice(2));
```

### Module Structure

```
src/
├── index.ts                    # Public API re-exports (createMenu + utilities)
├── types.ts                    # CommandDef, SetupComponent, MenuConfig, etc.
├── cli.ts                      # createMenu() factory, entry point orchestration
├── parser.ts                   # parseArgs()
├── terminal/
│   ├── index.ts                # Barrel export
│   ├── colors.ts               # ANSI color helpers (C object) + log()
│   ├── raw-mode.ts             # enterRawMode(), exitRawMode(), restoreTerminal()
│   └── screen.ts               # clearScreen(), waitForKey()
├── runners/
│   ├── index.ts                # Barrel export + IS_WIN, NPM constants
│   ├── sync.ts                 # runScript() — blocking, exits on failure
│   ├── long-running.ts         # runLongScript() — async, SIGINT forwarding
│   └── shell.ts                # sh() — non-fatal, returns exit code
├── changelog/
│   ├── index.ts                # Barrel export (subpath entry point)
│   ├── version.ts              # readChangelogVersion()
│   ├── entry.ts                # extractChangelogEntry()
│   └── manifest.ts             # readPackageVersion(), readPyprojectVersion()
├── help.ts                     # printHelp() — respects hidden/helpHidden/variants
├── setup/
│   ├── index.ts                # Barrel export
│   ├── checkbox-menu.ts        # Interactive checkbox TUI
│   └── runner.ts               # runSetup() orchestrator
└── menu/
    ├── index.ts                # Barrel export
    ├── renderer.ts             # renderMenu() — banner, categories, footer
    └── interactive.ts          # showInteractiveMenu() — keypress loop
```

### Subpath Exports

| Import Path | Contents |
|-------------|----------|
| `@mistralys/cli-menu` | `createMenu()`, all types, terminal utilities, runners, help, menu, setup, parser |
| `@mistralys/cli-menu/changelog` | `readChangelogVersion()`, `extractChangelogEntry()`, `readPackageVersion()`, `readPyprojectVersion()`, `ChangelogEntry` type |

Changelog utilities are orthogonal to the menu engine. A separate
subpath export avoids pulling in menu code when only version extraction
is needed (e.g. CI scripts).

### Target Package

| Property | Value |
|----------|-------|
| Package name | `@mistralys/cli-menu` |
| Language | TypeScript 5.8+ (ES2022) |
| Module format | Dual CJS + ESM (via tsup) |
| Runtime | Node.js ≥ 18 |
| Dependencies | Zero runtime dependencies |
| Build tool | tsup |
| Test framework | Vitest (v8 coverage, 80% thresholds) |
| License | MIT |

## Rationale

- **Library over scaffold.** The scaffold spec describes how to
  copy-paste a CLI into a new project. A library goes further: bug
  fixes and features flow to all consumers via `npm update`. The
  scaffold spec remains as the architectural reference document.
- **TypeScript with dual output.** Types provide a self-documenting API
  and make command registration type-safe. The dual CJS + ESM build
  (proven in `@mistralys/persona-builder`) ensures `require()` works
  for CJS consumers like the current AI Insights `cli.js`.
- **`createMenu()` factory over subclassing.** Keeps the API surface
  minimal. No need to `extends` anything — pass a config object.
  Matches the library name.
- **Zero runtime dependencies.** Mirrors the source CLI's zero-dep
  design, keeping the library universally adoptable.
- **Separate changelog subpath.** Changelog parsing is independently
  useful for CI/release scripts. Separate export avoids unnecessary
  menu engine imports.
- **Consumer-owned pre-flight checks.** The library calls consumer-
  provided check functions but doesn't call `process.exit()` directly.
  Consumers control exit behavior.

## Detailed Steps

### Phase 1 — Library Scaffolding

1. **Initialize the npm package.**
   - `npm init` with `name: @mistralys/cli-menu`, `type: module`.
   - Add `tsup`, `typescript`, `vitest`, `@vitest/coverage-v8`,
     `@types/node` as dev deps.
   - Create `tsconfig.json` matching persona-builder conventions
     (target ES2022, module ESNext, moduleResolution bundler, strict).
   - Create `tsup.config.ts` with three entry points:
     `index` (`src/index.ts`), `changelog` (`src/changelog/index.ts`),
     `cli` (placeholder for future direct CLI). Format `['cjs', 'esm']`,
     dts, sourcemap, target `node18`.
   - Configure `package.json` exports map for both subpaths
     (`.` → `dist/index`, `./changelog` → `dist/changelog/index`),
     `files: ["dist"]`, `engines: { node: ">=18.0.0" }`.
   - Create `vitest.config.ts` with v8 coverage at 80% thresholds,
     excluding `src/cli.ts` and `*.d.ts`.
   - Add npm scripts: `build`, `dev`, `test`, `test:watch`, `typecheck`.
   - Create directory structure: `src/`, `tests/`, `fixtures/`,
     `templates/`.

### Phase 2 — Type Definitions

2. **Create `src/types.ts`** — all public interfaces:
   - `MenuConfig` — top-level configuration for `createMenu()`:
     `name`, `banner` (string[]), `version` (string | `() => string`),
     `commands` (Command[]), `setupComponents?` (SetupComponent[]),
     `preflightChecks?` (PreflightCheck[]),
     `categoryVersions?` (Record<string, () => string>),
     `workspaceRoot`, `scriptsDir`.
   - `Command` — matches the scaffold spec §12.2: `id`, `key`
     (string | null), `label`, `category`, `description`,
     `run` ((args: string[]) => void | Promise<void>),
     `hidden?`, `helpHidden?`, `helpVariants?` (HelpVariant[]),
     `interleaveAfter?` (InterleavePosition).
   - `HelpVariant` — tuple `[command: string, description: string]`.
   - `InterleavePosition` — `{ command: string; variant: number }`.
   - `SetupComponent` — `id`, `label`, `desc`,
     `detect` (() => boolean), `run` ((args: string[]) => boolean),
     `validate` (() => boolean).
   - `PreflightCheck` — `() => void` (throws or calls
     `process.exit()` on failure).
   - `ScriptRunnerOptions` — options for `sh()`.
   - `ChangelogEntry` — `{ version: string; title: string;
     body: string }`.

### Phase 3 — Terminal Utilities

3. **Create `src/terminal/colors.ts`** — the `C` color helper object
   (matching scaffold spec §6) and `log(msg, color?)` function.
   Export `Colors` type for the color name union.
4. **Create `src/terminal/raw-mode.ts`** — `enterRawMode()`,
   `exitRawMode()`, `restoreTerminal()`, `isRawModeSupported()`.
   Wrap `setRawMode` in try/catch. Guarantee restoration on all exit
   paths (scaffold spec §14.6).
5. **Create `src/terminal/screen.ts`** — `clearScreen()` via
   `\x1b[2J\x1b[0;0H`, `waitForKey()` (scaffold spec §14.5).
6. **Create `src/terminal/index.ts`** — barrel export.

### Phase 4 — Script Runners

7. **Create `src/runners/sync.ts`** — `runScript(scriptPath, args,
   options)`: synchronous spawn, exits on failure (scaffold spec §10.1).
   Accept `workspaceRoot` and `scriptsDir` as parameters instead of
   reading module-level constants.
8. **Create `src/runners/long-running.ts`** — `runLongScript(scriptPath,
   args, options)`: async spawn with SIGINT forwarding (scaffold spec
   §10.2).
9. **Create `src/runners/shell.ts`** — `sh(cmd, args, options)`:
   non-fatal spawn returning exit code. Default `shell: true` on
   Windows via `IS_WIN` (scaffold spec §10.3).
10. **Create `src/runners/index.ts`** — barrel export + `IS_WIN` and
    `NPM` constants.

### Phase 5 — Changelog Utilities

11. **Create `src/changelog/version.ts`** —
    `readChangelogVersion(filePath)`: extract topmost version from a
    changelog file. Handles both `## v1.2.3` and `## [1.2.3]` heading
    formats (scaffold spec §9).
12. **Create `src/changelog/entry.ts`** —
    `extractChangelogEntry(filePath)`: parse topmost entry returning
    `ChangelogEntry` with version, title, and body. Uses the header
    regex from scaffold spec §17.4. Stops at next `##` heading.
    Handles CRLF.
13. **Create `src/changelog/manifest.ts`** —
    `readPackageVersion(dir)`: read version from `package.json`.
    `readPyprojectVersion(dir)`: read version from `pyproject.toml`.
14. **Create `src/changelog/index.ts`** — barrel export for the
    `@mistralys/cli-menu/changelog` subpath.

### Phase 6 — Help Renderer

15. **Create `src/help.ts`** — `printHelp(commands, config)`: renders
    help output respecting `helpHidden`, `helpVariants`,
    `interleaveAfter`. Formats: command name left-padded 2 spaces,
    padded to 28 characters, description in dim color. `help` always
    appended as last entry (scaffold spec §13).

### Phase 7 — Argument Parser

16. **Create `src/parser.ts`** — `parseArgs(argv)`: returns
    `{ command: string | null; flags: string[] }`. First non-flag
    argument is the command, rest are flags (scaffold spec §15).

### Phase 8 — Setup Wizard

17. **Create `src/setup/checkbox-menu.ts`** — `runCheckboxMenu(
    components)`: interactive TUI checkbox selector
    (scaffold spec §11.2). Uses `setRawMode(true)` for single-keypress
    input. Supports ↑/↓, j/k, Space, `a` (toggle all), Enter
    (run selected), `q` (cancel). Returns `Promise<string[] | null>`
    (selected IDs or null on cancel). Shows `(done)` for pre-detected
    components.
18. **Create `src/setup/runner.ts`** — `runSetup(components, args)`:
    orchestrates component execution with `--all` / `--components` /
    interactive selection. Non-TTY detection: requires `--all` or
    `--components` if `!process.stdin.isTTY` (scaffold spec §11.3).
    Prints summary table with success/failure counts (scaffold spec
    §11.4). Exits with code 1 if any component failed.
19. **Create `src/setup/index.ts`** — barrel export.

### Phase 9 — Interactive Menu Engine

20. **Create `src/menu/renderer.ts`** — `renderMenu(config)`: clears
    screen, draws banner in cyan, version in dim, category headers
    (bold, with optional sub-project versions), commands with hotkeys,
    `[h] Help [q] Quit` footer, `Choose:` prompt (scaffold spec §14.2).
21. **Create `src/menu/interactive.ts`** — `showInteractiveMenu(config)`:
    keypress loop via `readline.emitKeypressEvents`. Dispatches
    hotkeys to command handlers. Distinguishes long-running commands
    (take over the process) from blocking commands (`waitForKey` after
    completion, then re-render). Restores terminal state before
    running any command (scaffold spec §14.4).
22. **Create `src/menu/index.ts`** — barrel export.

### Phase 10 — Main Entry Point

23. **Create `src/cli.ts`** — `createMenu(config)`: returns
    `{ run(argv: string[]): Promise<void> }`. Wires pre-flight checks,
    argument parsing, `help` dispatch, direct CLI command dispatch,
    and interactive menu fallback (scaffold spec §16). Non-TTY
    detection for interactive mode.
24. **Create `src/index.ts`** — re-export `createMenu`, all types, and
    individual utilities (colors, log, runners, changelog, parser,
    help, setup, menu) for consumers who want granular access.

### Phase 11 — Launcher Templates

25. **Create `templates/menu.sh` and `templates/menu.cmd`** — thin
    launcher scripts (scaffold spec §3.1) that consumers can copy
    into their project root. Document in README.

### Phase 12 — Pre-flight Check Utility

26. **Create `src/preflight.ts`** — `checkNodeVersion(minMajor?)`:
    built-in pre-flight check for minimum Node.js version (scaffold
    spec §8). Consumers can use this directly or provide custom checks.

### Phase 13 — Tests

27. **`tests/terminal/colors.test.ts`** — verify ANSI escape sequences,
    composition (`bold(cyan('text'))`), `log()` output.
28. **`tests/parser.test.ts`** — no args, flags only, command + flags,
    command with dashes, empty argv.
29. **`tests/changelog/version.test.ts`** — `## v1.2.3` format,
    `## [1.2.3]` format, missing file, empty file, no version heading.
30. **`tests/changelog/entry.test.ts`** — full entry extraction,
    multi-line body, stops at next `##`, CRLF handling.
31. **`tests/changelog/manifest.test.ts`** — valid `package.json`,
    valid `pyproject.toml`, missing files, malformed JSON.
32. **`tests/help.test.ts`** — category grouping, hidden commands
    excluded, helpVariants rendered, interleaveAfter positioning,
    `help` always appended.
33. **`tests/setup/runner.test.ts`** — `--all` selects all,
    `--components a,b` selects subset, summary counts, exit code on
    failure.
34. **`tests/menu/renderer.test.ts`** — output contains banner,
    version, category headers, command labels with keys, footer.
35. **`tests/integration.test.ts`** — `createMenu()` with minimal
    config, verify `run(['help'])` produces expected output;
    `run(['some-command'])` dispatches correctly.
36. **Create `fixtures/`** — sample changelog files (various formats),
    sample `package.json`, sample `pyproject.toml` for test data.

### Phase 14 — Build Verification

37. **Verify `npm run build`** produces correct dual output in `dist/`.
38. **Verify subpath exports** work: `require('@mistralys/cli-menu')`
    and `require('@mistralys/cli-menu/changelog')` with both
    `require()` and `import`.
39. **Verify TypeScript declarations** are emitted (`.d.ts` files).
40. **Verify `npm test`** passes with coverage thresholds met.

### Phase 15 — Documentation

41. **Write `README.md`** — installation, quick start, API overview,
    configuration reference, migration guide from the scaffold spec.
42. **Write `docs/configuration.md`** — detailed `MenuConfig`,
    `Command`, and `SetupComponent` schemas with examples.
43. **Write `docs/changelog-utilities.md`** — standalone usage of the
    changelog subpath.

### Phase 16 — Migrate AI Insights CLI

44. **Install `@mistralys/cli-menu`** in AI Insights root
    `package.json` via local file reference during development:
    `"@mistralys/cli-menu": "file:../cli-menu"`.
45. **Refactor `scripts/cli.js`.**
    - Remove all infrastructure sections: colors, log, runners, setup
      engine, menu engine, help, args, terminal management, version
      readers, preflight Node check, waitForKey.
    - Import `createMenu` and utilities from `@mistralys/cli-menu`.
    - Import changelog utilities from `@mistralys/cli-menu/changelog`.
    - Keep only:
      - AI Insights constants (`WORKSPACE_ROOT`, `MCP_SERVER_DIR`, etc.)
      - AI Insights–specific helpers (`findPython`,
        `syncOrchestratorVersion`, `venvBin`, `scaffoldMcpJson`,
        `askCleanInput`).
      - `SETUP_COMPONENTS` array (AI Insights–specific components).
      - `COMMANDS` array (AI Insights–specific commands).
      - `BANNER_LINES`.
      - Command handler functions (`cmdSyncPersonas`, `cmdBuildMaintain`,
        etc.).
      - The `require('./publish-locations')` dependency.
    - Call `createMenu({ ... }).run(process.argv.slice(2))` at the
      bottom.
46. **Verify the migration.**
    - `node scripts/cli.js` → interactive menu renders identically.
    - `node scripts/cli.js help` → help output matches.
    - `node scripts/cli.js setup` → wizard works.
    - `node scripts/cli.js setup --all` → non-interactive setup.
    - Test each command via direct CLI dispatch.
    - `menu.sh` and `menu.cmd` launchers continue to work.
    - Verify no Windows-breaking changes (code review of `IS_WIN`
      gates).
47. **Update AI Insights documentation.**
    - Update root `README.md` if it references CLI internal structure.
    - No manifest updates needed — the CLI is a root-level script,
      not an MCP server or persona system component.

### Phase 17 — Agent Documentation

48. **Create `AGENTS.md`** for the cli-menu repo following the
    persona-builder pattern.
49. **Create `docs/agents/project-manifest/`** with README.md,
    tech-stack.md, constraints.md, file-tree.md, api-surface.md,
    data-flows.md.

### Phase 18 — CI & Publish

50. **Set up CI** (GitHub Actions in cli-menu repo). Lint, typecheck,
    test, build on Node 18 + 22, on ubuntu + windows.
51. **Publish to npm** as `@mistralys/cli-menu`. Switch AI Insights
    from `file:` dependency to registry version.

## Dependencies

- Node.js ≥ 18 (runtime)
- `tsup` ≥ 8 (build, dev dependency)
- `typescript` ≥ 5.8 (dev dependency)
- `vitest` ≥ 4 (test, dev dependency)
- `@vitest/coverage-v8` (test, dev dependency)
- `@types/node` (dev dependency)
- Zero production dependencies

## Required Components

### New Files (cli-menu repo)

**Configuration:**
- `package.json`
- `tsconfig.json`
- `tsup.config.ts`
- `vitest.config.ts`

**Source (17 modules):**
- `src/index.ts` — public API
- `src/types.ts` — type definitions
- `src/cli.ts` — `createMenu()` factory
- `src/parser.ts` — argument parser
- `src/preflight.ts` — Node version check
- `src/help.ts` — help output renderer
- `src/terminal/index.ts`, `colors.ts`, `raw-mode.ts`, `screen.ts`
- `src/runners/index.ts`, `sync.ts`, `long-running.ts`, `shell.ts`
- `src/changelog/index.ts`, `version.ts`, `entry.ts`, `manifest.ts`
- `src/setup/index.ts`, `checkbox-menu.ts`, `runner.ts`
- `src/menu/index.ts`, `renderer.ts`, `interactive.ts`

**Tests (10 suites):**
- `tests/terminal/colors.test.ts`
- `tests/parser.test.ts`
- `tests/changelog/version.test.ts`
- `tests/changelog/entry.test.ts`
- `tests/changelog/manifest.test.ts`
- `tests/help.test.ts`
- `tests/setup/runner.test.ts`
- `tests/menu/renderer.test.ts`
- `tests/integration.test.ts`

**Fixtures:**
- `fixtures/` — sample changelogs, package.json, pyproject.toml

**Templates:**
- `templates/menu.sh` — bash launcher
- `templates/menu.cmd` — Windows batch launcher

**Docs:**
- `README.md`
- `docs/configuration.md`
- `docs/changelog-utilities.md`
- `AGENTS.md`
- `docs/agents/project-manifest/` (6 manifest files)

### Modified Files (ai-insights repo, Phase 16)

- `package.json` — add `@mistralys/cli-menu` dependency
- `scripts/cli.js` — refactor to consume library

## Assumptions

- The library is TypeScript but AI Insights will continue to consume
  it from CJS via `require()` (the tsup dual build handles this).
- The `@mistralys` npm scope is already configured for publishing.
- The scaffold spec document remains as-is — it serves as the
  architectural reference. The library is the reusable implementation
  of that spec.
- AI Insights `scripts/cli.js` remains a single file (CJS) — the
  migration swaps out infrastructure for library imports but does not
  restructure the file into modules.
- The interactive checkbox menu sends output to stdout and reads
  keypresses from stdin directly. It does not abstract I/O streams.

## Constraints

- **Zero runtime dependencies.** The library uses only Node.js
  built-ins (`fs`, `path`, `readline`, `child_process`, `os`).
- **Cross-platform.** Windows, macOS, Linux. All path operations via
  `path.join()`, Windows `.cmd` spawn handling via `IS_WIN` gate.
- **CJS consumer compatibility.** The tsup dual build must produce
  working CJS output. Verify with
  `node -e "require('@mistralys/cli-menu')"`.
- **No breaking changes to AI Insights CLI UX.** Interactive menu,
  help output, and direct CLI dispatch must behave identically
  before and after migration.
- **TypeScript strict mode.** `strict: true` in `tsconfig.json`.
- **No terminal state corruption.** Every code path that enters raw
  mode must guarantee restoration. The library handles this
  internally — consumers never manage raw mode.

## Out of Scope

- CLI theming or color customization beyond the existing ANSI palette.
- Plugin system for commands (commands are passed as a plain array).
- Built-in argument parsing for individual commands (e.g.,
  yargs-style). Each command's `run(args)` receives the raw flags
  array.
- Rewriting AI Insights `scripts/cli.js` to TypeScript or ESM — it
  remains CJS.
- Interactive prompts beyond the setup wizard checkbox menu (e.g.,
  text input, confirmation dialogs). The `askCleanInput` helper in
  AI Insights is project-specific and stays there.
- Configuration file loading. Consumers pass configuration
  programmatically.
- Internationalization. All strings are English. Consumers who need
  i18n provide translated labels in their command definitions.
- GUI or web interface. This is a terminal-only library.
- Publishing to npm during the initial implementation (Phase 18 is a
  follow-up).

## Acceptance Criteria

- `npm run build` produces `dist/index.js`, `dist/index.cjs`,
  `dist/changelog/index.js`, `dist/changelog/index.cjs` with
  corresponding `.d.ts` files.
- `require('@mistralys/cli-menu')` and
  `import from '@mistralys/cli-menu'` both resolve correctly.
- `require('@mistralys/cli-menu/changelog')` and
  `import from '@mistralys/cli-menu/changelog'` both resolve.
- `createMenu(config).run([])` launches an interactive menu when stdin
  is a TTY.
- `createMenu(config).run(['help'])` prints help and exits.
- `createMenu(config).run(['some-command'])` dispatches to the
  correct handler.
- `createMenu(config).run(['setup', '--all'])` runs all setup
  components non-interactively.
- The setup wizard's checkbox TUI works with keyboard navigation
  (↑/↓, j/k, space, a, enter, q).
- Help output correctly handles `hidden`, `helpHidden`,
  `helpVariants`, and `interleaveAfter`.
- `readChangelogVersion()` parses both `## v1.2.3` and `## [1.2.3]`
  heading formats.
- `extractChangelogEntry()` returns version, title, and body from the
  topmost entry.
- All tests pass (`npm test`) with 80% coverage thresholds met.
- AI Insights `node scripts/cli.js` launches the interactive menu
  with the same visual output as before.
- AI Insights `node scripts/cli.js help` produces the same help text.
- AI Insights `node scripts/cli.js setup` runs the checkbox wizard.
- AI Insights `node scripts/cli.js <command>` dispatches correctly
  for every registered command.
- `menu.sh` and `menu.cmd` launchers continue to work.

## Testing Strategy

### Automated Tests (cli-menu)

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
  helpVariants rendered, interleaveAfter positioning, `help` always
  appended.
- **Setup runner:** `--all` selects all, `--components a,b` selects
  subset, summary counts, exit code on failure.
- **Menu renderer:** Output contains banner lines, version string,
  category headers, command labels with keys.
- **Integration:** `createMenu()` with minimal config, verify direct
  CLI dispatch resolves the correct command.

### Manual Tests

- **Interactive menu:** Verify rendering, hotkey dispatch, screen
  clearing, `waitForKey` cycle.
- **Checkbox TUI:** Keyboard navigation, toggle, toggle-all, enter,
  quit.
- **Long-running commands:** SIGINT forwarding, process exit
  propagation.
- **Cross-platform:** Verify on macOS (primary), Windows via CI.

### Migration Validation (ai-insights)

- Full manual walkthrough: interactive menu, help, setup wizard,
  each command, launcher scripts.
- Existing AI Insights test suite (`npm test`) must continue to
  pass — the CLI refactor does not touch tested code paths.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **CJS `require()` fails for the TS library** | tsup dual build (CJS + ESM) is proven in persona-builder. Verify with `node -e "require('@mistralys/cli-menu')"` before migrating. |
| **Terminal state corruption if library throws** | The `restoreTerminal()` safety pattern from scaffold spec §14.6 is preserved. All keypress handlers wrapped in try/catch. |
| **`process.stdin.setRawMode` differs across Node versions** | Test on Node 18 and 22. Existing code handles this with try/catch. |
| **Setup wizard `detect()`/`run()` scope mismatch** | Components reference project paths — they stay in the consumer, not the library. Library only provides the TUI engine. |
| **Windows shell spawning regression** | The `IS_WIN` → `shell: true` default from scaffold spec §10.3 is preserved in `sh()`. Test with `npm.cmd` on Windows CI. |
| **Breaking the AI Insights CLI during migration** | Incremental migration: extract one section at a time, verify after each step. Keep original `cli.js` in Git history for easy revert. |
| **Pre-flight check `process.exit()` semantics** | Pre-flight checks are consumer-provided functions. The library calls them; consumers decide exit behavior. Library never calls `process.exit()` itself. |
| **Scope creep into project-specific features** | Hard rule: the library provides menu infrastructure only. All project-specific logic stays in the consumer. |
