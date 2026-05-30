# CLI Menu

[![CI](https://github.com/Mistralys/cli-menu/actions/workflows/ci.yml/badge.svg)](https://github.com/Mistralys/cli-menu/actions/workflows/ci.yml)

Zero-dependency TypeScript library for building interactive CLI menus.

## What it does

CLI Menu turns a list of typed command definitions into a fully-wired CLI tool —
an interactive keypress-driven TUI for human use *and* a direct dispatch path for scripting,
all from a single `createMenu()` call. No dependencies, no framework, no boilerplate.

## Features

- **Interactive TUI menu** — keypress navigation with categories, labels, and descriptions
- **Direct command dispatch** — invoke any command by name from the shell (`node cli.js build`)
- **Auto-generated help** — `--help` renders a formatted reference from your command definitions
- **Setup wizard** — guided multi-step environment setup via `--setup`
- **Pre-flight checks** — validate the environment at startup before anything runs
- **Script runners** — synchronous and async child-process helpers with cross-platform defaults
- **Changelog utilities** — read versions from changelog files, `package.json`, or `pyproject.toml`
- **Terminal color helpers** — composable ANSI color wrappers, no external packages needed
- **Zero runtime dependencies** — only Node.js built-ins

> See it on NPM: https://www.npmjs.com/package/@mistralys/cli-menu

## Requirements

- Node.js ≥ 18.0.0

## Quick Start

```bash
npm install @mistralys/cli-menu
```

Define your commands and hand the result to `process.exit()`:

```ts
import { createMenu } from '@mistralys/cli-menu';

const menu = createMenu({
  name:          'My CLI',
  banner:        ['=== My CLI Tool ==='],
  version:       '1.0.0',
  workspaceRoot: import.meta.dirname,
  commands: [
    {
      id:          'build',
      key:         'b',
      label:       'Build',
      category:    'Dev',
      description: 'Compile the project',
      run:         async (_args) => { /* … */ },
    },
  ],
});

process.exit(await menu.run(process.argv.slice(2)));
```

Run it interactively:

```
node cli.js
```

Or dispatch a command directly:

```
node cli.js build
node cli.js --help
```

The library **never** calls `process.exit()` itself. `menu.run()` resolves to a numeric exit
code — `0` on success, non-zero on failure — so you stay in control.

## Sub-path Exports

The package ships two sub-paths:

| Import | Contents |
|--------|----------|
| `@mistralys/cli-menu` | Core library — `createMenu`, runners, colors, preflight, etc. |
| `@mistralys/cli-menu/changelog` | Changelog and version reading utilities |

The changelog utilities are in a separate sub-path so consumers who don't need them pay zero
import cost.

```ts
import { readChangelogVersion } from '@mistralys/cli-menu/changelog';
```

## Learn More

| Resource | Description |
|----------|-------------|
| [Configuration Reference](docs/configuration.md) | All `MenuConfig`, `Command`, and `SetupComponent` properties with examples |
| [Changelog Utilities](docs/changelog-utilities.md) | Reading versions from changelogs, `package.json`, and `pyproject.toml` |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

## Releasing Workflow

1. Add changelog entries (do not change package.json version)
2. Run the menu.
3. Build the project.
4. Verify distribution.
5. Run the release check, fix any issues.
6. Commit all unstages changes.
7. `npm version 0.0.0` - Updates package and lock versions + commit
8. `npm publish` - Publish version on NPM
9. `git push origin 0.0.0` - Add the tag in GIT
10. Add the release on Github
