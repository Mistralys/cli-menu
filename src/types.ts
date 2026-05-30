/**
 * Tuple representing a help display variant: [command string, description].
 */
export type HelpVariant = [command: string, description: string];

/** The result of parsing a `process.argv`-style array. */
export interface ParsedArgs {
  /** The first non-flag argument, or null when only flags (or nothing) were given. */
  command: string | null;
  /** All flag arguments (`--flag` or `-f` forms). */
  flags: string[];
}

/**
 * Type alias for a pre-flight check function.
 * The function should throw `PreflightError` on failure.
 */
export type PreflightCheck = () => void;

/**
 * A single command registered in the CLI menu.
 */
export interface Command {
  /** Unique identifier for the command. */
  id: string;
  /** Single-character key for interactive menu selection, or null for direct-mode-only commands. */
  key: string | null;
  /** Display label shown in the menu. */
  label: string;
  /** Category group name for visual grouping in the menu. */
  category: string;
  /** Short description shown alongside the command. */
  description: string;
  /**
   * Handler invoked when the command is selected.
   *
   * **Interactive dispatch:** when a command is triggered via the interactive
   * keypress menu, `args` is always `[]` — CLI flags are never forwarded.
   * Only direct-mode invocations (e.g. `node menu.js my-command --flag`)
   * receive a non-empty `args` array.
   *
   * **Error handling:** in the interactive menu, any error thrown synchronously
   * or a rejected `Promise` returned by `run` is caught automatically — the
   * message is printed to stdout and the menu re-renders. The loop is never
   * terminated by a command error.
   */
  run: (args: string[]) => void | Promise<void>;
  /** When true, the command is not shown in the interactive menu. */
  hidden?: boolean;
  /** When true, the command is excluded from help output. */
  helpHidden?: boolean;
  /** Alternative command-line forms shown in help output. */
  helpVariants?: HelpVariant[];
  /** Optional numeric sort key for ordering commands in help output. */
  helpOrder?: number;
}

/**
 * A setup wizard component representing a single installable sub-system.
 */
export interface SetupComponent {
  /** Unique identifier used with the `--components` flag. */
  id: string;
  /** Display label shown in the setup menu. */
  label: string;
  /** Short description shown alongside the label. */
  desc: string;
  /** Returns true if this component is already set up. */
  detect: () => boolean;
  /** Performs the setup. Receives extra args; returns true on success. */
  run: (args: string[]) => boolean;
  /** Post-run verification. Returns true if the component is valid. */
  validate: () => boolean;
}

/**
 * Top-level configuration for `createMenu()`.
 */
export interface MenuConfig {
  /** Display name for the menu application. */
  name: string;
  /** ASCII banner lines rendered at the top of the interactive menu. */
  banner: string[];
  /** Version string or a function returning a version string. */
  version: string | (() => string);
  /** List of commands registered in the menu. */
  commands: Command[];
  /** Optional setup wizard components. */
  setupComponents?: SetupComponent[];
  /** Optional pre-flight checks run at startup. */
  preflightChecks?: PreflightCheck[];
  /** Per-category version resolvers for multi-module workspaces. */
  categoryVersions?: Record<string, () => string>;
  /** Absolute path to the workspace root directory. */
  workspaceRoot: string;
  /** Custom usage line shown in help output (e.g. "node scripts/cli.js [command]").
   *  When omitted, `printHelp()` falls back to `process.argv[1]`. */
  usageLine?: string;
  /**
   * Optional status-line renderers shown below the version in the interactive
   * menu header. Each function is called synchronously on every render and its
   * return value is written indented by two spaces. When absent or empty, no
   * status block or extra blank line is injected.
   *
   * **Throw propagation:** exceptions thrown by a status-line function propagate
   * uncaught through `renderMenu()` — no error boundary is applied. This is
   * consistent with the existing contract for `version` and `categoryVersions`
   * callbacks. Ensure each function is safe to call, or wrap it in a try/catch.
   */
  statusLines?: Array<() => string>;
  /**
   * When `true`, `showInteractiveMenu` checks whether all `setupComponents`
   * entries are unconfigured (i.e. every `detect()` returns `false`). If so,
   * it enters a 2-second skippable window before invoking `onFirstRun`.
   * Has no effect when `setupComponents` is absent or empty.
   */
  firstRunRedirect?: boolean;
  /**
   * Called when `firstRunRedirect` is `true` and all `setupComponents` are
   * unconfigured. The function should present a scope-selection prompt and
   * return an array of `setupComponent` IDs to run. Returning an empty array
   * skips `runSetup` entirely.
   *
   * The terminal is restored to cooked mode before this function is called,
   * so readline-based prompts work correctly.
   */
  onFirstRun?: () => Promise<string[]>;
}

/**
 * Options accepted by the `sh()` shell runner function.
 */
export interface ScriptRunnerOptions {
  /** Working directory for the spawned process. */
  cwd?: string;
  /** When true, spawns the command through the OS shell. Defaults to true on Windows. */
  shell?: boolean;
  /**
   * Environment variables for the child process. When provided, this value
   * **replaces** the entire environment (Node.js does not merge with
   * `process.env`). To add variables while preserving the parent environment,
   * spread explicitly: `{ ...process.env, MY_VAR: 'value' }`.
   */
  env?: NodeJS.ProcessEnv;
}

/**
 * Represents a single parsed entry from a changelog file.
 */
export interface ChangelogEntry {
  /** Semantic version string prefixed with `v` (e.g., `"v1.2.3"`). */
  version: string;
  /** Release title from the changelog heading (text after the version). */
  title: string;
  /** Full body text of the changelog entry. */
  body: string;
}
