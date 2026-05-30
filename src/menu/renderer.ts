import { C } from '../colors.js';
import { clearScreen } from '../screen.js';
import { resolveVersion } from '../version.js';
import type { Command, MenuConfig } from '../types.js';

/**
 * Render the interactive menu to stdout.
 *
 * Clears the screen, then writes:
 * 1. Each banner line in cyan.
 * 2. The resolved version in dim.
 * 3. Commands grouped by category. Each category header is bold; when a
 *    matching entry exists in `config.categoryVersions` the resolved
 *    sub-project version is appended in dim. Only commands with a non-null
 *    `key` that are not `hidden` are rendered.
 * 4. A `[h] Help  [q] Quit` footer line.
 * 5. A `Choose: ` prompt (no trailing newline — cursor stays on line).
 *
 * @param config - Top-level menu configuration.
 */
export function renderMenu(config: MenuConfig): void {
  clearScreen();

  // Banner
  for (const line of config.banner) {
    process.stdout.write(C.cyan(line) + '\n');
  }
  process.stdout.write('\n');

  // Version
  const version = resolveVersion(config);
  process.stdout.write(C.dim(`  ${config.name}  v${version}`) + '\n');
  process.stdout.write('\n');

  // Status lines (optional — renders immediately after the version block)
  if (config.statusLines?.length) {
    for (const fn of config.statusLines) {
      process.stdout.write('  ' + fn() + '\n');
    }
    process.stdout.write('\n');
  }

  // Commands grouped by category (insertion order of first occurrence).
  // Excluded from the interactive menu: hidden:true (not shown anywhere) or
  // key:null (CLI-only commands). helpHidden commands are intentionally included
  // here — that flag only suppresses output in printHelp(), not the menu.
  const interactive: Command[] = config.commands.filter((c) => !c.hidden && c.key !== null);

  const categoryOrder: string[] = [];
  const categoryMap = new Map<string, Command[]>();
  for (const cmd of interactive) {
    if (!categoryMap.has(cmd.category)) {
      categoryOrder.push(cmd.category);
      categoryMap.set(cmd.category, []);
    }
    categoryMap.get(cmd.category)!.push(cmd);
  }

  for (const category of categoryOrder) {
    const subVersion = config.categoryVersions?.[category]?.();
    const versionSuffix = subVersion ? `  ${C.dim(`v${subVersion}`)}` : '';
    process.stdout.write(C.bold(`  ${category}`) + versionSuffix + '\n');

    for (const cmd of categoryMap.get(category)!) {
      const key   = C.cyan(`${cmd.key}.`);
      const label = cmd.label.padEnd(26);
      const desc  = C.dim(cmd.description);
      process.stdout.write(`    ${key} ${label}${desc}\n`);
    }
    process.stdout.write('\n');
  }

  // Footer
  process.stdout.write(`  ${C.dim('[h] Help')}  ${C.dim('[q] Quit')}` + '\n');
  process.stdout.write('\n');

  // Prompt (no trailing newline)
  process.stdout.write('  Choose: ');
}
