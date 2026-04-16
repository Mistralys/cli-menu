import { enterRawMode, restoreTerminal } from './raw-mode.js';

/** ANSI escape sequence that clears the screen and moves the cursor to (0,0). */
const CLEAR_SEQUENCE = '\x1b[2J\x1b[0;0H';

/**
 * Clears the terminal screen using ANSI escape sequences.
 *
 * In non-TTY environments (CI, piped output) this is a no-op so ANSI
 * escape sequences are never written to a plain stream.
 */
export function clearScreen(): void {
  if (!process.stdout.isTTY) return;
  process.stdout.write(CLEAR_SEQUENCE);
}

/**
 * Waits for a single keypress, then resolves.
 *
 * In non-TTY environments (CI, piped input) the promise resolves immediately
 * without blocking, so callers are safe to call this unconditionally.
 *
 * @param prompt - Message displayed while waiting. Pass an empty string to
 *                 suppress output.
 */
export function waitForKey(
  prompt = '\n  Press any key to continue…',
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!process.stdin.isTTY) {
      resolve();
      return;
    }

    if (prompt.length > 0) {
      process.stdout.write(prompt);
    }

    enterRawMode();

    process.stdin.once('keypress', () => {
      restoreTerminal();
      resolve();
    });
  });
}
