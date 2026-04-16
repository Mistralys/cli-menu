import { enterRawMode, restoreTerminal } from '../raw-mode.js';
import { printHelp } from '../help.js';
import { waitForKey } from '../screen.js';
import { renderMenu } from './renderer.js';
import { runSetup } from '../setup/index.js';
import { log } from '../colors.js';
import type { Command, MenuConfig } from '../types.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Block until a single `keypress` event fires on stdin and return the
 * character string associated with it.
 *
 * The listener is registered with `on` and immediately removed when the first
 * event arrives (self-unregister pattern), making it safe to call in a loop.
 * The immediate removal ensures no stale listener survives into the command
 * execution body — consistent with the SIGINT cleanup contract defined in
 * `constraints.md §6`, which requires every handler registered during an
 * interactive session to be unregistered before control leaves the interactive
 * context.
 */
function waitForKeypress(): Promise<string> {
  return new Promise<string>((resolve) => {
    const onKey = (str: string | undefined): void => {
      process.stdin.off('keypress', onKey as Parameters<typeof process.stdin.on>[1]);
      resolve(str ?? '');
    };
    process.stdin.on('keypress', onKey as Parameters<typeof process.stdin.on>[1]);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the interactive keypress menu loop.
 *
 * The function enters raw mode, renders the menu, and waits for keypresses:
 *
 * - `q` — exit the menu cleanly.
 * - `h` — restore the terminal, print help, wait for a key, then re-render.
 * - Known hotkey — restore the terminal, invoke the matching command, then:
 *     - **Long-running** (command returns a `Promise`) — await it; no
 *       `waitForKey` is shown (the command owns stdio for its lifetime).
 *     - **Blocking** (command returns `void`) — show `waitForKey` so the
 *       user can read the output before the menu is re-rendered.
 *     - **Error** (sync throw or async rejection) — extract the message,
 *       print it via `log()`, show `waitForKey`, then re-render the menu.
 *       The loop is never terminated by a command error.
 * - Unknown key — re-render without taking any action.
 *
 * A `SIGINT` handler is registered for the entire session and unregistered
 * when the function resolves.
 *
 * **Empty-args contract:** every `Command.run` invocation inside this function
 * is called as `cmd.run([])`. The interactive menu has no access to the
 * original CLI argv, so commands must not rely on receiving flags here.
 *
 * @param config - Top-level menu configuration.
 */
export async function showInteractiveMenu(config: MenuConfig): Promise<void> {
  // Build a hotkey → command lookup (insertion order, first occurrence wins).
  const keymap = new Map<string, Command>();
  for (const cmd of config.commands) {
    if (cmd.key !== null && !cmd.hidden && !keymap.has(cmd.key)) {
      keymap.set(cmd.key, cmd);
    }
  }

  const sigintHandler = (): void => {
    process.off('SIGINT', sigintHandler);
    restoreTerminal();
    process.kill(process.pid, 'SIGINT');
  };

  process.on('SIGINT', sigintHandler);

  try {
    let running = true;
    while (running) {
      enterRawMode();
      renderMenu(config);

      const ch = await waitForKeypress();

      if (ch === 'q') {
        running = false;
      } else if (ch === 'h') {
        restoreTerminal();
        printHelp(config.commands, config);
        await waitForKey();
      } else {
        const cmd = keymap.get(ch);
        if (cmd !== undefined) {
          restoreTerminal();
          try {
            // Setup command: auto-wired to runSetup, same as the CLI dispatch.
            if (cmd.id === 'setup' && config.setupComponents !== undefined) {
              await runSetup(config.setupComponents, []);
              await waitForKey();
            } else {
              const result = cmd.run([]);
              if (result instanceof Promise) {
                // Long-running: command owns stdio — await silently.
                await result;
              } else {
                // Blocking: give the user a chance to read the output.
                await waitForKey();
              }
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            log(message);
            await waitForKey();
          }
        }
        // Unknown key → loop back and re-render (no action taken).
      }
    }
  } finally {
    process.off('SIGINT', sigintHandler);
    restoreTerminal();
  }
}
