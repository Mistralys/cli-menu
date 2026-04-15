# CLI Menu Scaffold — Agent Build Specification

> **Purpose:** Detailed specification for an AI agent to build a reusable, interactive Node.js CLI menu system. Based on the proven architecture from the AI Insights workspace CLI, distilled into a project-agnostic scaffold.

---

## 1. Overview

Build a single-file interactive CLI (`scripts/cli.js`) that serves as the command center for a Node.js workspace. The CLI operates in two modes:

1. **Interactive mode** — Full-screen TUI menu with categorized commands, keyboard navigation, and an ASCII banner.
2. **Direct mode** — Execute any command non-interactively via `node scripts/cli.js <command> [flags]`.

The menu must work on **Windows, macOS, and Linux** without any external dependencies — it uses only Node.js built-in modules (`fs`, `path`, `readline`, `child_process`, `os`).

---

## 2. Technology Constraints

| Constraint | Detail |
|------------|--------|
| **Runtime** | Node.js ≥ 18 |
| **Module system** | CommonJS (`'use strict'`) — maximizes compatibility with diverse workspace setups |
| **Dependencies** | Zero npm dependencies — only Node.js built-ins |
| **Platform** | Windows + macOS + Linux. All file paths via `path.join()`, all spawns platform-aware |
| **Entry point** | `scripts/cli.js` (executable via `#!/usr/bin/env node`) |
| **Launchers** | `menu.sh` (bash) and `menu.cmd` (Windows batch) — thin wrappers that `cd` to the workspace root and run `node scripts/cli.js "$@"` |

---

## 3. File Structure

```
project-root/
├── scripts/
│   └── cli.js                    # The main CLI file (all-in-one)
├── menu.sh                       # Bash launcher (3 lines)
├── menu.cmd                      # Windows batch launcher (3 lines)
└── changelog.md                  # Used for version extraction
```

### 3.1 Launcher Scripts

**`menu.sh`:**
```bash
#!/usr/bin/env bash
cd "$(dirname "$0")"
node scripts/cli.js "$@"
```

**`menu.cmd`:**
```batch
@echo off
cd /d "%~dp0"
node scripts/cli.js %*
```

These allow users to double-click or run `./menu.sh` from any directory.

---

## 4. Architecture — Section-by-Section

The CLI file is organized into clearly delimited sections using comment banners:

```
// ─── Constants ──────────────────────────────
// ─── ANSI Color Helpers ─────────────────────
// ─── Logging ────────────────────────────────
// ─── Pre-flight Checks ─────────────────────
// ─── Version String Helper ──────────────────
// ─── Script Runners ─────────────────────────
// ─── Setup Components ───────────────────────
// ─── Command Functions ──────────────────────
// ─── Command Registry ───────────────────────
// ─── Help ───────────────────────────────────
// ─── Argument Parser ────────────────────────
// ─── Setup Wizard ───────────────────────────
// ─── Interactive Main Menu ──────────────────
// ─── Entry Point ────────────────────────────
```

Each section is self-contained and follows a top-down dependency order.

---

## 5. Constants

Define workspace paths relative to the script location. Never hardcode absolute paths.

```js
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const SCRIPTS_DIR    = __dirname;
const IS_WIN         = process.platform === 'win32';
const NPM            = IS_WIN ? 'npm.cmd' : 'npm';
const CHANGELOG_FILE = path.join(WORKSPACE_ROOT, 'changelog.md');
```

**Key rules:**
- All sub-project directories derived from `WORKSPACE_ROOT` via `path.join()`.
- `IS_WIN` used to gate Windows-specific behavior (shell spawning, path lookups).
- `NPM` resolves to `npm.cmd` on Windows (required for `spawnSync` without `shell: true`).

---

## 6. ANSI Color Helpers

A lightweight color object — no dependency on `chalk` or `kleur`.

```js
const C = {
  reset:       (s) => `\x1b[0m${s}\x1b[0m`,
  bold:        (s) => `\x1b[1m${s}\x1b[0m`,
  dim:         (s) => `\x1b[2m${s}\x1b[0m`,
  red:         (s) => `\x1b[31m${s}\x1b[0m`,
  green:       (s) => `\x1b[32m${s}\x1b[0m`,
  yellow:      (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:        (s) => `\x1b[36m${s}\x1b[0m`,
  white:       (s) => `\x1b[37m${s}\x1b[0m`,
  brightWhite: (s) => `\x1b[97m${s}\x1b[0m`,
  brightCyan:  (s) => `\x1b[96m${s}\x1b[0m`,
};
```

**Usage:** `C.green('✓ Done')`, `C.dim('optional info')`, `C.bold('Header')`.

Colors are composable: `C.bold(C.cyan('text'))`.

---

## 7. Logging

A single logging function that accepts an optional color key:

```js
function log(msg, color) {
  console.log(color && C[color] ? C[color](msg) : msg);
}
```

---

## 8. Pre-flight Checks

Run at startup to fail fast with clear error messages.

```js
function checkNodeVersion() {
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major < 18) {
    log(`✗ Node.js >= 18 required (found ${process.versions.node})`, 'red');
    process.exit(1);
  }
}

function checkWorkspaceRoot() {
  // Verify a known landmark directory/file exists
  if (!fs.existsSync(path.join(WORKSPACE_ROOT, 'some-expected-dir'))) {
    log('✗ Run from the workspace root (expected directory not found)', 'red');
    process.exit(1);
  }
}
```

The workspace root check should verify a landmark that uniquely identifies the project (e.g., a known subdirectory or config file).

---

## 9. Version String Helper

Extract the current project version from `changelog.md` — no dependency on `package.json`.

```js
function readVersion() {
  try {
    const content = fs.readFileSync(CHANGELOG_FILE, 'utf8');
    // Matches both `## v1.2.3` and `## [1.2.3]` heading formats
    const m = content.match(/^##\s+(?:\[|v)?(\d+\.\d+\.\d+)/m);
    return m ? `v${m[1]}` : 'unknown';
  } catch {
    return 'unknown';
  }
}
```

**Why changelog.md?** The changelog is the source of truth for the version. This avoids the need to keep `package.json` version in sync manually (or provides a cross-check).

### 9.1 Sub-project Version Readers

For workspaces with multiple sub-projects, provide specialized readers:

```js
// Read version from package.json
function readSubVersion(subDir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(subDir, 'package.json'), 'utf8'));
    return pkg.version ? `v${pkg.version}` : 'unknown';
  } catch { return 'unknown'; }
}

// Read version from pyproject.toml (Python projects)
function readPyprojectVersion(subDir) {
  try {
    const content = fs.readFileSync(path.join(subDir, 'pyproject.toml'), 'utf8');
    const m = content.match(/^version\s*=\s*"([^"]+)"/m);
    return m ? `v${m[1]}` : 'unknown';
  } catch { return 'unknown'; }
}
```

---

## 10. Script Runners

Three runner functions for different execution needs:

### 10.1 Synchronous Runner (blocking, exits on failure)

Used for most commands — delegates to a child script and exits if it fails.

```js
function runScript(scriptName, args = []) {
  const result = spawnSync('node', [path.join(SCRIPTS_DIR, scriptName), ...args], {
    cwd: WORKSPACE_ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    log(`\n✗ ${scriptName} exited with code ${result.status}`, 'red');
    process.exit(result.status ?? 1);
  }
}
```

### 10.2 Long-running Runner (async, forwards signals)

For servers, watchers, and other long-running processes. Forwards `SIGINT` and exits when the child exits.

```js
function runLongScript(scriptName, args = []) {
  const child = spawn('node', [path.join(SCRIPTS_DIR, scriptName), ...args], {
    cwd: WORKSPACE_ROOT,
    stdio: 'inherit',
  });
  child.on('error', (err) => {
    log(`✗ Failed to launch ${scriptName}: ${err.message}`, 'red');
    process.exit(1);
  });
  process.on('SIGINT', () => child.kill('SIGINT'));
  child.on('exit', (code) => process.exit(code ?? 0));
}
```

### 10.3 Shell Runner (non-fatal, returns exit code)

Used inside setup components where failure shouldn't crash the CLI.

```js
function sh(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: WORKSPACE_ROOT,
    shell: IS_WIN,  // Windows .cmd files require shell:true in Node 22+
    ...opts,
  });
  return r.status ?? 1;
}
```

**Critical Windows note:** On Windows, `.cmd` wrapper scripts (`npm.cmd`, `pip.cmd`) require `shell: true` in `spawnSync` starting with Node 22+. The `IS_WIN` default handles this.

---

## 11. Setup Wizard

A reusable component-based setup system with an interactive checkbox TUI.

### 11.1 Setup Component Schema

Each setup component is an object with:

```js
{
  id:       'component-id',       // Used in --components flag
  label:    'Display Name',       // Shown in setup menu
  desc:     'Short description',  // Shown alongside label
  detect()  { },                  // Returns true if already set up
  run(args) { },                  // Performs the setup, returns true on success
  validate(){ },                  // Post-run verification, returns true if valid
}
```

**Example components:**
- **npm install + build** — Detect: `node_modules/` + `dist/` exist. Run: `npm install && npm run build`. Validate: expected output file exists.
- **Python venv** — Detect: `.venv/` exists. Run: create venv, pip install. Validate: venv python binary exists.
- **Config file scaffold** — Detect: config file exists. Run: copy from `.dist` template with path replacement. Validate: file is parseable.
- **Git hooks** — Detect: `git config core.hooksPath` matches expected. Run: set config. Validate: same check.

### 11.2 Interactive Checkbox Menu

The setup wizard renders a full-screen checkbox selector:

```
Select components to set up:

  ▶ [x] 1. MCP Server     npm install + build            (done)
    [x] 2. Personas        npm install + build + sync
    [ ] 3. Orchestrator    Python venv + pip install
    [x] 4. Config File     IDE config from template        (done)
    [x] 5. Git Hooks       Pre-commit guards

  (done) = already set up — toggle to re-run

  [a] Toggle all   [Enter] Run selected   [q] Back
  ↑/↓ or j/k move   Space toggles
```

**Key behaviors:**
- Arrow keys (↑/↓) or `j`/`k` for cursor navigation.
- `Space` to toggle individual checkboxes.
- `a` to toggle all on/off.
- `Enter` to run selected components.
- `q` or `Ctrl+C` to cancel.
- Components marked `(done)` (via `detect()`) are pre-checked but can be toggled off.
- Uses `process.stdin.setRawMode(true)` for single-keypress input.
- Screen clear via `\x1b[2J\x1b[0;0H` on each render cycle.

### 11.3 CLI Flags for Non-interactive Use

```
node scripts/cli.js setup                     # Interactive checkbox menu
node scripts/cli.js setup --all               # Run all components
node scripts/cli.js setup --components a,b,c  # Run specific components by ID
```

Non-TTY detection: if `!process.stdin.isTTY`, require `--all` or `--components`.

### 11.4 Setup Summary Table

After running, display a summary:

```
Setup Summary
──────────────────────────────────────────────────
  ✓  MCP Server       OK
  ✓  Personas         OK
  ✗  Orchestrator     Failed — see output above
  ✓  Config File      OK
──────────────────────────────────────────────────
  3/4 components succeeded
```

Exit with code 1 if any component failed.

---

## 12. Command Registry

All commands are defined in a single `COMMANDS` array. This is the **sole source of truth** for both the interactive menu and CLI dispatch.

### 12.1 Command Schema

```js
{
  id:              'command-name',         // CLI identifier (node scripts/cli.js <id>)
  key:             'x',                    // Single-char hotkey for interactive menu (or null)
  label:           'Menu Label',           // Display text in interactive menu
  category:        'Category Name',        // Groups commands in the menu
  description:     'One-line description', // Shown in menu and help
  run:             (args) => { },          // Handler function (receives CLI flags array)

  // Optional:
  hidden:          false,   // Omit from interactive menu (still works via CLI + help)
  helpHidden:      false,   // Omit from help output (still works via CLI + menu)
  helpVariants:    [],      // Sub-commands shown in help: [['cmd --flag', 'description'], ...]
  interleaveAfter: null,    // { command: 'other-id', variant: 0 } — position in help output
}
```

### 12.2 Property Details

| Property | Type | Required | Purpose |
|----------|------|----------|---------|
| `id` | string | Yes | Unique command identifier; used for CLI dispatch (`node cli.js <id>`) |
| `key` | string \| null | Yes | Single-character hotkey for the interactive menu. `null` = no hotkey (command is CLI-only or hidden) |
| `label` | string | Yes | Display text shown in the interactive menu |
| `category` | string | Yes | Groups commands under category headers in the menu |
| `description` | string | Yes | One-line description shown in both menu and help |
| `run` | function | Yes | Handler `(args: string[]) => void \| Promise<void>`. Receives remaining CLI flags |
| `hidden` | boolean | No | If true, command is omitted from the interactive menu but remains accessible via direct CLI and `help` |
| `helpHidden` | boolean | No | If true, command is omitted from `help` output but remains accessible via CLI and interactive menu |
| `helpVariants` | array | No | Sub-command rows rendered in `help` immediately after the base command. Format: `[['subcommand --flag', 'description'], ...]` |
| `interleaveAfter` | object | No | Controls help output ordering: `{ command: 'parent-id', variant: 0 }` renders this command after the parent's Nth helpVariant |

### 12.3 Categories

Categories are derived automatically from insertion order — no separate category definition needed:

```js
const cats = [...new Set(COMMANDS.map((c) => c.category))];
```

**Recommended categories:**
- `Setup & Configuration` — setup wizard, config scaffolding, git hooks
- `Build & Development` — build scripts, watchers, dev server
- `Validation & Utilities` — linters, version checks, doc generation
- `Testing` — test runners, coverage

### 12.4 Example Commands

```js
const COMMANDS = [
  {
    id:          'setup',
    key:         's',
    label:       'First-time setup',
    category:    'Setup & Configuration',
    description: 'Full workspace setup wizard',
    helpVariants: [
      ['setup --all',              'Non-interactive full setup'],
      ['setup --components <ids>', 'Run selected components'],
    ],
    run: (args) => runSetup(args),
  },
  {
    id:          'build',
    key:         'b',
    label:       'Build project',
    category:    'Build & Development',
    description: 'Compile, generate docs, sync versions',
    run:         cmdBuild,
  },
  {
    id:          'test',
    key:         't',
    label:       'Run tests',
    category:    'Validation & Utilities',
    description: 'Execute test suite',
    run:         (args) => sh(NPM, ['test', ...args]),
  },
  {
    id:          'dev',
    key:         null,
    label:       'Dev server',
    category:    'Build & Development',
    description: 'Start development server (long-running)',
    hidden:      true,
    run:         (args) => runLongScript('dev-server.js', args),
  },
];
```

---

## 13. Help Output

The `help` command renders a flat list grouped by insertion order, respecting `helpHidden`, `helpVariants`, and `interleaveAfter`.

```
Project CLI — v1.2.3

Usage: node scripts/cli.js [command] [options]

Commands:
  setup                       Full workspace setup wizard
  setup --all                 Non-interactive full setup
  setup --components <ids>    Run selected components
  build                       Compile, generate docs, sync versions
  test                        Execute test suite
  help                        Show this help

Run without arguments for interactive mode.
```

**Formatting rules:**
- Command name left-padded 2 spaces, padded to 28 characters.
- Description in dim color after the padding.
- `help` is always appended as the last entry (not in COMMANDS).
- Commands with `helpHidden: true` are excluded.
- Commands with `interleaveAfter` are rendered at their specified position instead of in-order.

---

## 14. Interactive Main Menu

### 14.1 ASCII Banner

Define a project-specific ASCII art banner as an array of strings:

```js
const BANNER_LINES = [
  " ",
  "██████╗ ██████╗  ██████╗      ██╗███████╗ ██████╗████████╗",
  "██╔══██╗██╔══██╗██╔═══██╗     ██║██╔════╝██╔════╝╚══██╔══╝",
  "██████╔╝██████╔╝██║   ██║     ██║█████╗  ██║        ██║   ",
  "██╔═══╝ ██╔══██╗██║   ██║██   ██║██╔══╝  ██║        ██║   ",
  "██║     ██║  ██║╚██████╔╝╚█████╔╝███████╗╚██████╗   ██║   ",
  "╚═╝     ╚═╝  ╚═╝ ╚═════╝  ╚════╝ ╚══════╝ ╚═════╝   ╚═╝   ",
];
```

Generate ASCII art for the project name using a tool like [patorjk.com/software/taag](https://patorjk.com/software/taag/) with the **ANSI Shadow** font.

### 14.2 Menu Rendering

The `renderMenu()` function:

1. Clears the screen (`\x1b[2J\x1b[0;0H`).
2. Prints the banner in cyan.
3. Prints the version line in dim.
4. Groups visible commands by category (skip `hidden: true`).
5. For each category: print bold header, then each command as `key. label   description`.
6. Print footer: `[h] Help   [q] Quit`.
7. Print input prompt: `Choose: `.

```
 ██████╗ ...
 ...

  Workspace CLI  v1.2.3

  Setup & Configuration
    s. First-time setup          Full workspace setup wizard
    m. Scaffold config           Generate config from template

  Build & Development
    b. Build project             Compile, generate docs, sync versions

  Validation & Utilities
    t. Run tests                 Execute test suite
    d. Bundle docs               Compile doc bundles

  [h] Help   [q] Quit

  Choose:
```

### 14.3 Sub-project Versions in Category Headers

If categories correspond to sub-projects, show their versions after the category name:

```js
const catVersions = {
  'MCP Server':   readSubVersion(MCP_SERVER_DIR),
  'Frontend':     readSubVersion(FRONTEND_DIR),
};

// In renderMenu():
const subVer = catVersions[cat] ? C.dim(` ${catVersions[cat]}`) : '';
console.log(C.bold(`  ${cat}`) + subVer);
```

### 14.4 Keypress Handling

```js
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.resume();

process.stdin.on('keypress', async (ch, key) => {
  if (key.ctrl && key.name === 'c' || ch === 'q') → exit
  if (ch === 'h') → show help, waitForKey, re-render menu
  
  const cmd = COMMANDS.find(c => c.key === ch);
  if (!cmd) → re-render (unknown key)
  
  // Restore terminal before running command
  restoreTerminal();
  
  if (isLongRunning(cmd)) {
    cmd.run([]);  // Takes over the process
  } else {
    await cmd.run([]);
    await waitForKey();  // "Press any key to continue…"
    showInteractiveMenu();  // Re-render
  }
});
```

### 14.5 Wait-for-Key Helper

After a blocking command completes, pause so the user can read the output before the screen clears:

```js
function waitForKey(prompt = '\n  Press any key to continue…') {
  return new Promise((resolve) => {
    process.stdout.write(C.dim(prompt));
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    process.stdin.on('keypress', (ch, key) => {
      if (key && key.ctrl && key.name === 'c') {
        process.exit(0);
      }
      // Restore and resolve
      process.stdin.removeAllListeners('keypress');
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve();
    });
  });
}
```

### 14.6 Terminal State Management

**Critical:** Always restore terminal state before running any command and after every keypress handler exit path. Failure to call `setRawMode(false)` leaves the terminal in an unusable state.

```js
function restoreTerminal() {
  process.stdin.removeAllListeners('keypress');
  try { process.stdin.setRawMode(false); } catch {}
  process.stdin.pause();
}
```

Wrap the entire keypress handler in try/catch to ensure restoration on unexpected errors:

```js
process.stdin.on('keypress', async (ch, key) => {
  try {
    // ... handle keypress
  } catch (e) {
    restoreTerminal();
    console.error(C.red(`Unexpected error: ${e.message}`));
    setImmediate(() => showInteractiveMenu());
  }
});
```

---

## 15. Argument Parser

Simple positional parser — first non-flag argument is the command, rest are flags:

```js
function parseArgs(argv) {
  const [first, ...rest] = argv;
  if (!first || first.startsWith('-')) return { command: null, flags: argv };
  return { command: first, flags: rest };
}
```

---

## 16. Entry Point

```js
async function main() {
  checkNodeVersion();
  checkWorkspaceRoot();

  const { command, flags } = parseArgs(process.argv.slice(2));

  // Direct CLI dispatch
  if (command === 'help') {
    printHelp();
    process.exit(0);
  }

  if (command !== null) {
    const cmd = COMMANDS.find(c => c.id === command);
    if (!cmd) {
      log(`\n✗ Unknown command: "${command}"`, 'red');
      log('  Run `node scripts/cli.js help` for a list.', 'dim');
      process.exit(1);
    }
    const result = cmd.run(flags);
    if (result && typeof result.then === 'function') await result;
    return;
  }

  // No command → interactive mode (requires TTY)
  if (!process.stdin.isTTY) {
    log('Usage: node scripts/cli.js [command]', 'dim');
    log('Run `node scripts/cli.js help` for a list.', 'dim');
    process.exit(1);
  }

  showInteractiveMenu();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

---

## 17. Reusable Build Script Pattern

A composite "build & maintain" command that chains multiple operations:

```js
function cmdBuild(args) {
  // 1. Sync version from changelog → package.json
  syncVersion();

  // 2. Run the project build
  runScript('build.js', args);

  // 3. Regenerate CTX context documentation (if using CTX Generator)
  cmdCtxGenerate(args);
}
```

### 17.1 Version Sync (changelog → package manifest)

Extract the version from `changelog.md` and write it to `package.json` (or `pyproject.toml`):

```js
function syncVersion() {
  const changelog = fs.readFileSync(CHANGELOG_FILE, 'utf8');
  const m = changelog.match(/^##\s+(?:\[|v)?(\d+\.\d+\.\d+)/m);
  if (!m) {
    log('⚠ Could not extract version from changelog.md', 'yellow');
    return;
  }

  const version = m[1];
  const pkgPath = path.join(WORKSPACE_ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  if (pkg.version !== version) {
    pkg.version = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    log(`✓ Updated package.json to ${version}`, 'green');
  } else {
    log(`✓ package.json already at ${version}`, 'green');
  }
}
```

### 17.2 CTX Generation with Whitespace Normalization

If the project uses [CTX Generator](https://github.com/context-hub/generator):

```js
function cmdCtxGenerate(args) {
  const ctxDir = path.join(WORKSPACE_ROOT, '.context');

  // 1. Clean previous output
  if (fs.existsSync(ctxDir)) {
    fs.rmSync(ctxDir, { recursive: true, force: true });
    log('Cleaned .context/', 'dim');
  }

  // 2. Run CTX Generator
  const result = spawnSync('ctx', ['generate', ...args], {
    cwd: WORKSPACE_ROOT,
    stdio: 'inherit',
    shell: IS_WIN,
  });
  if (result.status !== 0) {
    log('\n✗ ctx generate failed', 'red');
    process.exit(result.status ?? 1);
  }

  // 3. Normalize paths and line endings for cross-platform consistency
  normalizePaths(ctxDir);

  // 4. Write generation timestamp
  fs.writeFileSync(
    path.join(ctxDir, 'generated-at.txt'),
    new Date().toISOString() + '\n',
  );
}
```

### 17.3 CTX Path Normalizer

A post-processor that ensures CTX output is identical regardless of which OS generated it:

**What it normalizes:**
1. **Path separators** — CTX emits OS-native path separators in `### Path:` header lines and directory-tree drawings. On Windows, these contain backslashes. Replace with forward slashes.
2. **Line endings** — Normalize CRLF to LF so regenerating on a different OS never causes a full-file diff.

**What it preserves:**
- Content inside fenced code blocks (` ``` `) is never touched — source code backslashes are left intact.

**Algorithm:**

```js
function normalizeCtxPaths(dir) {
  const files = collectMarkdownFiles(dir);  // recursive
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Normalize line endings
    const lfContent = content.replace(/\r/g, '');
    if (lfContent !== content) { content = lfContent; changed = true; }

    // Normalize path separators (outside fenced blocks)
    const lines = content.split('\n');
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^(`{3,}|~{3,})/.test(lines[i])) { inFence = !inFence; continue; }
      if (inFence) continue;

      // CTX "Path:" headers: ### Path: `\dir\file.ts`
      const pathMatch = lines[i].match(/^(#{1,6}\s+Path:\s*`)([^`]+)(`.*)$/);
      if (pathMatch) {
        const normalized = pathMatch[2].replace(/\\/g, '/');
        if (normalized !== pathMatch[2]) {
          lines[i] = pathMatch[1] + normalized + pathMatch[3];
          changed = true;
        }
        continue;
      }

      // Directory tree lines: └── dir\subdir\
      const treeMatch = lines[i].match(/^(\s*(?:└──|├──|│\s+(?:└──|├──))\s+)(.+)$/);
      if (treeMatch) {
        const normalized = treeMatch[2].replace(/\\/g, '/');
        if (normalized !== treeMatch[2]) {
          lines[i] = treeMatch[1] + normalized;
          changed = true;
        }
      }
    }

    if (changed) {
      fs.writeFileSync(file, lines.join('\n'), 'utf8');
    }
  }
}
```

### 17.4 Changelog Version Extraction (for CI/CD)

A standalone script that parses the topmost changelog entry for release automation:

```js
// Header pattern: ## v{version} [-—] {title} (optional date)
const HEADER_RE = /^## (v[\d.]+(?:-\w+)?)\s+[-\u2014]\s+(.+?)(?:\s*\(\d{4}-\d{2}-\d{2}\))?$/;

let version = null, title = null, bodyLines = [];
let inEntry = false;

for (const line of content.split('\n')) {
  if (!inEntry) {
    const m = HEADER_RE.exec(line);
    if (m) { version = m[1]; title = m[2].trim(); inEntry = true; }
  } else {
    if (line.startsWith('## ')) break;  // Next entry → stop
    const trimmed = line.trim();
    if (trimmed.length > 0) bodyLines.push(trimmed);
  }
}
```

**Output modes:**
- **Local:** Print JSON to stdout: `{ version, title, body }`.
- **GitHub Actions:** Write step outputs in GITHUB_OUTPUT multiline format.

### 17.5 Version Sync Checker

A validation script that compares each module's changelog version against its manifest:

```js
const MODULES = [
  {
    name: 'my-module',
    changelog: path.join(ROOT, 'my-module', 'changelog.md'),
    manifest: path.join(ROOT, 'my-module', 'package.json'),
    readManifestVersion(filePath) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')).version || null;
    },
  },
  // ... more modules
];

// For each module: extract changelog version, compare with manifest version
// Exit 1 on any mismatch
```

Useful as a pre-commit hook guard.

---

## 18. Config File Scaffolding

Pattern for generating config files from a `.dist` template:

```js
function scaffoldConfig(distPath, targetPath, replacements, force = false) {
  if (fs.existsSync(targetPath) && !force) {
    log('  Config already exists. Use --force to overwrite.', 'yellow');
    return true;
  }

  if (!fs.existsSync(distPath)) {
    log(`  ✗ Template ${path.basename(distPath)} not found`, 'red');
    return false;
  }

  let template;
  try {
    template = JSON.parse(fs.readFileSync(distPath, 'utf8'));
  } catch (e) {
    log(`  ✗ Failed to parse template: ${e.message}`, 'red');
    return false;
  }

  // Walk and replace placeholder strings
  function replaceInObj(obj) {
    if (typeof obj === 'string') {
      for (const [placeholder, value] of Object.entries(replacements)) {
        obj = obj.replaceAll(placeholder, value);
      }
      return obj;
    }
    if (Array.isArray(obj)) return obj.map(replaceInObj);
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const k of Object.keys(obj)) out[k] = replaceInObj(obj[k]);
      return out;
    }
    return obj;
  }

  fs.writeFileSync(targetPath, JSON.stringify(replaceInObj(template), null, 2) + '\n', 'utf8');
  log(`  ✓ ${path.basename(targetPath)} written`, 'green');
  return true;
}
```

---

## 19. Git Hooks Installation

One-liner to activate workspace-local git hooks:

```js
function installGitHooks() {
  const r = sh('git', ['config', 'core.hooksPath', '.githooks']);
  if (r === 0) {
    log('✓ Git hooks installed. Pre-commit guard active.', 'green');
  }
  return r === 0;
}
```

The `.githooks/` directory lives in the repo and can contain any standard Git hook scripts.

---

## 20. Python Environment Support

For workspaces with a Python sub-project:

### 20.1 Python Finder

```js
function findPython() {
  const candidates = IS_WIN
    ? ['python', 'python3', 'py']
    : ['python3', 'python'];

  for (const cand of candidates) {
    const args = cand === 'py' ? ['-3', '--version'] : ['--version'];
    const r = spawnSync(cand, args, { encoding: 'utf8', shell: false });
    if (r.status !== 0) continue;

    const raw = (r.stdout || '') + (r.stderr || '');
    const m = raw.match(/Python (\d+)\.(\d+)/);
    if (!m) continue;
    if (parseInt(m[1], 10) === 3 && parseInt(m[2], 10) >= 11) return cand;
  }
  return null;
}
```

### 20.2 Venv Binary Resolver

```js
function venvBin(name) {
  return IS_WIN
    ? path.join(PROJECT_DIR, '.venv', 'Scripts', `${name}.exe`)
    : path.join(PROJECT_DIR, '.venv', 'bin', name);
}
```

### 20.3 Cleaning Partial pip Installs

After interrupted pip installs, tilde-prefixed `.dist-info` directories can remain:

```js
// Find and remove ~*.dist-info directories in site-packages
for (const entry of fs.readdirSync(sitePackages, { withFileTypes: true })) {
  if (entry.isDirectory() && entry.name.startsWith('~') && entry.name.endsWith('.dist-info')) {
    fs.rmSync(path.join(sitePackages, entry.name), { recursive: true, force: true });
  }
}
```

---

## 21. Multi-target Clean Command

An interactive file cleanup command that lets users select which target directories to clean:

```
  Select locations to clean:

  [1] VS Code Prompts (3 files)
  [2] Build Output (12 files)
  [3] Cache (empty)

  Enter numbers separated by commas, or a for all.
  Selection:
```

**Features:**
- Discovers files per target using configurable filter functions.
- Shows per-target file counts.
- Supports `--force` flag for non-interactive deletion (agent use).
- Shows file list before deletion.
- Confirmation prompt before destructive action.

---

## 22. Cross-Platform Checklist

| Concern | Solution |
|---------|----------|
| Path separators | Always use `path.join()` / `path.resolve()` |
| npm/pip commands | Use `npm.cmd` / `pip.cmd` on Windows |
| Shell spawning | Set `shell: IS_WIN` for `.cmd` wrappers |
| Python binary naming | Try `python3`, `python`, `py -3` in order |
| Venv binary location | `Scripts/` on Windows, `bin/` on Unix |
| Line endings | Normalize with `.replace(/\r/g, '')` |
| Screen clear | `\x1b[2J\x1b[0;0H` (works on all modern terminals) |
| Raw mode | Wrap `setRawMode` in try/catch for non-TTY environments |
| Home directory | Use `os.homedir()` — never hardcode `~` |
| Config paths (VS Code, etc.) | Platform-switch on `process.platform` |

---

## 23. Design Principles

1. **Single file, zero dependencies.** The entire CLI lives in one file using only Node.js built-ins. This eliminates version conflicts and keeps the tool always runnable.

2. **Dual-mode operation.** Every command works both interactively (menu) and non-interactively (direct CLI). CI pipelines use `node scripts/cli.js <command>`, humans use the menu.

3. **Fail fast, fail loud.** Pre-flight checks (`checkNodeVersion`, `checkWorkspaceRoot`) run at the very start. Commands exit with non-zero codes on failure.

4. **Terminal state is sacred.** Every code path that sets `rawMode(true)` must have a matching `rawMode(false)`. The safety-net try/catch in the keypress handler guarantees this.

5. **Commands are data.** The `COMMANDS` array is pure configuration. Adding a new command is a data change, not a structural change.

6. **Setup is idempotent.** Every setup component has a `detect()` function. Running setup twice is safe — already-completed components are skipped (unless explicitly re-selected).

7. **Cross-platform always.** No Unix-isms. No `grep`, `sed`, `which`. Everything uses Node.js APIs with platform-aware defaults.

8. **Changelog is the version source of truth.** The changelog drives version numbers, not the other way around. `package.json` versions are synced *from* the changelog.

---

## 24. Implementation Checklist

When building this CLI for a new project, follow this order:

- [ ] Create `scripts/cli.js` with the CommonJS boilerplate and section headers
- [ ] Implement constants, color helpers, logging
- [ ] Implement pre-flight checks (Node version, workspace root landmark)
- [ ] Implement version reader (changelog parsing)
- [ ] Implement the three script runners (sync, long-running, shell)
- [ ] Define the `COMMANDS` array with at least `setup`, `build`, and `help`
- [ ] Implement `printHelp()`
- [ ] Implement `parseArgs()`
- [ ] Implement `renderMenu()` with ASCII banner and category grouping
- [ ] Implement `showInteractiveMenu()` with keypress handling
- [ ] Implement `waitForKey()`
- [ ] Implement `restoreTerminal()`
- [ ] Implement the entry point (`main()`)
- [ ] Create `menu.sh` and `menu.cmd` launchers
- [ ] Define setup components for the project
- [ ] Implement the setup wizard (checkbox menu, `--all`, `--components`)
- [ ] Add project-specific commands (build, test, lint, etc.)
- [ ] Add CTX generation command (if applicable)
- [ ] Add version sync command (if multi-module)
- [ ] Test on Windows, macOS, and Linux
