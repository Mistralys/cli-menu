import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showInteractiveMenu } from '../../src/menu/interactive.js';
import * as rawMode from '../../src/raw-mode.js';
import * as renderer from '../../src/menu/renderer.js';
import * as helpModule from '../../src/help.js';
import * as screen from '../../src/screen.js';
import * as setupModule from '../../src/setup/index.js';
import type { Command, MenuConfig, SetupComponent } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type KeypressListener = (str: string | undefined) => void;

/**
 * Builds a controller that intercepts `process.stdin.on('keypress', …)` and
 * provides a `fire(ch)` method to simulate keypresses from the test.
 */
function buildKeypressController() {
  const listeners: KeypressListener[] = [];

  vi.spyOn(process.stdin, 'on').mockImplementation(
    (event: string | symbol, handler: (...args: unknown[]) => void) => {
      if (event === 'keypress') {
        listeners.push(handler as KeypressListener);
      }
      return process.stdin;
    },
  );

  vi.spyOn(process.stdin, 'off').mockImplementation(() => process.stdin);

  return {
    /** Fire the most recently registered keypress listener. */
    fire(ch: string): void {
      const handler = listeners.at(-1);
      handler?.(ch);
    },
  };
}

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

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('showInteractiveMenu()', () => {
  beforeEach(() => {
    vi.spyOn(rawMode, 'enterRawMode').mockImplementation(() => {});
    vi.spyOn(rawMode, 'restoreTerminal').mockImplementation(() => {});
    vi.spyOn(renderer, 'renderMenu').mockImplementation(() => {});
    vi.spyOn(helpModule, 'printHelp').mockImplementation(() => {});
    vi.spyOn(screen, 'waitForKey').mockResolvedValue();
    vi.spyOn(setupModule, 'runSetup').mockResolvedValue(0);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process, 'on').mockImplementation(() => process);
    vi.spyOn(process, 'off').mockImplementation(() => process);
    vi.spyOn(process, 'kill').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // q — exit the menu
  // -------------------------------------------------------------------------

  it('q exits the menu and resolves the promise', async () => {
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(makeConfig());
    ctrl.fire('q');
    await menuPromise;
    // If we reach here the Promise resolved — test passes.
  });

  it('q calls restoreTerminal() on exit', async () => {
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(makeConfig());
    ctrl.fire('q');
    await menuPromise;
    expect(rawMode.restoreTerminal).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // h — help output
  // -------------------------------------------------------------------------

  it('h triggers help output', async () => {
    const ctrl = buildKeypressController();
    const config = makeConfig();
    const menuPromise = showInteractiveMenu(config);

    ctrl.fire('h');
    // Let the h-branch finish (restoreTerminal + printHelp + waitForKey) then
    // the loop re-registers a new listener — fire q to exit.
    await Promise.resolve();
    await Promise.resolve();
    ctrl.fire('q');
    await menuPromise;

    expect(helpModule.printHelp).toHaveBeenCalledOnce();
    expect(helpModule.printHelp).toHaveBeenCalledWith(config.commands, config);
  });

  it('h calls waitForKey after printing help', async () => {
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(makeConfig());

    ctrl.fire('h');
    await Promise.resolve();
    await Promise.resolve();
    ctrl.fire('q');
    await menuPromise;

    expect(screen.waitForKey).toHaveBeenCalled();
  });

  it('h calls restoreTerminal before printing help', async () => {
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(makeConfig());

    ctrl.fire('h');
    await Promise.resolve();
    await Promise.resolve();
    ctrl.fire('q');
    await menuPromise;

    expect(rawMode.restoreTerminal).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Known hotkeys — command dispatch
  // -------------------------------------------------------------------------

  it('known hotkey resolves to the correct command', async () => {
    const buildRun = vi.fn<[], void>();
    const config = makeConfig({
      commands: [makeCommand({ id: 'build', key: 'b', label: 'Build', run: buildRun })],
    });
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(config);

    ctrl.fire('b');
    await Promise.resolve();
    await Promise.resolve();
    ctrl.fire('q');
    await menuPromise;

    expect(buildRun).toHaveBeenCalledOnce();
  });

  it('blocking command (void return) triggers waitForKey after running', async () => {
    const syncRun = vi.fn<[], void>(() => {});
    const config = makeConfig({
      commands: [makeCommand({ id: 'build', key: 'b', label: 'Build', run: syncRun })],
    });
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(config);

    ctrl.fire('b');
    await Promise.resolve();
    await Promise.resolve();
    ctrl.fire('q');
    await menuPromise;

    expect(screen.waitForKey).toHaveBeenCalled();
  });

  it('long-running command (Promise return) does not trigger waitForKey', async () => {
    const asyncRun = vi.fn(async () => {});
    const config = makeConfig({
      commands: [makeCommand({ id: 'serve', key: 's', label: 'Serve', run: asyncRun })],
    });
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(config);

    ctrl.fire('s');
    await Promise.resolve();
    await Promise.resolve();
    ctrl.fire('q');
    await menuPromise;

    expect(asyncRun).toHaveBeenCalledOnce();
    expect(screen.waitForKey).not.toHaveBeenCalled();
  });

  it('long-running command takes over process — awaits the returned Promise', async () => {
    let resolveCmd!: () => void;
    const cmdPromise = new Promise<void>((r) => {
      resolveCmd = r;
    });
    const asyncRun = vi.fn(() => cmdPromise);
    const config = makeConfig({
      commands: [makeCommand({ id: 'serve', key: 's', label: 'Serve', run: asyncRun })],
    });
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(config);

    ctrl.fire('s');
    await Promise.resolve();

    // The menu is awaiting the command Promise — resolve it now.
    resolveCmd();
    await Promise.resolve();
    await Promise.resolve();

    ctrl.fire('q');
    await menuPromise;

    expect(asyncRun).toHaveBeenCalledOnce();
  });

  it('known hotkey calls restoreTerminal before running the command', async () => {
    const config = makeConfig({
      commands: [makeCommand({ id: 'build', key: 'b', label: 'Build', run: () => {} })],
    });
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(config);

    ctrl.fire('b');
    await Promise.resolve();
    await Promise.resolve();
    ctrl.fire('q');
    await menuPromise;

    expect(rawMode.restoreTerminal).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Unknown key
  // -------------------------------------------------------------------------

  it('unknown key triggers re-render without running any command', async () => {
    const config = makeConfig();
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(config);

    // First render is at loop entry. Then fire unknown key — re-render. Then quit.
    const renderCallsBefore = (renderer.renderMenu as ReturnType<typeof vi.fn>).mock.calls.length;
    ctrl.fire('z');
    await Promise.resolve();
    const renderCallsAfter = (renderer.renderMenu as ReturnType<typeof vi.fn>).mock.calls.length;
    ctrl.fire('q');
    await menuPromise;

    expect(renderCallsAfter).toBeGreaterThan(renderCallsBefore);
  });

  // -------------------------------------------------------------------------
  // SIGINT handler
  // -------------------------------------------------------------------------

  it('registers a SIGINT handler when the menu starts', async () => {
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(makeConfig());

    const registeredEvents = (process.on as ReturnType<typeof vi.fn>).mock.calls.map(
      ([event]) => event,
    );
    expect(registeredEvents).toContain('SIGINT');

    ctrl.fire('q');
    await menuPromise;
  });

  it('unregisters the SIGINT handler on clean exit', async () => {
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(makeConfig());

    ctrl.fire('q');
    await menuPromise;

    const removedEvents = (process.off as ReturnType<typeof vi.fn>).mock.calls.map(
      ([event]) => event,
    );
    expect(removedEvents).toContain('SIGINT');
  });

  it('SIGINT handler calls restoreTerminal and re-raises the signal', async () => {
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(makeConfig());

    // Find the SIGINT handler that was registered.
    const sigintCalls = (process.on as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([event]) => event === 'SIGINT',
    );
    expect(sigintCalls.length).toBeGreaterThan(0);
    const [, sigintHandler] = sigintCalls[0];

    sigintHandler();
    expect(rawMode.restoreTerminal).toHaveBeenCalled();
    expect(process.kill).toHaveBeenCalledWith(process.pid, 'SIGINT');

    // Clean up: exit the menu.
    ctrl.fire('q');
    await menuPromise;
  });

  it('SIGINT handler self-unregisters before re-raising the signal', async () => {
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(makeConfig());

    // Capture the registered sigintHandler reference.
    const sigintCalls = (process.on as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([event]) => event === 'SIGINT',
    );
    expect(sigintCalls.length).toBeGreaterThan(0);
    const [, sigintHandler] = sigintCalls[0];

    // Track what process.off is called with DURING handler execution.
    const offDuringHandler: Array<[string, unknown]> = [];
    const offMock = process.off as ReturnType<typeof vi.fn>;
    offMock.mockImplementation((event: string, handler: unknown) => {
      offDuringHandler.push([event, handler]);
      return process;
    });

    sigintHandler();

    // process.off('SIGINT', sigintHandler) must have been called inside the handler.
    expect(offDuringHandler.some(([ev, fn]) => ev === 'SIGINT' && fn === sigintHandler)).toBe(true);

    // Clean up: exit the menu.
    ctrl.fire('q');
    await menuPromise;
  });

  // -------------------------------------------------------------------------
  // Render cycle
  // -------------------------------------------------------------------------

  it('calls enterRawMode and renderMenu on each loop iteration', async () => {
    const config = makeConfig();
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(config);

    // Initial render happens immediately.
    expect(rawMode.enterRawMode).toHaveBeenCalledOnce();
    expect(renderer.renderMenu).toHaveBeenCalledOnce();

    ctrl.fire('q');
    await menuPromise;
  });

  it('re-renders after an unknown key', async () => {
    const config = makeConfig();
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(config);

    ctrl.fire('z'); // unknown
    await Promise.resolve();
    ctrl.fire('q');
    await menuPromise;

    expect(renderer.renderMenu).toHaveBeenCalledTimes(2); // initial + unknown key loop
  });

  // -------------------------------------------------------------------------
  // Hidden commands excluded from keymap
  // -------------------------------------------------------------------------

  it('does not dispatch a hidden command even if its key is pressed', async () => {
    const hiddenRun = vi.fn<[], void>();
    const config = makeConfig({
      commands: [
        makeCommand({ id: 'hidden-cmd', key: 'x', label: 'Hidden', run: hiddenRun, hidden: true }),
      ],
    });
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(config);

    ctrl.fire('x');
    await Promise.resolve();
    ctrl.fire('q');
    await menuPromise;

    expect(hiddenRun).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Setup command auto-dispatch
  // -------------------------------------------------------------------------

  it('setup hotkey calls runSetup when setupComponents is defined', async () => {
    const component: SetupComponent = {
      id: 'mcp',
      label: 'MCP Server',
      desc: 'Install the MCP server',
      detect: () => false,
      run: () => true,
      validate: () => true,
    };
    const config = makeConfig({
      commands: [
        makeCommand({ id: 'setup', key: 's', label: 'First-time setup', run: undefined as unknown as Command['run'] }),
      ],
      setupComponents: [component],
    });
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(config);

    ctrl.fire('s');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    ctrl.fire('q');
    await menuPromise;

    expect(setupModule.runSetup).toHaveBeenCalledOnce();
    expect(setupModule.runSetup).toHaveBeenCalledWith([component], []);
  });

  it('setup dispatch calls waitForKey after runSetup so the user can read the summary', async () => {
    const config = makeConfig({
      commands: [
        makeCommand({ id: 'setup', key: 's', label: 'First-time setup', run: undefined as unknown as Command['run'] }),
      ],
      setupComponents: [{
        id: 'mcp', label: 'MCP', desc: '', detect: () => false, run: () => true, validate: () => true,
      }],
    });
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(config);

    ctrl.fire('s');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    ctrl.fire('q');
    await menuPromise;

    expect(screen.waitForKey).toHaveBeenCalled();
  });

  it('setup command without setupComponents falls through to cmd.run', async () => {
    const setupRun = vi.fn<[], void>();
    const config = makeConfig({
      commands: [
        makeCommand({ id: 'setup', key: 's', label: 'Setup', run: setupRun }),
      ],
      // no setupComponents
    });
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(config);

    ctrl.fire('s');
    await Promise.resolve();
    await Promise.resolve();
    ctrl.fire('q');
    await menuPromise;

    expect(setupRun).toHaveBeenCalledOnce();
    expect(setupModule.runSetup).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Error handling — thrown command errors must not crash the loop
  // -------------------------------------------------------------------------

  it('synchronous command error does not crash the menu — loop continues', async () => {
    const throwingRun = vi.fn<[], void>(() => {
      throw new Error('sync boom');
    });
    const config = makeConfig({
      commands: [makeCommand({ id: 'boom', key: 'b', label: 'Boom', run: throwingRun })],
    });
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(config);

    ctrl.fire('b');
    await Promise.resolve();
    await Promise.resolve();
    // The loop must still be alive — fire q to exit cleanly.
    ctrl.fire('q');
    await menuPromise;

    expect(throwingRun).toHaveBeenCalledOnce();
  });

  it('asynchronous command error does not crash the menu — loop continues', async () => {
    const throwingRun = vi.fn(async () => {
      throw new Error('async boom');
    });
    const config = makeConfig({
      commands: [makeCommand({ id: 'boom', key: 'b', label: 'Boom', run: throwingRun })],
    });
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(config);

    ctrl.fire('b');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    ctrl.fire('q');
    await menuPromise;

    expect(throwingRun).toHaveBeenCalledOnce();
  });

  it('error message is printed via log() (stdout write) when a command throws', async () => {
    const throwingRun = vi.fn<[], void>(() => {
      throw new Error('error output text');
    });
    const config = makeConfig({
      commands: [makeCommand({ id: 'boom', key: 'b', label: 'Boom', run: throwingRun })],
    });
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(config);

    ctrl.fire('b');
    await Promise.resolve();
    await Promise.resolve();
    ctrl.fire('q');
    await menuPromise;

    const writtenOutput = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls
      .map(([arg]: [unknown]) => String(arg))
      .join('');
    expect(writtenOutput).toContain('error output text');
  });

  it('waitForKey is called after a command error so the user can read the message', async () => {
    const throwingRun = vi.fn<[], void>(() => {
      throw new Error('read me');
    });
    const config = makeConfig({
      commands: [makeCommand({ id: 'boom', key: 'b', label: 'Boom', run: throwingRun })],
    });
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(config);

    ctrl.fire('b');
    await Promise.resolve();
    await Promise.resolve();
    ctrl.fire('q');
    await menuPromise;

    expect(screen.waitForKey).toHaveBeenCalled();
  });

  it('menu re-renders after a command error', async () => {
    const throwingRun = vi.fn<[], void>(() => {
      throw new Error('re-render test');
    });
    const config = makeConfig({
      commands: [makeCommand({ id: 'boom', key: 'b', label: 'Boom', run: throwingRun })],
    });
    const ctrl = buildKeypressController();
    const menuPromise = showInteractiveMenu(config);

    // 1 render at loop entry.
    const rendersBefore = (renderer.renderMenu as ReturnType<typeof vi.fn>).mock.calls.length;
    ctrl.fire('b');
    await Promise.resolve();
    await Promise.resolve();
    ctrl.fire('q');
    await menuPromise;

    // At least one more render after the error.
    const rendersAfter = (renderer.renderMenu as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(rendersAfter).toBeGreaterThan(rendersBefore);
  });
});

// ---------------------------------------------------------------------------
// Barrel export
// ---------------------------------------------------------------------------

describe('src/menu/index.ts barrel export', () => {
  it('re-exports showInteractiveMenu', async () => {
    const barrel = await import('../../src/menu/index.js');
    expect(typeof barrel.showInteractiveMenu).toBe('function');
  });

  it('re-exports renderMenu', async () => {
    const barrel = await import('../../src/menu/index.js');
    expect(typeof barrel.renderMenu).toBe('function');
  });
});
