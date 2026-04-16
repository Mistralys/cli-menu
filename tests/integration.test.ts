/**
 * Integration tests for `createMenu()`.
 *
 * These tests exercise the full dispatch pipeline end-to-end using a minimal
 * config. Unlike the unit tests in `create-menu.test.ts`, `printHelp` is not
 * mocked — real stdout output is captured and asserted. Only the interactive
 * terminal (`showInteractiveMenu`) is stubbed because it requires an
 * interactive TTY that is not available in CI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMenu } from '../src/create-menu.js';
import * as menuModule from '../src/menu/index.js';
import { PreflightError } from '../src/preflight.js';
import type { MenuConfig } from '../src/types.js';

// ---------------------------------------------------------------------------
// Minimal test config
// ---------------------------------------------------------------------------

function makeIntegrationConfig(overrides: Partial<MenuConfig> = {}): MenuConfig {
  return {
    name: 'Integration Test Menu',
    banner: ['--- integration ---'],
    version: '1.2.3',
    workspaceRoot: '/tmp/integration',
    usageLine: 'node menu.js',
    commands: [
      {
        id: 'some-command',
        key: 's',
        label: 'Some Command',
        category: 'General',
        description: 'A real command for integration testing',
        run: () => {},
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Output capture helpers
// ---------------------------------------------------------------------------

/** Collect all strings written to process.stdout and process.stderr. */
function captureOutput(): { stdout: string[]; stderr: string[]; combined(): string } {
  const stdout: string[] = [];
  const stderr: string[] = [];

  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr.push(String(chunk));
    return true;
  });

  return {
    stdout,
    stderr,
    combined: () => [...stdout, ...stderr].join(''),
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('integration: createMenu()', () => {
  beforeEach(() => {
    // Only stub the interactive menu — everything else runs for real.
    vi.spyOn(menuModule, 'showInteractiveMenu').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC1: run(['help']) returns 0 with expected output
  // -------------------------------------------------------------------------

  describe("run(['help'])", () => {
    it('returns exit code 0', async () => {
      captureOutput();
      const menu = createMenu(makeIntegrationConfig());
      const code = await menu.run(['help']);
      expect(code).toBe(0);
    });

    it('writes the menu name and version to stdout', async () => {
      const { stdout } = captureOutput();
      const menu = createMenu(makeIntegrationConfig());
      await menu.run(['help']);
      const out = stdout.join('');
      expect(out).toContain('Integration Test Menu');
      expect(out).toContain('v1.2.3');
    });

    it('writes a Commands section listing registered commands', async () => {
      const { stdout } = captureOutput();
      const menu = createMenu(makeIntegrationConfig());
      await menu.run(['help']);
      const out = stdout.join('');
      expect(out).toContain('Commands:');
      expect(out).toContain('some-command');
    });

    it('includes the usage line in help output', async () => {
      const { stdout } = captureOutput();
      const menu = createMenu(makeIntegrationConfig());
      await menu.run(['help']);
      const out = stdout.join('');
      expect(out).toContain('Usage: node menu.js');
    });
  });

  // -------------------------------------------------------------------------
  // AC2: run(['some-command']) dispatches correctly
  // -------------------------------------------------------------------------

  describe("run(['some-command'])", () => {
    it('invokes the matching command handler', async () => {
      const runSpy = vi.fn();
      const config = makeIntegrationConfig({
        commands: [
          {
            id: 'some-command',
            key: 's',
            label: 'Some Command',
            category: 'General',
            description: 'Test',
            run: runSpy,
          },
        ],
      });
      captureOutput();
      const menu = createMenu(config);
      await menu.run(['some-command']);
      expect(runSpy).toHaveBeenCalledOnce();
    });

    it('returns exit code 0 for a successful dispatch', async () => {
      captureOutput();
      const menu = createMenu(makeIntegrationConfig());
      const code = await menu.run(['some-command']);
      expect(code).toBe(0);
    });

    it('passes trailing flags to the command handler', async () => {
      const runSpy = vi.fn();
      const config = makeIntegrationConfig({
        commands: [
          {
            id: 'some-command',
            key: 's',
            label: 'Some Command',
            category: 'General',
            description: 'Test',
            run: runSpy,
          },
        ],
      });
      captureOutput();
      const menu = createMenu(config);
      await menu.run(['some-command', '--verbose']);
      expect(runSpy).toHaveBeenCalledWith(['--verbose']);
    });
  });

  // -------------------------------------------------------------------------
  // AC3: run(['unknown']) returns non-zero
  // -------------------------------------------------------------------------

  describe("run(['unknown'])", () => {
    it('returns a non-zero exit code for an unrecognised command', async () => {
      captureOutput();
      const menu = createMenu(makeIntegrationConfig());
      const code = await menu.run(['does-not-exist']);
      expect(code).toBeGreaterThan(0);
    });

    it('writes the unknown command name to stderr', async () => {
      const { stderr } = captureOutput();
      const menu = createMenu(makeIntegrationConfig());
      await menu.run(['unknown-xyz']);
      expect(stderr.join('')).toContain('unknown-xyz');
    });
  });

  // -------------------------------------------------------------------------
  // AC4: Multi-char Command.key throws on construction (S5)
  // -------------------------------------------------------------------------

  describe('Command.key validation (S5)', () => {
    it('throws at construction when a key has more than one character', () => {
      const config = makeIntegrationConfig({
        commands: [
          {
            id: 'bad-key',
            key: 'ab',
            label: 'Bad',
            category: 'General',
            description: 'Invalid key',
            run: () => {},
          },
        ],
      });
      expect(() => createMenu(config)).toThrow(/ab/);
    });

    it('includes the command id in the thrown error message', () => {
      const config = makeIntegrationConfig({
        commands: [
          {
            id: 'bad-key',
            key: 'xy',
            label: 'Bad',
            category: 'General',
            description: 'Invalid key',
            run: () => {},
          },
        ],
      });
      expect(() => createMenu(config)).toThrow(/bad-key/);
    });

    it('does not throw for a valid single-character key', () => {
      const config = makeIntegrationConfig();
      expect(() => createMenu(config)).not.toThrow();
    });

    it('does not throw when key is null', () => {
      const config = makeIntegrationConfig({
        commands: [
          {
            id: 'no-key',
            key: null,
            label: 'No Key',
            category: 'General',
            description: 'Null key is allowed',
            run: () => {},
          },
        ],
      });
      expect(() => createMenu(config)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // AC5: Pre-flight check failure returns non-zero exit code
  // -------------------------------------------------------------------------

  describe('pre-flight check failure', () => {
    it('returns the PreflightError.exitCode when a check throws', async () => {
      const config = makeIntegrationConfig({
        preflightChecks: [
          () => {
            throw new PreflightError('environment not ready', 42);
          },
        ],
      });
      captureOutput();
      const menu = createMenu(config);
      const code = await menu.run(['some-command']);
      expect(code).toBe(42);
    });

    it('returns non-zero (default 1) when PreflightError has no custom exitCode', async () => {
      const config = makeIntegrationConfig({
        preflightChecks: [
          () => {
            throw new PreflightError('missing dependency');
          },
        ],
      });
      captureOutput();
      const menu = createMenu(config);
      const code = await menu.run(['some-command']);
      expect(code).toBeGreaterThan(0);
    });

    it('writes the error message to stderr when a preflight check fails', async () => {
      const { stderr } = captureOutput();
      const config = makeIntegrationConfig({
        preflightChecks: [
          () => {
            throw new PreflightError('dependency missing');
          },
        ],
      });
      const menu = createMenu(config);
      await menu.run(['some-command']);
      expect(stderr.join('')).toContain('dependency missing');
    });

    it('does not dispatch the command when a preflight check fails', async () => {
      const runSpy = vi.fn();
      const { stderr } = captureOutput();
      const config = makeIntegrationConfig({
        commands: [
          {
            id: 'some-command',
            key: 's',
            label: 'Some Command',
            category: 'General',
            description: 'Test',
            run: runSpy,
          },
        ],
        preflightChecks: [
          () => {
            throw new PreflightError('blocked');
          },
        ],
      });
      const menu = createMenu(config);
      await menu.run(['some-command']);
      expect(runSpy).not.toHaveBeenCalled();
      expect(stderr.join('')).toContain('blocked');
    });
  });
});
