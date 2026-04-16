# Plan — Phase C: AI Insights Migration + CI

## Summary

Install the completed `@mistralys/cli-menu` library in the AI Insights
workspace, refactor `scripts/cli.js` to consume it (replacing ~600
lines of infrastructure code with library imports), verify the
migration produces identical CLI behavior, set up CI for the cli-menu
repo, and publish to npm.

**Prerequisite:** Phases A and B must be complete — the library must
be fully functional, tested, and documented before migration begins.

**Deliverable:** AI Insights CLI running on `@mistralys/cli-menu`,
ci-menu repo with CI pipeline, package published on npm.

## Architectural Context

### Current State: AI Insights `scripts/cli.js`

A 1,209-line CJS file containing two interleaved concerns:

1. **Infrastructure** (~600 lines) — ANSI colors, terminal state,
   keypress handling, menu rendering, checkbox TUI, help renderer,
   script runners, argument parser, `waitForKey`, screen clearing,
   version readers, changelog entry extractor.
2. **Configuration** (~600 lines) — Project-specific constants,
   command handlers, setup components, build logic, orchestrator
   support, persona sync, `.mcp.json` scaffolding.

After migration, only the **Configuration** section remains. All
infrastructure is replaced by `@mistralys/cli-menu` imports.

### Target State: Refactored `scripts/cli.js`

```
scripts/cli.js (~600 lines)
├── Imports from @mistralys/cli-menu
├── Imports from @mistralys/cli-menu/changelog
├── require('./publish-locations')
├── AI Insights constants (WORKSPACE_ROOT, MCP_SERVER_DIR, etc.)
├── AI Insights helpers (findPython, venvBin, scaffoldMcpJson, etc.)
├── SETUP_COMPONENTS array
├── COMMANDS array
├── Command handler functions
├── BANNER_LINES
└── createMenu({ ... }).run(process.argv.slice(2))
      .then(code => process.exit(code))
```

### What Gets Removed

All infrastructure sections (from scaffold spec mapping):

| Section | Replaces With |
|---------|---------------|
| `C` (ANSI colors) | `import { C } from '@mistralys/cli-menu'` |
| `log()` | `import { log } from '@mistralys/cli-menu'` |
| `checkNodeVersion()` | `import { checkNodeVersion } from '@mistralys/cli-menu'` |
| `readVersion()` | `import { readChangelogVersion } from '@mistralys/cli-menu/changelog'` |
| `readSubVersion()` | `import { readPackageVersion } from '@mistralys/cli-menu/changelog'` |
| `readPyprojectVersion()` | `import { readPyprojectVersion } from '@mistralys/cli-menu/changelog'` |
| `runScript()` | `import { runScript } from '@mistralys/cli-menu'` |
| `runLongScript()` | `import { runLongScript } from '@mistralys/cli-menu'` |
| `sh()` | `import { sh } from '@mistralys/cli-menu'` |
| `IS_WIN`, `NPM` | `import { IS_WIN, NPM } from '@mistralys/cli-menu'` |
| `parseArgs()` | Handled internally by `createMenu().run()` |
| `printHelp()` | Handled internally by `createMenu().run()` |
| `renderMenu()` | Handled internally by `createMenu().run()` |
| `showInteractiveMenu()` | Handled internally by `createMenu().run()` |
| `waitForKey()` | Handled internally by library |
| `restoreTerminal()` | Handled internally by library |
| Setup wizard engine | Handled internally by library |
| Checkbox TUI | Handled internally by library |
| `main()` entry point | Replaced by `createMenu().run()` |

### What Stays

| Component | Reason |
|-----------|--------|
| `WORKSPACE_ROOT`, `SCRIPTS_DIR`, `MCP_SERVER_DIR`, etc. | Project-specific paths |
| `findPython()` | Project-specific Python discovery |
| `syncOrchestratorVersion()` | Project-specific version sync |
| `venvBin()` | Project-specific venv path helper |
| `scaffoldMcpJson()` | Project-specific config scaffolding |
| `askCleanInput()` | Project-specific readline prompt |
| `cmdCleanAgents()` | Project-specific clean command |
| `getPublishLocations` / `publish-locations.js` | Project-specific publish registry |
| `SETUP_COMPONENTS` array | Project-specific component definitions |
| `COMMANDS` array | Project-specific command definitions |
| `BANNER_LINES` | Project-specific ASCII banner |
| All `cmd*()` handler functions | Project-specific command implementations |

## Approach / Architecture

### Migration Strategy: Big-Bang with Safety Net

The infrastructure and configuration sections are cleanly separated
in the source file. The migration removes all infrastructure in one
refactor, replacing it with library imports. This is lower risk than
incremental migration because:

1. The library's API mirrors the source exactly (by design).
2. The original `cli.js` is preserved in Git history for comparison.
3. Every command can be tested immediately after the refactor.

### CJS Consumption

AI Insights `scripts/cli.js` remains CJS. The tsup dual build
(verified in Phases A/B) provides CJS output:

```js
const { createMenu, C, log, IS_WIN, NPM, sh, runScript,
        runLongScript, checkNodeVersion } = require('@mistralys/cli-menu');
const { readChangelogVersion, readPackageVersion,
        readPyprojectVersion } = require('@mistralys/cli-menu/changelog');
```

## Rationale

- **Migration validates the library.** Using AI Insights as the first
  consumer proves the API works for a real-world, complex CLI with
  20+ commands, 5 setup components, and multiple sub-project version
  displays.
- **CI after migration.** Setting up CI after the library has been
  validated by migration ensures the test suite reflects real usage
  patterns.
- **npm publish last.** Publishing only after everything is validated
  avoids shipping a broken v1.

## Detailed Steps

### Step 0 — Pre-Publish Library Hardening

The Phase B synthesis identified open items that should be resolved
in the cli-menu repo before the library is published to npm.

#### 0a. Code Hardening

1. **Add try/catch around `cmd.run([])` in `showInteractiveMenu()`.**
   Currently a thrown exception propagates out of the interactive
   loop unconditionally. The terminal is restored via `finally`,
   but the loop exits and the error surfaces unhandled. Wrap the
   `cmd.run([])` call in a try/catch that prints the error
   (via `log()`) and continues the loop instead of exiting.
2. **Standardize `Object.defineProperty` isTTY save/restore in
   tests.** `runner.test.ts` correctly saves and restores
   `isTTY` via try/finally, but `screen.test.ts`,
   `create-menu.test.ts`, and `interactive.test.ts` set `isTTY`
   per-test without restoring. Add a `beforeEach`/`afterEach`
   pattern (or per-test try/finally like `runner.test.ts`) to
   all test files that mutate `isTTY`, preventing latent
   order-dependence.

#### 0b. Documentation

3. **Document the empty-args contract.** In interactive mode,
   `showInteractiveMenu()` calls `cmd.run([])` with an empty args
   array. Any command that depends on receiving CLI flags will
   not see them. Document this in three places:
   - `Command.run` property JSDoc in `src/types.ts`.
   - `showInteractiveMenu()` JSDoc in `src/menu/interactive.ts`.
   - `api-surface.md` `Command` type section.
4. **Enhance `waitForKeypress()` JSDoc.** The existing JSDoc
   documents self-unregistration of the keypress listener, but
   does not explain *why* the SIGINT handler must self-unregister
   *before* calling `restoreTerminal()`. Add a brief note
   referencing constraints.md §6.
5. **Add cross-platform path hygiene rule to `constraints.md`.**
   Multiple test helpers hardcode Unix paths (`/tmp/test`,
   `/tmp/integration`). Add a constraint requiring `os.tmpdir()`
   from `'node:os'` instead of hardcoded Unix paths in test
   fixtures, matching the cross-platform policy.
6. **Add cross-link from `docs/configuration.md` to README.**
   The configuration reference is self-contained with no
   navigation back to the API overview in the README.

### Step 1 — Install the Library

1. **Install `@mistralys/cli-menu`** in AI Insights root
   `package.json` via local file reference during development:
   `"@mistralys/cli-menu": "file:../cli-menu"`.
   **Alternative: `npm link`.** Run `npm link` in the cli-menu repo,
   then `npm link @mistralys/cli-menu` in the AI Insights root.
   This creates a global symlink without editing `package.json`.
   Neither approach requires the package to be published to npm —
   they work with any local clone that has been built (`dist/`
   must exist). Choose whichever is more convenient; both create
   symlinks with npm v7+, so live rebuilds of cli-menu are
   reflected immediately in AI Insights.
2. **Verify import resolves:** Run
   `node -e "console.log(Object.keys(require('@mistralys/cli-menu')))"`.    
3. **Verify with `npm pack`** before relying on the `file:` reference
   for full migration testing. Run `npm pack` in the cli-menu repo,
   then `npm install ./mistralys-cli-menu-1.0.0.tgz` in AI Insights.
   This catches subpath export resolution issues that `file:`
   references silently hide (e.g., missing `exports` map entries,
   incorrect `dist/` paths). Once verified, switch back to `file:`
   or `npm link` for development convenience.

### Step 2 — Refactor `scripts/cli.js`

3. **Refactor `scripts/cli.js`.**
   - Remove all infrastructure sections: ANSI colors (`C` object),
     `log()`, script runners (`runScript`, `runLongScript`, `sh`),
     setup wizard engine (checkbox TUI + runner), menu engine
     (renderer + interactive), help renderer (`printHelp`), argument
     parser (`parseArgs`), terminal management (`restoreTerminal`,
     `waitForKey`, raw mode), version readers (`readVersion`,
     `readSubVersion`, `readPyprojectVersion`), pre-flight Node
     version check, `IS_WIN`, `NPM` constants, `main()` entry point.
   - Add `require()` imports from `@mistralys/cli-menu` and
     `@mistralys/cli-menu/changelog` at the top of the file.
   - Keep only:
     - AI Insights constants (`WORKSPACE_ROOT`, `MCP_SERVER_DIR`,
       `PERSONAS_DIR`, `ORCHESTRATOR_DIR`, `CHANGELOG_FILE`,
       `MCP_DIST_JSON`, `MCP_JSON`).
     - AI Insights–specific helpers (`findPython`,
       `syncOrchestratorVersion`, `venvBin`, `scaffoldMcpJson`,
       `askCleanInput`).
     - `SETUP_COMPONENTS` array (AI Insights–specific components).
     - `COMMANDS` array (AI Insights–specific commands).
     - `BANNER_LINES`.
     - Command handler functions (`cmdSyncPersonas`,
       `cmdBuildMaintain`, `cmdCleanAgents`, `cmdCtxGenerate`,
       `cmdMcpJson`, `cmdGitHooks`, `cmdReadLog`,
       `cmdKillOrchestrator`, etc.).
     - The `require('./publish-locations')` dependency
       (`getPublishLocations`).
   - Replace the `main()` entry point with:
     ```js
     createMenu({
       name: 'AI Insights CLI',
       banner: BANNER_LINES,
       version: () => readChangelogVersion(CHANGELOG_FILE),
       categoryVersions: {
         'MCP Server':   () => readPackageVersion(MCP_SERVER_DIR),
         'Personas':     () => readPackageVersion(PERSONAS_DIR),
         'Orchestrator':  () => readPyprojectVersion(ORCHESTRATOR_DIR),
       },
       commands: COMMANDS,
       setupComponents: SETUP_COMPONENTS,
       preflightChecks: [checkWorkspaceRoot],
       workspaceRoot: WORKSPACE_ROOT,
     }).run(process.argv.slice(2))
       .then((code) => process.exit(code))
       .catch((err) => { console.error(err); process.exit(1); });
     ```
   - Update `checkWorkspaceRoot()` to throw `PreflightError` instead
     of calling `process.exit(1)`.
   - Update `SETUP_COMPONENTS` entries: the `run()` functions that
     use `sh()`, `NPM`, `IS_WIN` now import these from the library.
   - Update command handlers that use `runScript()`,
     `runLongScript()`, `sh()`, `log()`, `C` to use library imports.
     **Note:** `runLongScript()` now returns
     `{ child: ChildProcess; exitCode: Promise<number> }` instead of
     calling `process.exit()`. Command handlers that previously used
     `runLongScript()` to delegate to long-running scripts (GUI,
     orchestrator) must be updated to await `exitCode` and return
     the resolved code. The `createMenu()` pipeline handles this
     internally when commands return promises.

### Step 3 — Verify the Migration

4. **Verify the migration.**
   - `node scripts/cli.js` → interactive menu renders identically.
   - `node scripts/cli.js help` → help output matches the original.
   - `node scripts/cli.js setup` → wizard works (checkbox TUI).
   - `node scripts/cli.js setup --all` → non-interactive setup.
   - Test each registered command via direct CLI dispatch.
   - `menu.sh` and `menu.cmd` launchers continue to work.
   - Verify no Windows-breaking changes (code review of `IS_WIN`
     gates).
5. **Run existing AI Insights test suite** (`npm test`) to verify
   the CLI refactor does not break tested code paths.

### Step 4 — Update AI Insights Documentation

6. **Update root `README.md`** if it references CLI internal structure
   or lists the CLI as a single-file script.
7. **Update `package.json`** — verify the `@mistralys/cli-menu`
   dependency is listed.
8. No manifest updates needed — the CLI is a root-level script,
   not an MCP server or persona system component.

### Step 5 — Set Up CI

9. **Set up CI** (GitHub Actions in cli-menu repo):
   - Matrix: Node 18 + 22, on ubuntu + windows.
   - Steps: install, typecheck, test (with coverage), build.
   - Verify dual output (CJS + ESM) in CI artifact.

### Step 6 — Publish to npm

10. **Publish to npm** as `@mistralys/cli-menu`.
11. **Switch AI Insights** from `file:` dependency to registry
    version: replace `"file:../cli-menu"` with `"^1.0.0"` (or
    whatever version was published).
12. **Verify** everything still works after switching to the registry
    package.

## Required Components

### Modified Files (cli-menu repo — Step 0)

- `src/menu/interactive.ts` — try/catch around `cmd.run([])`
- `src/types.ts` — JSDoc on `Command.run` (empty-args contract)
- `src/menu/interactive.ts` — JSDoc updates (empty-args,
  waitForKeypress rationale)
- `docs/agents/project-manifest/api-surface.md` — empty-args
  contract
- `docs/agents/project-manifest/constraints.md` — path hygiene
  rule
- `docs/configuration.md` — cross-link to README
- `tests/screen.test.ts`, `tests/create-menu.test.ts`,
  `tests/menu/interactive.test.ts` — isTTY save/restore pattern

### Modified Files (ai-insights repo)

- `package.json` — add `@mistralys/cli-menu` dependency
- `scripts/cli.js` — refactor to consume library

### New Files (cli-menu repo)

- `.github/workflows/ci.yml` — GitHub Actions CI pipeline

## Assumptions

- Phases A and B are complete; all cli-menu tests pass.
- The library's CJS output works with `require()` (verified in
  Phase A/B build verification steps).
- The `@mistralys` npm scope is configured for publishing.
- AI Insights `scripts/cli.js` remains CJS — no module format change.

## Constraints

- **No breaking changes to AI Insights CLI UX.** Interactive menu,
  help output, and direct CLI dispatch must behave identically
  before and after migration.
- **CJS consumer compatibility.** AI Insights uses `require()`.
- **Cross-platform.** Migration must not break Windows compatibility.
- **Git history preserved.** The original `cli.js` stays in Git
  history for easy revert if needed.

## Out of Scope

- Converting AI Insights `scripts/cli.js` to TypeScript or ESM.
- Restructuring `scripts/cli.js` into multiple files.
- Adding new commands or features during migration.
- **Replacing `scripts/extract-changelog-entry.js`.** This standalone
  script has GitHub Actions–specific output logic (GITHUB_OUTPUT
  multiline format) that is outside the library's scope. The library
  provides `extractChangelogEntry()` for programmatic use; the
  standalone script stays as-is for CI automation. A future
  consolidation is possible but not part of this migration.
- **`longRunning?: boolean` flag on `Command`.** The synthesis
  recommended replacing `instanceof Promise` detection with a
  declarative flag. The current approach is correct for all existing
  use cases. Defer to a post-v1 release if the fragility
  materialises in practice.
- **Per-ID warning for partial `--components` mismatches.** When
  a subset of `--components` IDs are unrecognised, `runSetup()`
  silently drops them (errors only when *all* are unknown). A
  per-unknown-ID warning is a DX enhancement for a future release.

## Acceptance Criteria

- (Step 0) `showInteractiveMenu()` catches exceptions from
  `cmd.run([])` and continues the loop.
- (Step 0) All test files that mutate `isTTY` save and restore
  the original value.
- (Step 0) `Command.run` JSDoc, `showInteractiveMenu()` JSDoc,
  and `api-surface.md` document the empty-args contract.
- (Step 0) `constraints.md` includes a cross-platform path rule
  for test fixtures.
- (Step 0) All existing cli-menu tests pass after hardening.
- AI Insights `node scripts/cli.js` launches the interactive menu
  with the same visual output as before migration.
- AI Insights `node scripts/cli.js help` produces the same help
  text.
- AI Insights `node scripts/cli.js setup` runs the checkbox wizard.
- AI Insights `node scripts/cli.js setup --all` runs all setups.
- AI Insights `node scripts/cli.js <command>` dispatches correctly
  for every registered command.
- `menu.sh` and `menu.cmd` launchers continue to work.
- AI Insights existing test suite (`npm test`) passes.
- `scripts/cli.js` is approximately ~600 lines (down from ~1,209).
- CI pipeline passes on Node 18 + 22, on ubuntu + windows.
- `@mistralys/cli-menu` is published on npm.
- AI Insights uses the registry version (not `file:` reference).

## Testing Strategy

### Manual Migration Validation

- Full manual walkthrough: interactive menu, help, setup wizard,
  each command, launcher scripts.
- Side-by-side comparison of help output before and after.
- Verify each setup component detects, runs, and validates correctly.

### Automated Validation

- Existing AI Insights test suite (`npm test`) must continue to pass.
- CLI smoke test: `node scripts/cli.js help` exits with code 0.

### CI Validation

- GitHub Actions matrix: Node 18 + 22, ubuntu + windows.
- All cli-menu tests pass in CI.
- Build produces expected artifacts.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Breaking the AI Insights CLI during migration** | Original `cli.js` preserved in Git history. One-step revert via `git checkout`. |
| **CJS `require()` fails for the TS library** | Already verified in Phases A/B build verification. Re-verify after migration. |
| **Setup wizard behavior differs subtly** | The library's checkbox TUI was built from the same source. Manual side-by-side testing. |
| **Windows shell spawning regression** | `IS_WIN` gate preserved in library. Verify with Windows CI matrix. |
| **npm publish contains unexpected files** | `package.json` `files: ["dist"]` restricts published content. Verify with `npm pack --dry-run`. |
| **`file:` → registry switch breaks resolution** | Verify with `npm ls @mistralys/cli-menu` after switching. |
| **`file:` reference hides subpath export bugs** | Verify with `npm pack` + tarball install before full migration testing (Step 1.3). |
