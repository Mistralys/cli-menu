import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMenu } from '../src/create-menu.js';
import * as helpModule from '../src/help.js';
import * as menuModule from '../src/menu/index.js';
import * as setupModule from '../src/setup/index.js';
import { PreflightError } from '../src/preflight.js';
import type { Command, MenuConfig, SetupComponent } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommand(
  overrides: Partial<Command> & Pick<Command, 'id' | 'key' | 'label'>,
): Command {
  return {
    category: 'Test',
    description: 'Test command',
    run: () => {},
    ...overrides,
  };
}

function makeConfig(overrides: Partial<MenuConfig> = {}): MenuConfig {
  return {
    name: 'Test Menu',
    banner: ['=== TEST ==='],
    version: '1.0.0',
    workspaceRoot: '/tmp/test',
    commands: [
      makeCommand({ id: 'build', key: 'b', label: 'Build' }),
      makeCommand({ id: 'test', key: 't', label: 'Test' }),
    ],
    ...overrides,
  };
}

function makeSetupComponent(id: string): SetupComponent {
  return {
    id,
    label: id,
    desc: `Setup ${id}`,
    detect: () => false,
    run: () => true,
    validate: () => true,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('createMenu()', () => {
  beforeEach(() => {
    vi.spyOn(helpModule, 'printHelp').mockImplementation(() => {});
    vi.spyOn(menuModule, 'showInteractiveMenu').mockResolvedValue();
    vi.spyOn(setupModule, 'runSetup').mockResolvedValue(0);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Construction — Command.key validation (S5)
  // -------------------------------------------------------------------------

  describe('Command.key validation (S5)', () => {
    it('throws when a Command.key is longer than one character', () => {
      const config = makeConfig({
        commands: [makeCommand({ id: 'bad', key: 'ab', label: 'Bad' })],
      });
      expect(() => createMenu(config)).toThrow(/Command "bad".*"ab".*2 characters/);
    });

    it('throws when a Command.key is empty string', () => {
      const config = makeConfig({
        commands: [makeCommand({ id: 'bad', key: '', label: 'Bad' })],
      });
      expect(() => createMenu(config)).toThrow(/Command "bad".*0 characters/);
    });

    it('does not throw when all Command.key values are exactly one character', () => {
      const config = makeConfig({
        commands: [
          makeCommand({ id: 'a', key: 'a', label: 'A' }),
          makeCommand({ id: 'b', key: 'b', label: 'B' }),
        ],
      });
      expect(() => createMenu(config)).not.toThrow();
    });

    it('does not throw when Command.key is null', () => {
      const config = makeConfig({
        commands: [makeCommand({ id: 'a', key: null, label: 'A' })],
      });
      expect(() => createMenu(config)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // help dispatch
  // -------------------------------------------------------------------------

  describe('run([\'help\'])', () => {
    it('calls printHelp and returns 0', async () => {
      const menu = createMenu(makeConfig());
      const code = await menu.run(['help']);
      expect(helpModule.printHelp).toHaveBeenCalledOnce();
      expect(code).toBe(0);
    });

    it('does not launch the interactive menu when help is requested', async () => {
      const menu = createMenu(makeConfig());
      await menu.run(['help']);
      expect(menuModule.showInteractiveMenu).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Direct command dispatch
  // -------------------------------------------------------------------------

  describe('run([\'some-command\'])', () => {
    it('dispatches a known command and returns 0', async () => {
      const runSpy = vi.fn();
      const config = makeConfig({
        commands: [makeCommand({ id: 'build', key: 'b', label: 'Build', run: runSpy })],
      });
      const menu = createMenu(config);
      const code = await menu.run(['build']);
      expect(runSpy).toHaveBeenCalledWith([]);
      expect(code).toBe(0);
    });

    it('passes trailing flags to the command handler', async () => {
      const runSpy = vi.fn();
      const config = makeConfig({
        commands: [makeCommand({ id: 'build', key: 'b', label: 'Build', run: runSpy })],
      });
      const menu = createMenu(config);
      await menu.run(['build', '--watch', '--clean']);
      expect(runSpy).toHaveBeenCalledWith(['--watch', '--clean']);
    });

    it('awaits a Promise-returning command and returns 0', async () => {
      let resolveCmd!: () => void;
      const cmdPromise = new Promise<void>((res) => { resolveCmd = res; });
      const config = makeConfig({
        commands: [makeCommand({ id: 'async-build', key: 'a', label: 'Async', run: () => cmdPromise })],
      });
      const menu = createMenu(config);
      const runPromise = menu.run(['async-build']);
      resolveCmd();
      const code = await runPromise;
      expect(code).toBe(0);
    });

    it('does not dispatch hidden commands', async () => {
      const runSpy = vi.fn();
      const config = makeConfig({
        commands: [makeCommand({ id: 'hidden-cmd', key: 'h', label: 'Hidden', hidden: true, run: runSpy })],
      });
      const menu = createMenu(config);
      const code = await menu.run(['hidden-cmd']);
      expect(runSpy).not.toHaveBeenCalled();
      expect(code).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Unknown command
  // -------------------------------------------------------------------------

  describe('run([\'unknown\'])', () => {
    it('returns non-zero for an unknown command', async () => {
      const menu = createMenu(makeConfig());
      const code = await menu.run(['does-not-exist']);
      expect(code).not.toBe(0);
    });

    it('writes an error to stderr for unknown command', async () => {
      const menu = createMenu(makeConfig());
      await menu.run(['does-not-exist']);
      expect(process.stderr.write).toHaveBeenCalledWith(
        expect.stringContaining('does-not-exist'),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Interactive menu fallback
  // -------------------------------------------------------------------------

  describe('run([]) — interactive menu', () => {
    let originalStdinIsTTY: boolean | undefined;

    beforeEach(() => {
      originalStdinIsTTY = process.stdin.isTTY;
    });

    afterEach(() => {
      Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinIsTTY, configurable: true });
    });

    it('launches the interactive menu when stdin is a TTY', async () => {
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
      const menu = createMenu(makeConfig());
      const code = await menu.run([]);
      expect(menuModule.showInteractiveMenu).toHaveBeenCalledOnce();
      expect(code).toBe(0);
    });

    it('returns non-zero when no command given and stdin is not a TTY', async () => {
      Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
      const menu = createMenu(makeConfig());
      const code = await menu.run([]);
      expect(menuModule.showInteractiveMenu).not.toHaveBeenCalled();
      expect(code).not.toBe(0);
    });

    it('writes an error to stderr when no TTY and no command', async () => {
      Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
      const menu = createMenu(makeConfig());
      await menu.run([]);
      expect(process.stderr.write).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Setup dispatch
  // -------------------------------------------------------------------------

  describe('run([\'setup\']) — setup dispatch', () => {
    it('delegates to runSetup when setupComponents are defined', async () => {
      const components = [makeSetupComponent('node')];
      const menu = createMenu(makeConfig({ setupComponents: components }));
      const code = await menu.run(['setup']);
      expect(setupModule.runSetup).toHaveBeenCalledWith(components, []);
      expect(code).toBe(0);
    });

    it('passes setup flags to runSetup', async () => {
      const components = [makeSetupComponent('node')];
      const menu = createMenu(makeConfig({ setupComponents: components }));
      await menu.run(['setup', '--all']);
      expect(setupModule.runSetup).toHaveBeenCalledWith(components, ['--all']);
    });

    it('returns runSetup exit code on failure', async () => {
      vi.spyOn(setupModule, 'runSetup').mockResolvedValue(1);
      const menu = createMenu(makeConfig({ setupComponents: [makeSetupComponent('node')] }));
      const code = await menu.run(['setup']);
      expect(code).toBe(1);
    });

    it('treats setup as unknown command when no setupComponents defined', async () => {
      const menu = createMenu(makeConfig({ setupComponents: undefined, commands: [] }));
      const code = await menu.run(['setup']);
      expect(setupModule.runSetup).not.toHaveBeenCalled();
      expect(code).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Pre-flight checks
  // -------------------------------------------------------------------------

  describe('pre-flight checks', () => {
    it('runs preflight checks before dispatch', async () => {
      const checkSpy = vi.fn();
      const menu = createMenu(makeConfig({ preflightChecks: [checkSpy] }));
      await menu.run(['help']);
      expect(checkSpy).toHaveBeenCalledOnce();
    });

    it('returns the PreflightError exitCode when a check fails', async () => {
      const failingCheck = (): void => {
        throw new PreflightError('Bad environment', 2);
      };
      const menu = createMenu(makeConfig({ preflightChecks: [failingCheck] }));
      const code = await menu.run(['help']);
      expect(code).toBe(2);
    });

    it('writes the PreflightError message to stderr', async () => {
      const failingCheck = (): void => {
        throw new PreflightError('Bad environment', 2);
      };
      const menu = createMenu(makeConfig({ preflightChecks: [failingCheck] }));
      await menu.run(['help']);
      expect(process.stderr.write).toHaveBeenCalledWith(
        expect.stringContaining('Bad environment'),
      );
    });

    it('re-throws non-PreflightError exceptions from checks', async () => {
      const failingCheck = (): void => {
        throw new Error('Unexpected crash');
      };
      const menu = createMenu(makeConfig({ preflightChecks: [failingCheck] }));
      await expect(menu.run(['help'])).rejects.toThrow('Unexpected crash');
    });

    it('does not dispatch help when a preflight check fails', async () => {
      const failingCheck = (): void => {
        throw new PreflightError('Fail', 1);
      };
      const menu = createMenu(makeConfig({ preflightChecks: [failingCheck] }));
      await menu.run(['help']);
      expect(helpModule.printHelp).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // No process.exit()
  // -------------------------------------------------------------------------

  it('never calls process.exit()', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit was called');
    });
    const originalStdinIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });

    try {
      const menu = createMenu(makeConfig());
      await menu.run(['help']);
      await menu.run(['build']);
      await menu.run(['does-not-exist']);

      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinIsTTY, configurable: true });
    }
  });
});
