import type { ParsedArgs } from './types.js';
export type { ParsedArgs } from './types.js';

/**
 * Parse a `process.argv.slice(2)`-style array into a command name and flags.
 *
 * Rules:
 * - The first argument that does not start with `-` is the command.
 * - All remaining arguments after the command are collected as flags.
 * - If the first argument starts with `-`, the entire array is treated as flags
 *   and `command` is `null`. A command appearing after a leading flag is NOT extracted.
 * - Returns `{ command: null, flags: [] }` for empty input.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const [first, ...rest] = argv;
  if (!first || first.startsWith('-')) {
    return { command: null, flags: [...argv] };
  }
  return { command: first, flags: rest };
}
