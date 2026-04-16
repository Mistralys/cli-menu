import { C } from './colors.js';
import type { Command, MenuConfig } from './types.js';
import { resolveVersion } from './version.js';

/** Width (in characters) reserved for the command name column. */
const CMD_WIDTH = 28;

/**
 * Format a single command-line entry (name padded + dim description).
 */
function formatEntry(name: string, description: string): string {
  return `  ${name.padEnd(CMD_WIDTH)}${C.dim(description)}`;
}

/**
 * Print formatted help output to stdout.
 *
 * Commands are filtered, sorted, and grouped by category:
 * - Commands with `hidden: true` or `helpHidden: true` are excluded.
 * - Commands with `helpOrder` are sorted numerically (ascending); commands
 *   without `helpOrder` retain their insertion order relative to each other.
 * - Each category is printed as a bold header followed by its commands.
 * - `helpVariants` are rendered immediately after their parent command.
 * - A synthetic `help` entry is appended last unless the command list
 *   already contains a command with `id: 'help'`, in which case the
 *   synthetic entry is suppressed to prevent duplicates.
 *
 * @param commands - The full command registry.
 * @param config   - Top-level menu configuration (name, version, etc.).
 */
export function printHelp(commands: Command[], config: MenuConfig): void {
  const version = resolveVersion(config);

  process.stdout.write(`${config.name} — v${version}\n`);
  process.stdout.write('\n');
  const usage = config.usageLine ?? process.argv[1];
  process.stdout.write(`Usage: ${usage}\n`);
  process.stdout.write('\nCommands:\n');

  // Exclude commands that should not appear in help output.
  const visible = commands.filter((c) => !c.hidden && !c.helpHidden);

  // Stable sort by helpOrder (undefined → Infinity).
  // Array.prototype.sort is stable (ES2019+), so commands sharing the same
  // effective sort key retain their original insertion order.
  const sorted = [...visible].sort((a, b) => {
    const ao = a.helpOrder ?? Infinity;
    const bo = b.helpOrder ?? Infinity;
    if (ao !== bo) return ao - bo;
    return 0;
  });

  // Derive category display order from first appearance in the sorted list.
  const categories = [...new Set(sorted.map((c) => c.category))];

  for (const cat of categories) {
    const cmds = sorted.filter((c) => c.category === cat);
    process.stdout.write(`\n  ${C.bold(cat)}\n`);
    for (const cmd of cmds) {
      process.stdout.write(formatEntry(cmd.id, cmd.description) + '\n');
      for (const [variant, desc] of (cmd.helpVariants ?? [])) {
        process.stdout.write(formatEntry(variant, desc) + '\n');
      }
    }
  }

  // Synthetic help entry — skip when the caller already registered a 'help' command.
  const hasHelpCommand = commands.some((c) => c.id === 'help');
  if (!hasHelpCommand) {
    process.stdout.write('\n' + formatEntry('help', 'Show this help') + '\n');
  }
  process.stdout.write('\nRun without arguments for interactive mode.\n');
}
