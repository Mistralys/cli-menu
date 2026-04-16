# Configuration Reference

This document describes all configuration interfaces accepted by `createMenu()` and related APIs.

All types are exported from `@mistralys/cli-menu`.

---

## `MenuConfig`

Top-level configuration object passed to `createMenu()`.

```ts
import type { MenuConfig } from '@mistralys/cli-menu';
```

| Property | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | yes | Display name for the menu application. Shown in the header and help output. |
| `banner` | `string[]` | yes | ASCII banner lines rendered at the top of the interactive menu. Pass an empty array to suppress the banner. |
| `version` | `string \| (() => string)` | yes | Version string or a lazily-evaluated function returning one. See [Dynamic versions](#dynamic-versions). |
| `commands` | `Command[]` | yes | List of commands registered in the menu. |
| `workspaceRoot` | `string` | yes | Absolute path to the workspace root directory. Used by setup utilities. |
| `setupComponents?` | `SetupComponent[]` | no | Optional setup wizard components for multi-step environment setup. |
| `preflightChecks?` | `PreflightCheck[]` | no | Optional pre-flight checks run at startup before the interactive prompt is shown. |
| `categoryVersions?` | `Record<string, () => string>` | no | Per-category version resolvers for multi-module workspaces. Keys are category names; values are functions returning version strings. |
| `usageLine?` | `string` | no | Custom usage line shown in help output. When omitted, `printHelp()` falls back to `process.argv[1]`. See [Custom usage line](#custom-usage-line). |

### Minimal example

```ts
const config: MenuConfig = {
  name:          'My CLI',
  banner:        ['=== My CLI ==='],
  version:       '1.0.0',
  workspaceRoot: import.meta.dirname,
  commands:      [
    {
      id:          'build',
      key:         'b',
      label:       'Build',
      category:    'Build',
      description: 'Compile the project',
      run:         (_args) => { /* … */ },
    },
  ],
};
```

### Dynamic versions

`version` accepts either a literal string or a zero-argument function that returns a string. The function form is evaluated lazily — it is only called when a version string is needed (e.g. during help rendering).

```ts
import { readPackageVersion } from '@mistralys/cli-menu/changelog';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: MenuConfig = {
  // …
  version: () => readPackageVersion(__dirname),
};
```

> **Note:** If the function throws, the exception propagates to the caller — no error boundary is
> applied. Pass a function that is safe to call, or wrap it in a try/catch.

### Custom usage line

By default, `printHelp()` uses `process.argv[1]` as the invocation command in the usage line:

```
Usage: /absolute/path/to/script.js [command] [options]
```

Set `usageLine` to override this with a human-friendly form:

```ts
const config: MenuConfig = {
  // …
  usageLine: 'node scripts/cli.js [command] [options]',
};
```

Which produces:

```
Usage: node scripts/cli.js [command] [options]
```

> **Nullish coalescing semantics:** The fallback is triggered only when `usageLine` is `undefined`
> (or omitted). Setting `usageLine: ''` uses an empty string as-is and does **not** fall back to
> `process.argv[1]`.

### Per-category version resolvers

`categoryVersions` maps category names to version functions. This is useful in monorepo-style
workspaces where different command groups belong to separate versioned modules.

```ts
import { readPackageVersion } from '@mistralys/cli-menu/changelog';
import { join } from 'node:path';

const config: MenuConfig = {
  // …
  categoryVersions: {
    'Backend':  () => readPackageVersion(join(workspaceRoot, 'packages/backend')),
    'Frontend': () => readPackageVersion(join(workspaceRoot, 'packages/frontend')),
  },
};
```

---

## `Command`

A single command registered in the CLI menu.

```ts
import type { Command } from '@mistralys/cli-menu';
```

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | yes | Unique identifier for the command. Used for direct-mode invocation (`node cli.js <id>`) and as the primary name in help output. |
| `key` | `string \| null` | yes | Single-character key for interactive menu selection. Pass `null` for commands available only in direct mode. |
| `label` | `string` | yes | Display label shown in the interactive menu. |
| `category` | `string` | yes | Category group name. Commands with the same `category` are rendered together in help output under a bold header. |
| `description` | `string` | yes | Short description shown alongside the command in help output. |
| `run` | `(args: string[]) => void \| Promise<void>` | yes | Handler invoked when the command is selected. Receives the trailing CLI arguments after the command name. In interactive mode, any error thrown or rejected `Promise` is caught — the message is printed and the menu re-renders. The loop is never terminated by a command error. |
| `hidden?` | `boolean` | no | When `true`, the command is not shown in the interactive menu. It remains invocable in direct mode. |
| `helpHidden?` | `boolean` | no | When `true`, the command is excluded from `printHelp()` output. Useful for internal commands. |
| `helpVariants?` | `HelpVariant[]` | no | Alternative command-line forms shown as sub-entries in help output, immediately after the main command entry. |
| `helpOrder?` | `number` | no | Optional numeric sort key. Commands with `helpOrder` are sorted numerically ascending; commands without `helpOrder` retain their insertion order relative to each other. |

### Example

```ts
const buildCommand: Command = {
  id:       'build',
  key:      'b',
  label:    'Build project',
  category: 'Build',
  description: 'Compile all packages',
  run: async (args) => {
    const watch = args.includes('--watch');
    await compile({ watch });
  },
  helpVariants: [
    ['build --watch', 'Compile in watch mode'],
  ],
  helpOrder: 1,
};
```

### Direct-mode-only commands

Set `key: null` for commands that should only be invocable from the command line, not via the
interactive keypress menu:

```ts
const ciCommand: Command = {
  id:          'ci',
  key:         null,          // not shown in interactive menu
  label:       'CI run',
  category:    'Internal',
  description: 'Full CI pipeline (not interactive)',
  run:         (_args) => { /* … */ },
  hidden:      true,          // also hide from the menu list
};
```

---

## `SetupComponent`

A setup wizard component representing a single installable sub-system. Registered via
`MenuConfig.setupComponents`.

```ts
import type { SetupComponent } from '@mistralys/cli-menu';
```

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | yes | Unique identifier used with the `--components` flag. Callers pass `--components <id>` to target a specific component. |
| `label` | `string` | yes | Display label shown in the setup menu. |
| `desc` | `string` | yes | Short description shown alongside the label. |
| `detect` | `() => boolean` | yes | Returns `true` if this component is already set up. Used to skip re-installation and to display status in the menu. |
| `run` | `(args: string[]) => boolean` | yes | Performs the setup. Receives extra CLI arguments. Returns `true` on success. |
| `validate` | `() => boolean` | yes | Post-run verification. Returns `true` if the component is valid after installation. |

### Example

```ts
const nodeModulesComponent: SetupComponent = {
  id:       'node-modules',
  label:    'Node.js dependencies',
  desc:     'Install npm packages',
  detect:   () => existsSync('node_modules'),
  run:      (_args) => {
    const code = runScript('npm', ['install']);
    return code === 0;
  },
  validate: () => existsSync('node_modules/.bin'),
};

const config: MenuConfig = {
  // …
  setupComponents: [nodeModulesComponent],
};
```

---

## `PreflightCheck`

```ts
type PreflightCheck = () => void
```

A synchronous pre-flight check function. Should throw `PreflightError` on failure. Pre-flight
checks run at menu startup before the interactive prompt is shown.

```ts
import type { PreflightCheck } from '@mistralys/cli-menu';
import { PreflightError }       from '@mistralys/cli-menu';

const requireDotEnv: PreflightCheck = () => {
  if (!existsSync('.env')) {
    throw new PreflightError('Missing .env file — run setup first.', 1);
  }
};

const config: MenuConfig = {
  // …
  preflightChecks: [requireDotEnv],
};
```

> **Design note:** `PreflightCheck` is intentionally synchronous. If async pre-flight I/O is
> required in a future release, this type will be updated to `() => void | Promise<void>`.

See also: the built-in `checkNodeVersion()` pre-flight helper in the main API reference.

---

## `HelpVariant`

```ts
type HelpVariant = [command: string, description: string]
```

A tuple used in `Command.helpVariants` to register alternative invocation forms shown in help
output.

```ts
helpVariants: [
  ['build --watch',         'Watch mode'],
  ['build --out <dir>',     'Custom output directory'],
]
```

---

**See also:** [README](../README.md) — quick-start guide and full feature overview.
