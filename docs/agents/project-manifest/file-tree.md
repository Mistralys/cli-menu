# File Tree — @mistralys/cli-menu

Last updated: 2026-04-15 (reflects Phase B final structure)

---

## Root

```
cli-menu/
├── AGENTS.md                    ← Agent operating system for this repo
├── CHANGELOG.md
├── LICENSE
├── package.json
├── README.md                    ← Primary API reference (user-facing)
├── tsconfig.json
├── tsup.config.ts               ← Build config (dual CJS + ESM)
├── vitest.config.ts             ← Test config with coverage thresholds
├── dist/                        ← Build output (gitignored)
├── docs/
│   ├── agents/
│   │   ├── plans/               ← Agent work plans (historical)
│   │   ├── project-manifest/    ← This manifest (you are here)
│   │   └── research/            ← Research notes
│   ├── changelog-utilities.md   ← Changelog sub-path export docs
│   └── configuration.md         ← MenuConfig / Command / SetupComponent reference
├── fixtures/
│   ├── changelogs/              ← Changelog fixture files for tests
│   └── manifests/               ← package.json / pyproject.toml fixtures
├── src/                         ← Source code (see below)
└── tests/                       ← Vitest test suites (see below)
```

---

## Source (`src/`)

```
src/
├── index.ts                     ← Barrel re-export (no logic)
├── types.ts                     ← All public interfaces and types (type-only)
│
│  ── Primitive layer ──────────────────────────────────────────
├── colors.ts                    ← ANSI helpers: C, Colors, log()
├── raw-mode.ts                  ← Raw mode management: enterRawMode(), exitRawMode(),
│                                   restoreTerminal(), isRawModeSupported()
├── screen.ts                    ← Screen utils: clearScreen(), waitForKey()
│
│  ── Service layer ─────────────────────────────────────────────
├── runners.ts                   ← Script runners: runScript(), runLongScript(), sh(),
│                                   IS_WIN, NPM
├── parser.ts                    ← CLI arg parsing: parseArgs(), ParsedArgs (re-export)
├── preflight.ts                 ← Pre-flight: checkNodeVersion(), PreflightError
├── version.ts                   ← Version resolver: resolveVersion()
├── help.ts                      ← Help renderer: printHelp()
│
│  ── Engine layer ──────────────────────────────────────────────
├── menu/
│   ├── index.ts                 ← Barrel export
│   ├── renderer.ts              ← renderMenu() — draws menu to stdout
│   └── interactive.ts           ← showInteractiveMenu() — keypress loop
├── setup/
│   ├── index.ts                 ← Barrel export
│   ├── checkbox-menu.ts         ← runCheckboxMenu() — interactive TUI checkbox selector
│   └── runner.ts                ← runSetup() — setup wizard orchestrator
│
│  ── Factory layer (sub-path) ──────────────────────────────────
├── create-menu.ts               ← createMenu() factory — main entry point
└── changelog/
    └── index.ts                 ← Changelog utilities: readChangelogVersion(),
                                    extractChangelogEntry(), readPackageVersion(),
                                    readPyprojectVersion()
```

---

## Tests (`tests/`)

```
tests/
├── integration.test.ts          ← End-to-end tests for createMenu()
├── changelog.test.ts            ← Changelog utility tests
├── colors.test.ts               ← ANSI color helper tests
├── create-menu.test.ts          ← createMenu() unit tests
├── help.test.ts                 ← printHelp() tests
├── parser.test.ts               ← parseArgs() tests
├── preflight.test.ts            ← PreflightError / checkNodeVersion() tests
├── runners.test.ts              ← runScript() / runLongScript() / sh() tests
├── screen.test.ts               ← clearScreen() / waitForKey() tests
├── menu/
│   ├── interactive.test.ts      ← showInteractiveMenu() tests
│   └── renderer.test.ts         ← renderMenu() tests
└── setup/
    ├── checkbox-menu.test.ts    ← runCheckboxMenu() tests
    └── runner.test.ts           ← runSetup() tests
```
