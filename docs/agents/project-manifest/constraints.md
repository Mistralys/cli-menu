# Constraints — @mistralys/cli-menu

---

## Architectural Invariants

### 1. Zero Production Dependencies

The library imports **only Node.js built-ins** (`readline`, `child_process`, `fs`, `path`,
`process`). No npm packages may be added to `dependencies`.

> **Rationale:** CLI tools run on developer machines where install hygiene matters. A
> zero-dependency library composes cleanly with any toolchain.

**Enforcement:** Adding a package to `dependencies` (not `devDependencies`) violates this rule.
Justify in writing before proposing any exception.

---

### 2. No `process.exit()` in Library Code

The library never calls `process.exit()`. All execution paths return a numeric exit code
(`Promise<number>`) to the caller. The caller decides what to do with the code.

**Applies to:** `src/create-menu.ts`, all engine modules, all service modules.

**Exception:** The entry point script provided _by the consumer_ (e.g. `scripts/cli.js`) should
call `process.exit(await menu.run(...))`. This is user code, not library code.

---

### 3. Layer Dependency Direction

Dependencies flow downward only:

```
factory → engine → service → primitive
```

- Engine modules (`src/menu/`, `src/setup/`) must not import from `src/create-menu.ts`.
- Primitive modules (`src/colors.ts`, `src/raw-mode.ts`, `src/screen.ts`) must not import from
  service or engine modules.
- `src/types.ts` is importable from all layers (type-only, no runtime code).
- `src/changelog/` is isolated — it imports only Node.js `fs`.

---

### 4. `src/index.ts` Is a Barrel

`src/index.ts` contains only re-exports. No logic, no conditional code, no side effects. It
exists solely to give consumers a single `@mistralys/cli-menu` import path.

---

### 5. `Command.key` Must Be Single-Char or `null`

Any `Command` registered with a non-null `key` must have `key.length === 1`. This is enforced
at construction time by `validateCommandKeys()` in `createMenu()`. Commands with `key: null`
are CLI-only and not shown in the interactive menu.

---

### 6. SIGINT Cleanup Is Mandatory in Interactive Modules

Any module that enters raw mode for an interactive session (`showInteractiveMenu`,
`runCheckboxMenu`) **must**:

1. Register a `process.on('SIGINT')` handler that calls `restoreTerminal()` and re-raises the
   signal (`process.kill(process.pid, 'SIGINT')`).
2. Unregister the handler when the function resolves cleanly.

Failing to do this leaves the terminal in raw mode after Ctrl+C, which corrupts the console
for the user.

---

## Naming Conventions

| Symbol | Convention | Example |
|--------|-----------|---------|
| Exported functions | `camelCase` | `createMenu`, `parseArgs`, `runScript` |
| Exported interfaces | `PascalCase` | `MenuConfig`, `Command`, `SetupComponent` |
| Exported types | `PascalCase` | `PreflightCheck`, `HelpVariant`, `Colors` |
| Exported constants | `UPPER_SNAKE_CASE` for flags; `PascalCase` for objects | `IS_WIN`, `NPM`, `C` |
| Internal helpers | `camelCase` | `validateCommandKeys`, `resolveSelectedIds` |
| Test files | `*.test.ts` in `tests/` mirroring `src/` | `tests/create-menu.test.ts` |
| Fixture directories | lower-kebab | `fixtures/changelogs/` |

---

## Known Limitations

### 1. `ScriptRunnerOptions.env` Replaces the Entire Environment

Passing `env` to `runScript()`, `runLongScript()`, or `sh()` **replaces** `process.env`
entirely (Node.js `spawnSync` / `spawn` semantics). To inherit the parent environment while
adding variables, spread explicitly:

```ts
{ env: { ...process.env, MY_VAR: 'value' } }
```

### 2. `runLongScript()` Does Not Register SIGINT Handlers

`runLongScript()` returns `{ child, exitCode }` and leaves signal forwarding to the caller.
Callers that need SIGINT forwarding must add their own handler:

```ts
const { child, exitCode } = runLongScript('node', ['server.js']);
process.on('SIGINT', () => child.kill('SIGINT'));
```

### 3. `sh()` Enables `shell: true` on Windows Only

On Unix/macOS `sh()` spawns directly without a shell wrapper. Consumers who always need a
shell should pass `options: { shell: true }` explicitly.

### 4. `PreflightCheck` Is Synchronous

`PreflightCheck` is `() => void`. Async pre-flight I/O (e.g. port checks) is not supported in
this version. If required, run the async check before constructing the menu and gate
construction on success.

### 5. Interactive Features Require a TTY

`showInteractiveMenu()` and `runCheckboxMenu()` behave differently in non-TTY environments:
`showInteractiveMenu` is never reached (createMenu returns 1 for non-TTY without a command);
`runCheckboxMenu` requires the caller (`runSetup`) to enforce a `--all` or `--components` flag
in non-TTY mode. Raw mode syscalls are guarded but interactive output is meaningless without
a TTY.

---

## Testing Conventions

- Each source module has a corresponding test file in `tests/` at the same relative path.
- Tests use `vi.spyOn` for mocking; `vi.restoreAllMocks()` is called in `afterEach`.
- `Object.defineProperty(process.stdout/stdin, 'isTTY', ...)` mutations for TTY-gating tests
  must be explicitly saved and restored. **`vi.restoreAllMocks()` does NOT revert
  `Object.defineProperty` mutations** — relying on it is a silent failure that causes
  test order-dependence. Use `beforeEach` (save) + `afterEach` (restore) for
  describe-scoped mutations, or a `try/finally` block for single-test mutations:
  ```ts
  let origIsTTY: boolean | undefined;
  beforeEach(() => { origIsTTY = process.stdout.isTTY; });
  afterEach(() => { Object.defineProperty(process.stdout, 'isTTY', { value: origIsTTY, writable: true }); });
  ```
- Fixtures live in `fixtures/` (changelog files, `package.json`, `pyproject.toml`). Do not
  create fixture files directly in `tests/`.
- Integration tests (`tests/integration.test.ts`) are end-to-end — they call `createMenu()`
  with a real (non-mocked) `printHelp` and only stub `showInteractiveMenu` for TTY
  compatibility.
- **Cross-platform path hygiene:** Temporary files or directories created during tests must
  use `os.tmpdir()` (Node.js built-in) to obtain a platform-safe temp directory. Never
  hardcode absolute paths such as `/tmp/…` — the temp directory location differs across
  platforms (e.g. `C:\Users\…\AppData\Local\Temp` on Windows).
