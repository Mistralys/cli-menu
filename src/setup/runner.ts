import { C } from '../colors.js';
import type { SetupComponent } from '../types.js';
import { runCheckboxMenu } from './checkbox-menu.js';

/** Flag that selects every registered component without prompting. */
const FLAG_ALL = '--all';

/** Flag prefix for a comma-separated component ID list. */
const FLAG_COMPONENTS_PREFIX = '--components=';

/** Older two-token form: `--components a,b`. */
const FLAG_COMPONENTS = '--components';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveSelectedIds(
  components: SetupComponent[],
  args: string[],
): { ids: string[] | null; error: string | null } {
  if (args.includes(FLAG_ALL)) {
    return { ids: components.map((c) => c.id), error: null };
  }

  // --components=a,b (single-token form)
  const equalsArg = args.find((a) => a.startsWith(FLAG_COMPONENTS_PREFIX));
  if (equalsArg !== undefined) {
    const raw = equalsArg.slice(FLAG_COMPONENTS_PREFIX.length).trim();
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      return { ids: null, error: `No component IDs supplied to ${FLAG_COMPONENTS_PREFIX}.` };
    }
    return { ids, error: null };
  }

  // --components a,b (two-token form)
  const flagIdx = args.indexOf(FLAG_COMPONENTS);
  if (flagIdx !== -1) {
    const next = args[flagIdx + 1];
    if (!next || next.startsWith('-')) {
      return {
        ids: null,
        error: `${FLAG_COMPONENTS} requires a comma-separated list of component IDs.`,
      };
    }
    const ids = next
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      return { ids: null, error: `No component IDs supplied to ${FLAG_COMPONENTS}.` };
    }
    return { ids, error: null };
  }

  return { ids: null, error: null };
}

function printSummary(results: Array<{ component: SetupComponent; success: boolean }>): void {
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  process.stdout.write('\n');
  process.stdout.write(C.bold('  Setup summary') + '\n');
  process.stdout.write(C.dim('  ─────────────────────────────') + '\n');

  for (const { component, success } of results) {
    const tag = success ? C.green('  ✔') : C.red('  ✘');
    process.stdout.write(`${tag}  ${component.label}\n`);
  }

  process.stdout.write(C.dim('  ─────────────────────────────') + '\n');

  const passStr = C.green(`${passed} succeeded`);
  const failStr = failed > 0 ? C.red(`${failed} failed`) : C.dim(`${failed} failed`);
  process.stdout.write(`  ${passStr}  ${failStr}\n\n`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Orchestrate the setup wizard for a list of components.
 *
 * Selection logic (in priority order):
 * 1. `--all` → run all components.
 * 2. `--components=a,b` or `--components a,b` → run the named subset.
 * 3. TTY available → show the interactive checkbox menu.
 * 4. Non-TTY, no flag → print an error and return exit code 1.
 *
 * After running the selected components a summary table is printed.
 *
 * @param components - All available setup wizard components.
 * @param args       - Raw CLI arguments (e.g. `process.argv.slice(2)`).
 * @returns `0` when all selected components succeeded; `1` otherwise.
 */
export async function runSetup(components: SetupComponent[], args: string[]): Promise<number> {
  if (components.length === 0) {
    process.stdout.write(C.dim('  No setup components registered.\n'));
    return 0;
  }

  const { ids: resolvedIds, error } = resolveSelectedIds(components, args);

  if (error !== null) {
    process.stderr.write(C.red(`  Error: ${error}\n`));
    return 1;
  }

  let selectedIds: string[];

  if (resolvedIds !== null) {
    selectedIds = resolvedIds;
  } else {
    // No flag given — try interactive mode if TTY is available.
    if (!process.stdin.isTTY) {
      process.stderr.write(
        C.red(
          '  Error: No TTY detected. Use --all or --components=<ids> to run setup non-interactively.\n',
        ),
      );
      return 1;
    }

    const chosen = await runCheckboxMenu(components);
    if (chosen === null) {
      // User cancelled.
      process.stdout.write(C.dim('  Setup cancelled.\n'));
      return 0;
    }
    selectedIds = chosen;
  }

  if (selectedIds.length === 0) {
    process.stdout.write(C.dim('  No components selected.\n'));
    return 0;
  }

  const selected = selectedIds
    .map((id) => components.find((c) => c.id === id))
    .filter((c): c is SetupComponent => c !== undefined);

  if (selected.length === 0) {
    process.stderr.write(C.red('  Error: None of the specified component IDs matched.\n'));
    return 1;
  }

  const results: Array<{ component: SetupComponent; success: boolean }> = [];

  for (const component of selected) {
    const success = component.run(args);
    results.push({ component, success });
  }

  printSummary(results);

  return results.every((r) => r.success) ? 0 : 1;
}
