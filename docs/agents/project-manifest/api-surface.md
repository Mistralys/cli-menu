# API Surface — @mistralys/cli-menu

All exports below are available from `@mistralys/cli-menu` unless a sub-path is noted.

---

## Factory

### `createMenu(config)`
```ts
function createMenu(config: MenuConfig): { run(argv: string[]): Promise<number> }
```
Creates the main menu entry point. Validates `Command.key` values at construction time (throws
if any key has length ≠ 1). Returns `{ run(argv) }` where `run` dispatches commands and
returns a `Promise<number>` exit code.

**Dispatch order:** (1) pre-flight checks → (2) `help` → (3) `setup` (if `setupComponents`
defined) → (4) known command → (5) unknown command → (6) interactive menu (TTY) → (7) no-TTY
error.

Never calls `process.exit()`.

---

## Types

### `MenuConfig`
```ts
interface MenuConfig {
  name:               string;
  banner:             string[];
  version:            string | (() => string);
  commands:           Command[];
  workspaceRoot:      string;
  setupComponents?:   SetupComponent[];
  preflightChecks?:   PreflightCheck[];
  categoryVersions?:  Record<string, () => string>;
  usageLine?:         string;
}
```

### `Command`
```ts
interface Command {
  id:            string;
  key:           string | null;      // single char or null (CLI-only)
  label:         string;
  category:      string;
  description:   string;
  // Interactive dispatch always calls run([]) — CLI flags are never forwarded.
  // Only direct-mode invocations supply a non-empty args array.
  // Interactive errors (sync throws + async rejections) are caught: message is
  // printed via log(), waitForKey() shown, then menu re-renders. Loop never exits.
  run:           (args: string[]) => void | Promise<void>;
  hidden?:       boolean;            // excluded from menu AND help
  helpHidden?:   boolean;            // excluded from help only
  helpVariants?: HelpVariant[];
  helpOrder?:    number;
}
```

### `SetupComponent`
```ts
interface SetupComponent {
  id:       string;
  label:    string;
  desc:     string;
  detect:   () => boolean;
  run:      (args: string[]) => boolean;
  validate: () => boolean;
}
```

### `PreflightCheck`
```ts
type PreflightCheck = () => void
```

### `HelpVariant`
```ts
type HelpVariant = [command: string, description: string]
```

### `ParsedArgs`
```ts
interface ParsedArgs {
  command: string | null;
  flags:   string[];
}
```

### `ScriptRunnerOptions`
```ts
interface ScriptRunnerOptions {
  cwd?:   string;
  shell?: boolean;
  env?:   NodeJS.ProcessEnv;
}
```

---

## Pre-flight

### `PreflightError`
```ts
class PreflightError extends Error {
  readonly exitCode: number;
  constructor(message: string, exitCode?: number)  // exitCode defaults to 1
}
```

### `checkNodeVersion(minMajor?)`
```ts
function checkNodeVersion(minMajor?: number): void  // default minMajor = 18
```
Throws `PreflightError` when the running Node.js major version is below `minMajor`.

---

## CLI parsing

### `parseArgs(argv)`
```ts
function parseArgs(argv: string[]): ParsedArgs
```
Splits `process.argv.slice(2)` into command + flags. The first non-flag argument is the
command; all others are flags. Leading flag → `command: null`.

---

## Script runners

### `runScript(command, args?, options?)`
```ts
function runScript(command: string, args?: string[], options?: ScriptRunnerOptions): number
```
Synchronous runner. Inherits stdio. Returns exit code.

### `runLongScript(command, args?, options?)`
```ts
function runLongScript(
  command: string,
  args?: string[],
  options?: ScriptRunnerOptions,
): { child: ChildProcess; exitCode: Promise<number> }
```
Asynchronous runner. Returns immediately; `exitCode` resolves when the child exits.

### `sh(command, args?, options?)`
```ts
function sh(command: string, args?: string[], options?: ScriptRunnerOptions): number
```
Non-fatal shell runner. Defaults `shell` to `true` on Windows. Returns exit code; never throws.

### `IS_WIN`
```ts
const IS_WIN: boolean
```
`true` on Windows (`process.platform === 'win32'`).

### `NPM`
```ts
const NPM: string
```
`'npm.cmd'` on Windows, `'npm'` elsewhere.

---

## Version utilities

### `resolveVersion(config)`
```ts
function resolveVersion(config: MenuConfig): string
```
Returns `config.version` as-is if a string; invokes and returns it if a function.

---

## Help rendering

### `printHelp(commands, config)`
```ts
function printHelp(commands: Command[], config: MenuConfig): void
```
Prints formatted help to stdout. Filters hidden commands, stable-sorts by `helpOrder`, groups
by category, renders `helpVariants`, appends a synthetic `help` entry unless already present.

---

## Terminal color helpers

### `C`
```ts
const C: {
  bold(text: string): string;    dim(text: string): string;
  italic(text: string): string;  underline(text: string): string;
  black(text: string): string;   red(text: string): string;
  green(text: string): string;   yellow(text: string): string;
  blue(text: string): string;    magenta(text: string): string;
  cyan(text: string): string;    white(text: string): string;
  gray(text: string): string;
}
```

### `Colors`
```ts
type Colors = keyof typeof C
```

### `log(message, color?)`
```ts
function log(message: string, color?: string): void
```
Writes to stdout with optional ANSI styling. Invalid `color` values fall through gracefully.

---

## Terminal utilities

### `isRawModeSupported()`
```ts
function isRawModeSupported(): boolean
```
Returns `true` when `process.stdin.isTTY === true`.

### `enterRawMode()`
```ts
function enterRawMode(): void
```
Enables raw mode and keypress events on stdin. No-op in non-TTY environments.

### `exitRawMode()`
```ts
function exitRawMode(): void
```
Disables raw mode and pauses stdin. Use for lightweight teardown.

### `restoreTerminal()`
```ts
function restoreTerminal(): void
```
Removes all keypress listeners, disables raw mode, pauses stdin. Safe to call multiple times.

### `clearScreen()`
```ts
function clearScreen(): void
```
Clears the terminal using ANSI `\x1b[2J\x1b[0;0H`. No-op in non-TTY environments.

### `waitForKey(prompt?)`
```ts
function waitForKey(prompt?: string): Promise<void>
```
Waits for a single keypress, then resolves. Resolves immediately in non-TTY environments.
Default prompt: `'\n  Press any key to continue…'`.

---

## Changelog utilities (sub-path: `@mistralys/cli-menu/changelog`)

### `ChangelogEntry`
```ts
interface ChangelogEntry {
  version: string;   // e.g. "v1.2.3"
  title:   string;
  body:    string;
}
```

### `readChangelogVersion(filePath)`
```ts
function readChangelogVersion(filePath: string): string
```
Returns `"vX.Y.Z"` from the first heading, or `"unknown"`.

### `extractChangelogEntry(filePath)`
```ts
function extractChangelogEntry(filePath: string): ChangelogEntry | null
```
Returns the first parsed entry, or `null`.

### `readPackageVersion(dirPath)`
```ts
function readPackageVersion(dirPath: string): string
```
Returns `"vX.Y.Z"` from `package.json` in `dirPath`, or `"unknown"`.

### `readPyprojectVersion(dirPath)`
```ts
function readPyprojectVersion(dirPath: string): string
```
Returns `"vX.Y.Z"` from `pyproject.toml` in `dirPath`, or `"unknown"`.

---

## Internal-only (not exported)

These functions are internal and should not be referenced from outside their own module:

| Function | Module | Purpose |
|----------|--------|---------|
| `validateCommandKeys(config)` | `create-menu.ts` | Construction-time key validation |
| `renderMenu(config)` | `menu/renderer.ts` | Draws interactive menu to stdout |
| `showInteractiveMenu(config)` | `menu/interactive.ts` | Keypress loop |
| `runSetup(components, args)` | `setup/runner.ts` | Setup wizard orchestrator |
| `runCheckboxMenu(components)` | `setup/checkbox-menu.ts` | Interactive checkbox TUI |
