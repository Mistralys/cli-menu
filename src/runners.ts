import { spawnSync, spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { ScriptRunnerOptions } from './types.js';

/** True when the current platform is Windows. */
export const IS_WIN: boolean = process.platform === 'win32';

/**
 * The npm executable name for the current platform.
 * On Windows, npm is installed as `npm.cmd` and requires shell invocation or
 * the `.cmd` extension when passed directly to `spawnSync`.
 */
export const NPM: string = IS_WIN ? 'npm.cmd' : 'npm';

/**
 * Synchronous script runner. Spawns `command` with the given `args`, inherits
 * stdio so output streams directly to the terminal, and returns the numeric
 * exit code when the child exits.
 *
 * Does NOT call `process.exit()` — callers decide how to handle non-zero codes.
 *
 * @param command - The executable to run.
 * @param args    - Arguments to pass to the command.
 * @param options - Optional spawn options (cwd, shell, env).
 * @returns The child process exit code, or `1` if the code is unavailable.
 */
export function runScript(
  command: string,
  args: string[] = [],
  options: ScriptRunnerOptions = {},
): number {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });
  return result.status ?? 1;
}

/**
 * Long-running asynchronous script runner. Spawns `command` with the given
 * `args` and returns immediately with the `ChildProcess` handle and a
 * `Promise` that resolves to the exit code when the child exits.
 *
 * Does NOT attach signal handlers or call `process.exit()` — callers are
 * responsible for forwarding signals and acting on the resolved exit code.
 *
 * @param command - The executable to run.
 * @param args    - Arguments to pass to the command.
 * @param options - Optional spawn options (cwd, shell, env).
 * @returns `{ child, exitCode }` — the ChildProcess and a Promise<number>.
 */
export function runLongScript(
  command: string,
  args: string[] = [],
  options: ScriptRunnerOptions = {},
): { child: ChildProcess; exitCode: Promise<number> } {
  const child = spawn(command, args, {
    stdio: 'inherit',
    ...options,
  });

  const exitCode = new Promise<number>((resolve) => {
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });

  return { child, exitCode };
}

/**
 * Non-fatal shell runner. Spawns `command` synchronously and returns the exit
 * code — never throws or calls `process.exit()`, making it suitable for setup
 * sequences where partial failures are recoverable.
 *
 * Defaults `shell` to `true` on Windows so `.cmd` wrapper scripts
 * (`npm.cmd`, `pip.cmd`) resolve correctly under Node 22+.
 *
 * **Security note:** When `shell` is `true`, Node.js joins `args` with spaces
 * before passing to the OS shell. Never pass untrusted user input as `args`
 * when the shell is enabled — doing so enables command injection.
 *
 * @param command - The executable or shell command to run.
 * @param args    - Arguments to pass to the command.
 * @param options - Optional spawn options. `shell` defaults to `IS_WIN`.
 * @returns `0` on success, non-zero on failure.
 */
export function sh(
  command: string,
  args: string[] = [],
  options: ScriptRunnerOptions = {},
): number {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: IS_WIN,
    ...options,
  });
  return result.status ?? 1;
}
