# CLI Menu Changelog

## v1.1.1 - Bundle Documentation
- Docs: All documentation is now bundled in the NPM package to keep it available.

## v1.1.0 - First-Run Wizard & Status Lines
- Menu: Added `statusLines` — synchronous renderers injected below the version line in the header.
- Menu: Added `firstRunRedirect` — skippable 2-second first-run window when no setup is detected.
- Menu: Added `onFirstRun` — async callback invoked after the skip window; runs in cooked mode.
- Menu: Added a pause after the release check screen.
- Core: Fixed a Windows path URL issue with Node.
- Core: Fixed a Node deprecation warning during build.

## v0.1.0 - Initial Release
- Core: Single-entry-point factory wiring parsing, help, setup, and TUI menu.
- Menu: Interactive full-screen keypress menu with category grouping.
- Menu: Checkbox selector for multi-option setup steps.
- Setup: Setup wizard with sequential and dependent-step resolution.
- Runners: Cross-platform script execution helpers.
- Changelog: Version and entry extraction utilities via `/changelog` sub-path.
- Colors: ANSI color helpers for styled terminal output.
- Preflight: Runtime Node.js version guard.
- Screen: Terminal clear and wait-for-key utilities.
- Parser: CLI argument parser.
- Help: Multi-variant help renderer (short/full/command-detail).
- Package: Dual CJS + ESM output with full TypeScript declarations.
- Package: Zero production dependencies.
