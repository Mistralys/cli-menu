const RESET = '\x1b[0m';

const wrap = (code: string) => (text: string) => `\x1b[${code}m${text}${RESET}`;

/**
 * ANSI color and style helper functions.
 * Each function wraps the input string in the appropriate escape codes and
 * appends a reset sequence. Functions compose naturally:
 * `C.bold(C.cyan('text'))` produces nested ANSI sequences.
 */
export const C = {
  bold: wrap('1'),
  dim: wrap('2'),
  italic: wrap('3'),
  underline: wrap('4'),
  black: wrap('30'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  magenta: wrap('35'),
  cyan: wrap('36'),
  white: wrap('37'),
  gray: wrap('90'),
} as const;

/**
 * Union of all valid color/style names accepted by `log()`.
 */
export type Colors = keyof typeof C;

/**
 * Write a message to stdout, optionally wrapped in a color.
 * If `color` is not a valid key of `C`, the message is printed without styling.
 *
 * @param message - The text to output.
 * @param color   - Optional color/style name (must be a key of `C`).
 */
export function log(message: string, color?: string): void {
  if (color !== undefined && Object.hasOwn(C, color)) {
    process.stdout.write(C[color as Colors](message) + '\n');
  } else {
    process.stdout.write(message + '\n');
  }
}
