import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearScreen, waitForKey } from '../src/screen.js';
import * as rawMode from '../src/raw-mode.js';

// ---------------------------------------------------------------------------
// clearScreen()
// ---------------------------------------------------------------------------

describe('clearScreen()', () => {
  let originalStdoutIsTTY: boolean | undefined;

  beforeEach(() => {
    originalStdoutIsTTY = process.stdout.isTTY;
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: originalStdoutIsTTY, configurable: true });
    vi.restoreAllMocks();
  });

  it('writes ANSI clear sequence when stdout is a TTY', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

    clearScreen();

    expect(writeSpy).toHaveBeenCalledWith('\x1b[2J\x1b[0;0H');
  });

  it('is a no-op when stdout.isTTY is false', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });

    clearScreen();

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('is a no-op when stdout.isTTY is undefined', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, configurable: true });

    clearScreen();

    expect(writeSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// waitForKey()
// ---------------------------------------------------------------------------

describe('waitForKey()', () => {
  let originalStdinIsTTY: boolean | undefined;

  beforeEach(() => {
    originalStdinIsTTY = process.stdin.isTTY;
  });

  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinIsTTY, configurable: true });
    vi.restoreAllMocks();
  });

  it('resolves immediately when stdin is not a TTY', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });

    await expect(waitForKey()).resolves.toBeUndefined();
  });

  it('also resolves immediately without writing a prompt when stdin is not a TTY', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await waitForKey('Press a key');

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('calls enterRawMode() — not inline raw-mode setup — when stdin is a TTY', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });

    const enterRawModeSpy = vi.spyOn(rawMode, 'enterRawMode').mockImplementation(() => {});
    vi.spyOn(rawMode, 'restoreTerminal').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // Immediately trigger the keypress event so the promise resolves.
    vi.spyOn(process.stdin, 'once').mockImplementation((event, listener) => {
      if (event === 'keypress') (listener as () => void)();
      return process.stdin;
    });

    await waitForKey('');

    expect(enterRawModeSpy).toHaveBeenCalledOnce();
  });

  it('resolves after a simulated keypress when stdin is a TTY', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });

    vi.spyOn(rawMode, 'enterRawMode').mockImplementation(() => {});
    vi.spyOn(rawMode, 'restoreTerminal').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    vi.spyOn(process.stdin, 'once').mockImplementation((event, listener) => {
      if (event === 'keypress') (listener as () => void)();
      return process.stdin;
    });

    await expect(waitForKey('')).resolves.toBeUndefined();
  });
});
