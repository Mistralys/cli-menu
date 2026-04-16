# Plan

## Summary

Restore visual parity between the `@mistralys/cli-menu` interactive menu
rendering and the original inline rendering from the AI Insights `scripts/cli.js`.
Four discrepancies have been identified by comparing the old (embedded) and new
(library-based) menu output. All four require changes in the **cli-menu library**
(`renderer.ts`); one also requires a banner data fix in the **AI Insights
consumer** (`scripts/cli.js`).

## Architectural Context

The interactive menu is rendered by `src/menu/renderer.ts` → `renderMenu(config)`.
It receives a `MenuConfig` which includes `name`, `banner`, `version`,
`commands` (each with `key`, `label`, `description`, `category`), and
`categoryVersions`.

The old embedded rendering (from `scripts/cli.js` at tag `1.18.0`) used this
format per command:

```js
const key   = C.cyan(`${cmd.key}.`);       // cyan "s."
const label = cmd.label.padEnd(26);          // label padded to 26 chars
const desc  = C.dim(cmd.description);        // dim description
console.log(`    ${key} ${label} ${desc}`);   // 4-space indent
```

And this for the version line:

```js
console.log(C.dim(`  Workspace CLI  ${version}\n`));
```

The current library renderer uses:

```js
process.stdout.write(`  [${cmd.key}] ${cmd.label}\n`);        // no color, no desc
process.stdout.write(C.dim(`  v${version}`) + '\n');           // no app name
```

## Approach / Architecture

All rendering changes are confined to `src/menu/renderer.ts` in the cli-menu
library. No new files, types, or dependencies are needed. The `MenuConfig`
interface already carries all required data (`name`, `description` on each
`Command`); the renderer simply doesn't use them yet.

The banner data fix is in the AI Insights consumer (`scripts/cli.js`); this is
not a library change.

## Rationale

The cli-menu library was extracted from the AI Insights CLI, so it should
reproduce the same visual output by default. The four gaps are straightforward
rendering omissions that occurred during extraction.

## Detailed Steps

### 1. Render the application name alongside the version

**File:** `cli-menu/src/menu/renderer.ts`

Change the version block from:

```ts
process.stdout.write(C.dim(`  v${version}`) + '\n');
```

To:

```ts
process.stdout.write(C.dim(`  ${config.name}  v${version}`) + '\n');
```

This restores the `Workspace CLI  v1.18.0` format. The `name` field already
exists on `MenuConfig` and is always provided.

### 2. Render command descriptions with column alignment

**File:** `cli-menu/src/menu/renderer.ts`

Change the command line from:

```ts
process.stdout.write(`  [${cmd.key}] ${cmd.label}\n`);
```

To a format that matches the original styling:

```ts
const key   = C.cyan(`${cmd.key}.`);
const label = cmd.label.padEnd(26);
const desc  = C.dim(cmd.description);
process.stdout.write(`    ${key} ${label}${desc}\n`);
```

Key changes:
- **Indent:** 4 spaces (was 2).
- **Key format:** `s.` instead of `[s]`.
- **Key color:** cyan via `C.cyan()`.
- **Description:** rendered in dim after padded label.
- **Column alignment:** label padded to 26 characters so descriptions align.

### 3. Fix the banner character offset (AI Insights consumer fix)

**File:** `ai-insights/scripts/cli.js`

Two banner lines lost one column character from the "G" glyph during the
extraction. Restore the original data:

Line 6 — change:
```
'██║  ██║██║   ██║██║ ╚████║███████║██║╚█████╔╝██║  ██║   ██║   ███████║',
```
to:
```
'██║  ██║██║   ██║██║ ╚████║███████║██║╚██████╔╝██║  ██║   ██║   ███████║',
```

Line 7 — change:
```
'╚═╝  ╚═╝╚═╝   ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝ ╚════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝',
```
to:
```
'╚═╝  ╚═╝╚═╝   ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝',
```

(One `█` added in symbol 6, one `═` added in symbol 7, restoring proper glyph
width for the "G" letter.)

### 4. Update tests

**File:** `cli-menu/tests/menu/renderer.test.ts` (or equivalent test file)

Update any snapshot or assertion tests that verify the rendered output to match
the new format:
- `s. Label` format instead of `[s] Label`.
- Cyan-colored key.
- Description text appended.
- Application name in the version line.

## Dependencies

- Step 2 depends on no other step.
- Step 1 depends on no other step.
- Step 3 is in a different repository (ai-insights), independent of steps 1–2.
- Step 4 depends on steps 1 and 2 being finalized first.

## Required Components

- `cli-menu/src/menu/renderer.ts` — rendering logic changes (steps 1, 2)
- `ai-insights/scripts/cli.js` — banner data fix (step 3)
- `cli-menu/tests/menu/renderer.test.ts` — test updates (step 4)

## Assumptions

- The old rendering at tag `1.18.0` is the reference target for visual parity.
- The 26-character pad width for label alignment is correct for the current
  command set. If future labels exceed 26 characters, the alignment degrades
  gracefully (description immediately follows label with one space).
- The `description` field is always populated on interactive commands (all
  current AI Insights commands have it).

## Constraints

- Zero production dependencies (cli-menu constraint §1).
- No `process.exit()` in library code (cli-menu constraint §2).
- Changes confined to rendering; no `MenuConfig` type changes needed.
- Cross-platform: only ANSI color codes are used, which work on all supported
  terminals (Windows Terminal, macOS Terminal, most Linux terminals).

## Out of Scope

- Help output formatting (`printHelp`) — not affected by these changes.
- Setup wizard / checkbox menu rendering — not affected.
- Adding new `MenuConfig` fields or changing the public API.

## Acceptance Criteria

- Running the AI Insights CLI (`node scripts/cli.js`) with no arguments shows:
  1. The banner with correct "G" glyph alignment (no offset from "H" onward).
  2. `Workspace CLI  v1.18.0` (or current version) below the banner.
  3. Each menu item formatted as `    s. First-time setup          Full workspace setup wizard`
     with cyan-colored `s.` and dim description text.
  4. Category headers with bold category name and dim sub-version.
- All cli-menu tests pass after the changes.

## Testing Strategy

- Run existing cli-menu tests (`npm test` in cli-menu) to catch regressions.
- Manually verify the AI Insights CLI menu rendering matches the first
  screenshot (old version).
- If `renderer.test.ts` has output assertions, update them to match the new
  format.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Pad width too narrow for long labels** | 26 chars matches the original; can be made configurable later if needed. |
| **ANSI color codes break in non-TTY** | `renderMenu` is only called from `showInteractiveMenu`, which is TTY-gated. |
| **Banner fix is in the wrong repo** | Clearly separated as step 3; consumer and library are in the same workspace. |
