# Data Flows — @mistralys/cli-menu

---

## 1. Build Pipeline

```
npm run build
    │
    ├─ prebuild: rm -rf dist/
    │
    └─ tsup
         ├─ Entry: src/index.ts          → dist/index.{js,cjs,d.ts}
         └─ Entry: src/changelog/index.ts → dist/changelog/index.{js,cjs,d.ts}
              │
              ├─ tree-shake
              ├─ dual CJS + ESM output
              └─ source maps + DTS
```

---

## 2. `createMenu()` Construction

```
createMenu(config)
    │
    ├─ validateCommandKeys(config)
    │       for each cmd where cmd.key !== null:
    │           assert cmd.key.length === 1  (throws Error on violation)
    │
    └─ return { run(argv) }
```

---

## 3. `run(argv)` Dispatch

```
run(argv)
    │
    ├─ Step 1: Pre-flight checks
    │       for each check in config.preflightChecks:
    │           try { check() }
    │           catch PreflightError → stderr + return exitCode
    │           catch other         → rethrow
    │
    ├─ parseArgs(argv) → { command, flags }
    │
    ├─ Step 2: command === 'help'
    │       │   printHelp(config.commands, config) → return 0
    │       │
    ├─ Step 3: command === 'setup' && setupComponents defined
    │       │   runSetup(config.setupComponents, flags) → return exit code
    │       │
    ├─ Step 4: command !== null
    │       │   find cmd where cmd.id === command && !cmd.hidden
    │       │   not found → stderr + return 1
    │       │   found → cmd.run(flags) [sync or async] → return 0
    │       │
    ├─ Step 6: !command && process.stdin.isTTY
    │       │   showInteractiveMenu(config) → return 0
    │       │
    └─ Step 7: !command && !process.stdin.isTTY
                stderr + return 1
```

---

## 4. Interactive Menu Loop (`showInteractiveMenu`)

```
showInteractiveMenu(config)
    │
    ├─ Register SIGINT handler (calls restoreTerminal + re-raises)
    │
    ├─ First-run redirect (pre-loop — runs only when all four conditions are met):
    │       Conditions: config.firstRunRedirect === true
    │                 + config.onFirstRun !== undefined
    │                 + config.setupComponents.length > 0
    │                 + every setupComponent.detect() === false
    │       │
    │       ├─ enterRawMode()
    │       ├─ write: "First-run setup wizard — press [q] within 2 seconds to skip."
    │       ├─ waitForSkip(2000)      ← q cancels within window; timeout continues
    │       ├─ restoreTerminal()      ← before onFirstRun (cooked mode for readline)
    │       └─ if not skipped:
    │               componentIds = await config.onFirstRun()
    │               if componentIds.length > 0:
    │                   runSetup(setupComponents, ['--components=<ids>'])
    │
    └─ loop:
           enterRawMode()
           renderMenu(config):
               clearScreen()
               banner lines (cyan)
               version line (dim)
               statusLines block (optional):
                   for each fn in config.statusLines: write '  ' + fn() + '\n'
                   blank line after block (omitted when statusLines absent/empty)
               commands grouped by category (bold header + optional sub-version)
               [h] Help  [q] Quit footer
               "Choose: " prompt (no trailing newline)
           │
           waitForKeypress()
           │
           ├─ 'q'     → break (exit loop cleanly)
           │
           ├─ 'h'     → restoreTerminal()
           │             printHelp(config.commands, config)
           │             waitForKey()
           │             enterRawMode()
           │             renderMenu(config)
           │             continue
           │
           ├─ known   → restoreTerminal()
           │   hotkey    cmd.run(flags)
           │             if Promise (long-running): await (no waitForKey)
           │             if void   (blocking):      waitForKey(); enterRawMode(); renderMenu()
           │             continue
           │
           └─ unknown  → renderMenu(config), continue (no action)

    exit loop:
        restoreTerminal()
        unregister SIGINT handler
```

---

## 5. Setup Wizard Flow (`runSetup`)

```
runSetup(components, args)
    │
    ├─ Non-TTY guard: if !process.stdin.isTTY && no --all / --components flag
    │       stderr: "interactive setup requires a TTY (use --all or --components)"
    │       return 1
    │
    ├─ resolveSelectedIds(components, args)
    │       --all              → all component IDs
    │       --components=a,b   → split on comma
    │       --components a,b   → next arg split on comma
    │       none (TTY)         → runCheckboxMenu(components) → selected IDs (or null = cancel)
    │
    ├─ for each selected component:
    │       detect() already done → skip run
    │       run(args) → record result
    │       validate() → update success flag
    │
    ├─ printSummary(results)
    │
    └─ return 0 if all succeeded, 1 if any failed
```

---

## 6. Checkbox TUI Flow (`runCheckboxMenu`)

```
runCheckboxMenu(components)
    │
    ├─ Register SIGINT handler
    ├─ enterRawMode()
    ├─ Render: each component with [x]/[ ] state; pre-detected show "(done)"
    │
    └─ loop: waitForKeypress()
           │
           ├─ ↑ / 'k'   → move cursor up
           ├─ ↓ / 'j'   → move cursor down
           ├─ ' '        → toggle selected item
           ├─ 'a'        → toggle all items
           ├─ Enter      → break (run selected)
           └─ 'q'        → break (cancel)

    if cancelled → restoreTerminal() → return null
    if confirmed → restoreTerminal() → return selected IDs
```

---

## 7. Help Rendering (`printHelp`)

```
printHelp(commands, config)
    │
    ├─ Resolve version: resolveVersion(config)
    ├─ Filter: remove hidden:true and helpHidden:true
    ├─ Stable sort by helpOrder (Infinity for unset)
    ├─ Group by category (insertion order)
    │
    ├─ Print: name + version header
    ├─ Print: usageLine (config.usageLine ?? process.argv[1])
    │
    └─ for each category:
           print category header
           for each command:
               print command line (id, description)
               for each helpVariant: print variant line
           append synthetic 'help' entry unless id:'help' already present
```

---

## 8. Context Merge Order (No-Op)

This library has no template context or merge logic. All configuration is passed explicitly
via `MenuConfig` — there is no ambient config resolution or file-based discovery.
