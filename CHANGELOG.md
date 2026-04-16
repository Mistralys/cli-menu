# Changelog

All notable changes to @mistralys/cli-menu will be documented in this file.

## v0.1.0 - Initial Release

- Core: `createMenu()` factory wires argument parsing, help rendering, setup wizard,
  and keypress-driven TUI menu into a single `run(argv)` entry point.
- Menu: Interactive full-screen keypress menu with category grouping, single-char key
  bindings, and ANSI-highlighted selection.
- Menu: `runCheckboxMenu()` interactive TUI checkbox selector for multi-option setup steps.
- Setup: `runSetup()` setup wizard orchestrator with sequential step execution and
  dependent-step resolution.
- Runners: `runScript()`, `runLongScript()`, `sh()` script execution helpers with
  cross-platform `IS_WIN` and `NPM` constants.
- Changelog: `readChangelogVersion()`, `extractChangelogEntry()`, `readPackageVersion()`,
  `readPyprojectVersion()` utilities published as `@mistralys/cli-menu/changelog` sub-path.
- Colors: ANSI color helpers `C`, `Colors`, and `log()` for styled terminal output.
- Preflight: `checkNodeVersion()` runtime version guard with `PreflightError`.
- Screen: `clearScreen()`, `waitForKey()` terminal utilities.
- Parser: `parseArgs()` CLI argument parser.
- Help: `printHelp()` multi-variant help renderer (short/full/command-detail).
- Package: Dual CJS + ESM output with full TypeScript declarations (`.d.ts` + `.d.cts`).
- Package: Nested `exports` map with per-condition types for TypeScript consumers using
  `moduleResolution: node16` or `bundler` in CJS context.
- Package: Zero production dependencies — only Node.js built-ins (`readline`,
  `child_process`, `fs`, `path`, `process`).
- Tests: 229 tests across 13 test files; enforced via CI workflow.
