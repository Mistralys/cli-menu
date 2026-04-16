import readline from 'node:readline';

/**
 * Returns true when stdin is a TTY and raw mode is available.
 * Returns false in non-TTY environments (CI, piped input, etc.).
 */
export function isRawModeSupported(): boolean {
  return process.stdin.isTTY === true;
}

/**
 * Enables raw mode on stdin so individual keypresses can be read
 * without waiting for Enter. Also enables keypress event emission.
 *
 * In non-TTY environments this function is a no-op.
 */
export function enterRawMode(): void {
  if (!isRawModeSupported()) return;
  try {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
  } catch {
    // Not a TTY or raw mode not available — silently ignore.
  }
}

/**
 * Disables raw mode on stdin and pauses the stream.
 * Safe to call even when raw mode was never activated.
 *
 * Use `exitRawMode()` for lightweight teardown when no keypress listeners
 * were registered. For full cleanup after an interactive keypress session,
 * prefer `restoreTerminal()` which also removes keypress event listeners.
 */
export function exitRawMode(): void {
  try {
    process.stdin.setRawMode(false);
  } catch {
    // Not a TTY or already restored — silently ignore.
  }
  process.stdin.pause();
}

/**
 * Fully restores the terminal to a known-clean state.
 * Removes all keypress event listeners, disables raw mode, and pauses stdin.
 * Safe to call multiple times — each individual operation is idempotent.
 */
export function restoreTerminal(): void {
  process.stdin.removeAllListeners('keypress');
  try {
    process.stdin.setRawMode(false);
  } catch {
    // Not a TTY or already restored — silently ignore.
  }
  process.stdin.pause();
}
