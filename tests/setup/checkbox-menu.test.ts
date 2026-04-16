import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCheckboxMenu } from '../../src/setup/checkbox-menu.js';
import * as rawMode from '../../src/raw-mode.js';
import type { SetupComponent } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeComponent(
  overrides: Pick<SetupComponent, 'id' | 'label'> & Partial<SetupComponent>,
): SetupComponent {
  return {
    desc: 'A test component',
    detect: () => false,
    run: () => true,
    validate: () => true,
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KeypressListener = (str: string | undefined, key: Record<string, any> | undefined) => void;

function buildStdinSpy(): { fire: (str: string | undefined, name: string) => void } {
  let listener: KeypressListener | null = null;

  vi.spyOn(process.stdin, 'on').mockImplementation(
    (event: string | symbol, handler: (...args: unknown[]) => void) => {
      if (event === 'keypress') listener = handler as KeypressListener;
      return process.stdin;
    },
  );

  return {
    fire(str: string | undefined, name: string): void {
      listener?.(str, { name });
    },
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('runCheckboxMenu()', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(rawMode, 'isRawModeSupported').mockReturnValue(true);
    vi.spyOn(rawMode, 'enterRawMode').mockImplementation(() => {});
    vi.spyOn(rawMode, 'restoreTerminal').mockImplementation(() => {});
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stdin, 'pause').mockImplementation(() => process.stdin);
    vi.spyOn(process.stdin, 'removeAllListeners').mockImplementation(() => process.stdin);
    vi.spyOn(process, 'on').mockImplementation(() => process);
    vi.spyOn(process, 'off').mockImplementation(() => process);
    vi.spyOn(process, 'kill').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Non-TTY / edge cases
  // -------------------------------------------------------------------------

  it('returns null immediately when raw mode is not supported', async () => {
    vi.spyOn(rawMode, 'isRawModeSupported').mockReturnValue(false);
    await expect(runCheckboxMenu([makeComponent({ id: 'a', label: 'A' })])).resolves.toBeNull();
  });

  it('returns empty array immediately when components list is empty', async () => {
    await expect(runCheckboxMenu([])).resolves.toEqual([]);
  });

  it('calls enterRawMode() when the menu starts', async () => {
    const enterSpy = vi.spyOn(rawMode, 'enterRawMode').mockImplementation(() => {});
    const stdin = buildStdinSpy();
    const p = runCheckboxMenu([makeComponent({ id: 'a', label: 'A' })]);
    stdin.fire('q', 'q');
    await p;
    expect(enterSpy).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Navigation — ↓ / j
  // -------------------------------------------------------------------------

  describe('↓ and j move cursor down', () => {
    it('↓ moves cursor to the next item', async () => {
      const stdin = buildStdinSpy();
      const comps = [makeComponent({ id: 'a', label: 'A' }), makeComponent({ id: 'b', label: 'B' })];
      const p = runCheckboxMenu(comps);
      stdin.fire(undefined, 'down'); // cursor → 1
      stdin.fire(' ', ' ');          // toggle b
      stdin.fire(undefined, 'return');
      await expect(p).resolves.toEqual(['b']);
    });

    it('j moves cursor down (vi-style)', async () => {
      const stdin = buildStdinSpy();
      const comps = [makeComponent({ id: 'a', label: 'A' }), makeComponent({ id: 'b', label: 'B' })];
      const p = runCheckboxMenu(comps);
      stdin.fire('j', 'j'); // cursor → 1
      stdin.fire(' ', ' ');
      stdin.fire(undefined, 'return');
      await expect(p).resolves.toEqual(['b']);
    });

    it('cursor does not go below the last item', async () => {
      const stdin = buildStdinSpy();
      const comps = [makeComponent({ id: 'a', label: 'A' })];
      const p = runCheckboxMenu(comps);
      stdin.fire(undefined, 'down'); // still at 0
      stdin.fire(undefined, 'down'); // still at 0
      stdin.fire(' ', ' ');          // toggle a
      stdin.fire(undefined, 'return');
      await expect(p).resolves.toEqual(['a']);
    });
  });

  // -------------------------------------------------------------------------
  // Navigation — ↑ / k
  // -------------------------------------------------------------------------

  describe('↑ and k move cursor up', () => {
    it('↑ moves cursor to the previous item', async () => {
      const stdin = buildStdinSpy();
      const comps = [makeComponent({ id: 'a', label: 'A' }), makeComponent({ id: 'b', label: 'B' })];
      const p = runCheckboxMenu(comps);
      stdin.fire(undefined, 'down'); // cursor → 1
      stdin.fire(undefined, 'up');   // cursor → 0
      stdin.fire(' ', ' ');          // toggle a
      stdin.fire(undefined, 'return');
      await expect(p).resolves.toEqual(['a']);
    });

    it('k moves cursor up (vi-style)', async () => {
      const stdin = buildStdinSpy();
      const comps = [makeComponent({ id: 'a', label: 'A' }), makeComponent({ id: 'b', label: 'B' })];
      const p = runCheckboxMenu(comps);
      stdin.fire(undefined, 'down'); // cursor → 1
      stdin.fire('k', 'k');          // cursor → 0
      stdin.fire(' ', ' ');          // toggle a
      stdin.fire(undefined, 'return');
      await expect(p).resolves.toEqual(['a']);
    });

    it('cursor does not go above the first item', async () => {
      const stdin = buildStdinSpy();
      const comps = [makeComponent({ id: 'a', label: 'A' }), makeComponent({ id: 'b', label: 'B' })];
      const p = runCheckboxMenu(comps);
      stdin.fire(undefined, 'up'); // already at 0
      stdin.fire(' ', ' ');        // toggle a
      stdin.fire(undefined, 'return');
      await expect(p).resolves.toEqual(['a']);
    });
  });

  // -------------------------------------------------------------------------
  // Space — toggle individual item
  // -------------------------------------------------------------------------

  describe('Space toggles individual items', () => {
    it('toggles the current item from unchecked to checked', async () => {
      const stdin = buildStdinSpy();
      const p = runCheckboxMenu([makeComponent({ id: 'a', label: 'A' })]);
      stdin.fire(' ', ' ');
      stdin.fire(undefined, 'return');
      await expect(p).resolves.toEqual(['a']);
    });

    it('toggles the current item from checked back to unchecked', async () => {
      const stdin = buildStdinSpy();
      const p = runCheckboxMenu([makeComponent({ id: 'a', label: 'A' })]);
      stdin.fire(' ', ' '); // on
      stdin.fire(' ', ' '); // off
      stdin.fire(undefined, 'return');
      await expect(p).resolves.toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // a — toggle all
  // -------------------------------------------------------------------------

  describe('"a" toggles all items', () => {
    it('checks all items when not all are checked', async () => {
      const stdin = buildStdinSpy();
      const comps = [makeComponent({ id: 'a', label: 'A' }), makeComponent({ id: 'b', label: 'B' })];
      const p = runCheckboxMenu(comps);
      stdin.fire('a', 'a');
      stdin.fire(undefined, 'return');
      await expect(p).resolves.toEqual(['a', 'b']);
    });

    it('unchecks all items when all are already checked', async () => {
      const stdin = buildStdinSpy();
      const comps = [
        makeComponent({ id: 'a', label: 'A', detect: () => true }),
        makeComponent({ id: 'b', label: 'B', detect: () => true }),
      ];
      const p = runCheckboxMenu(comps);
      stdin.fire('a', 'a'); // all checked → uncheck all
      stdin.fire(undefined, 'return');
      await expect(p).resolves.toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Enter — confirm
  // -------------------------------------------------------------------------

  describe('Enter returns array of selected component IDs', () => {
    it('returns IDs of all checked items', async () => {
      const stdin = buildStdinSpy();
      const comps = [
        makeComponent({ id: 'alpha', label: 'Alpha' }),
        makeComponent({ id: 'beta', label: 'Beta' }),
      ];
      const p = runCheckboxMenu(comps);
      stdin.fire(' ', ' ');          // check alpha
      stdin.fire(undefined, 'down'); // move to beta
      stdin.fire(' ', ' ');          // check beta
      stdin.fire(undefined, 'return');
      await expect(p).resolves.toEqual(['alpha', 'beta']);
    });

    it('returns empty array when nothing is selected', async () => {
      const stdin = buildStdinSpy();
      const p = runCheckboxMenu([makeComponent({ id: 'a', label: 'A' })]);
      stdin.fire(undefined, 'return');
      await expect(p).resolves.toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // q — cancel
  // -------------------------------------------------------------------------

  it('q returns null (cancel)', async () => {
    const stdin = buildStdinSpy();
    const p = runCheckboxMenu([makeComponent({ id: 'a', label: 'A' })]);
    stdin.fire('q', 'q');
    await expect(p).resolves.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Pre-detected components
  // -------------------------------------------------------------------------

  describe('pre-detected components', () => {
    it('pre-checks detected components', async () => {
      const stdin = buildStdinSpy();
      const comps = [
        makeComponent({ id: 'installed', label: 'Installed', detect: () => true }),
        makeComponent({ id: 'missing', label: 'Missing', detect: () => false }),
      ];
      const p = runCheckboxMenu(comps);
      stdin.fire(undefined, 'return'); // installed already checked
      await expect(p).resolves.toEqual(['installed']);
    });

    it('renders (done) tag for pre-detected components', async () => {
      const stdin = buildStdinSpy();
      const comps = [makeComponent({ id: 'done-comp', label: 'Done', detect: () => true })];
      const p = runCheckboxMenu(comps);
      stdin.fire('q', 'q');
      await p;
      const allOutput = writeSpy.mock.calls.map(([arg]) => String(arg)).join('');
      expect(allOutput).toContain('(done)');
    });
  });

  // -------------------------------------------------------------------------
  // SIGINT handler
  // -------------------------------------------------------------------------

  describe('SIGINT handler', () => {
    it('registers a SIGINT handler when the menu starts', async () => {
      const onSpy = vi.spyOn(process, 'on').mockImplementation(() => process);
      const stdin = buildStdinSpy();
      const p = runCheckboxMenu([makeComponent({ id: 'a', label: 'A' })]);
      expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      stdin.fire('q', 'q');
      await p;
    });

    it('unregisters the SIGINT handler on clean exit via Enter', async () => {
      let capturedHandler: ((...args: unknown[]) => void) | null = null;
      vi.spyOn(process, 'on').mockImplementation((event: string | symbol, handler: (...args: unknown[]) => void) => {
        if (event === 'SIGINT') capturedHandler = handler;
        return process;
      });
      const offSpy = vi.spyOn(process, 'off').mockImplementation(() => process);

      const stdin = buildStdinSpy();
      const p = runCheckboxMenu([makeComponent({ id: 'a', label: 'A' })]);
      stdin.fire(undefined, 'return');
      await p;
      expect(offSpy).toHaveBeenCalledWith('SIGINT', capturedHandler);
    });

    it('unregisters the SIGINT handler on clean exit via q', async () => {
      let capturedHandler: ((...args: unknown[]) => void) | null = null;
      vi.spyOn(process, 'on').mockImplementation((event: string | symbol, handler: (...args: unknown[]) => void) => {
        if (event === 'SIGINT') capturedHandler = handler;
        return process;
      });
      const offSpy = vi.spyOn(process, 'off').mockImplementation(() => process);

      const stdin = buildStdinSpy();
      const p = runCheckboxMenu([makeComponent({ id: 'a', label: 'A' })]);
      stdin.fire('q', 'q');
      await p;
      expect(offSpy).toHaveBeenCalledWith('SIGINT', capturedHandler);
    });

    it('SIGINT handler calls restoreTerminal() and re-raises the signal', () => {
      const restoreSpy = vi.spyOn(rawMode, 'restoreTerminal').mockImplementation(() => {});
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
      let capturedHandler: (() => void) | null = null;
      vi.spyOn(process, 'on').mockImplementation((event: string | symbol, handler: (...args: unknown[]) => void) => {
        if (event === 'SIGINT') capturedHandler = handler as () => void;
        return process;
      });
      vi.spyOn(process, 'off').mockImplementation(() => process);

      buildStdinSpy();
      runCheckboxMenu([makeComponent({ id: 'a', label: 'A' })]);

      capturedHandler?.();
      expect(restoreSpy).toHaveBeenCalled();
      expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGINT');
    });

    it('SIGINT handler self-unregisters before re-raising the signal', () => {
      let capturedHandler: (() => void) | null = null;
      vi.spyOn(process, 'on').mockImplementation((event: string | symbol, handler: (...args: unknown[]) => void) => {
        if (event === 'SIGINT') capturedHandler = handler as () => void;
        return process;
      });

      buildStdinSpy();
      runCheckboxMenu([makeComponent({ id: 'a', label: 'A' })]);

      // Track what process.off is called with DURING handler execution.
      const offDuringHandler: Array<[string, unknown]> = [];
      const offMock = process.off as ReturnType<typeof vi.fn>;
      offMock.mockImplementation((event: string, handler: unknown) => {
        offDuringHandler.push([event, handler]);
        return process;
      });

      capturedHandler?.();

      // process.off('SIGINT', sigintHandler) must be called inside the handler
      // (before restoreTerminal and process.kill) to prevent the re-raised
      // SIGINT from being redelivered to the same listener (event-loop spin).
      expect(offDuringHandler.some(([ev, fn]) => ev === 'SIGINT' && fn === capturedHandler)).toBe(true);
    });
  });
});
