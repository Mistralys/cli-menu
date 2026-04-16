import { parseArgs } from './parser.js';
import { printHelp } from './help.js';
import { PreflightError } from './preflight.js';
import { showInteractiveMenu } from './menu/index.js';
import { runSetup } from './setup/index.js';
import type { MenuConfig } from './types.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Validate that every `Command` with a non-null `key` has exactly one character.
 *
 * Called on construction so misconfigured menus fail immediately rather than
 * producing silent hotkey collisions or impossible-to-trigger keys at runtime.
 *
 * @throws {Error} When any `Command.key` has a length other than 1.
 */
function validateCommandKeys(config: MenuConfig): void {
  for (const cmd of config.commands) {
    if (cmd.key !== null && cmd.key.length !== 1) {
      throw new Error(
        `Command "${cmd.id}" has an invalid key "${cmd.key}" (${cmd.key.length} characters). ` +
          `Command.key must be exactly one character or null.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create the main menu entry point.
 *
 * **Construction:** validates `Command.key` values — throws a descriptive error
 * if any key has a length other than 1.
 *
 * **`run(argv)` dispatch order:**
 * 1. Pre-flight checks (if any). A `PreflightError` maps to its `exitCode`.
 * 2. `help` command → `printHelp`, returns `0`.
 * 3. `setup` command (when `setupComponents` is defined) → `runSetup`, returns its exit code.
 * 4. Known direct command → `cmd.run(flags)`, returns `0`.
 * 5. Unknown command → stderr error, returns `1`.
 * 6. No command, stdin is TTY → `showInteractiveMenu`, returns `0`.
 * 7. No command, stdin is not TTY → stderr error, returns `1`.
 *
 * **Never calls `process.exit()`** — the caller is responsible for acting on
 * the returned exit code.
 *
 * @param config - Top-level menu configuration.
 * @returns `{ run(argv: string[]): Promise<number> }`.
 */
export function createMenu(config: MenuConfig): { run(argv: string[]): Promise<number> } {
  validateCommandKeys(config);

  return {
    async run(argv: string[]): Promise<number> {
      // Step 1: Pre-flight checks.
      for (const check of config.preflightChecks ?? []) {
        try {
          check();
        } catch (err: unknown) {
          if (err instanceof PreflightError) {
            process.stderr.write(`Error: ${err.message}\n`);
            return err.exitCode;
          }
          throw err;
        }
      }

      const { command, flags } = parseArgs(argv);

      // Step 2: Help dispatch.
      if (command === 'help') {
        printHelp(config.commands, config);
        return 0;
      }

      // Step 3: Setup dispatch (auto-wired when setupComponents are defined).
      if (command === 'setup' && config.setupComponents !== undefined) {
        return runSetup(config.setupComponents, flags);
      }

      // Step 4: Direct command dispatch.
      if (command !== null) {
        const cmd = config.commands.find((c) => c.id === command && !c.hidden);
        if (cmd === undefined) {
          process.stderr.write(`Unknown command: ${command}\n`);
          return 1;
        }
        const result = cmd.run(flags);
        if (result instanceof Promise) {
          await result;
        }
        return 0;
      }

      // Steps 6–7: No command given.
      if (!process.stdin.isTTY) {
        process.stderr.write(
          `No command given. Use 'help' to see available commands.\n`,
        );
        return 1;
      }

      await showInteractiveMenu(config);
      return 0;
    },
  };
}
