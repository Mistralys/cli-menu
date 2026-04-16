import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runSetup } from '../../src/setup/runner.js';
import * as checkboxMenuModule from '../../src/setup/checkbox-menu.js';
import type { SetupComponent } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeComponent(id: string, overrides: Partial<SetupComponent> = {}): SetupComponent {
  return {
    id,
    label: `Component ${id}`,
    desc: `Description for ${id}`,
    detect: () => false,
    run: () => true,
    validate: () => true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('runSetup()', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Empty components
  // -------------------------------------------------------------------------

  it('returns 0 when no components are registered', async () => {
    const code = await runSetup([], []);
    expect(code).toBe(0);
  });

  // -------------------------------------------------------------------------
  // --all flag
  // -------------------------------------------------------------------------

  it('--all selects all components and returns 0 when all succeed', async () => {
    const runA = vi.fn(() => true);
    const runB = vi.fn(() => true);
    const components = [makeComponent('a', { run: runA }), makeComponent('b', { run: runB })];

    const code = await runSetup(components, ['--all']);

    expect(code).toBe(0);
    expect(runA).toHaveBeenCalledOnce();
    expect(runB).toHaveBeenCalledOnce();
  });

  it('--all returns 1 when at least one component fails', async () => {
    const components = [
      makeComponent('a', { run: () => true }),
      makeComponent('b', { run: () => false }),
    ];

    const code = await runSetup(components, ['--all']);

    expect(code).toBe(1);
  });

  it('--all passes the full args array to each component', async () => {
    const runSpy = vi.fn(() => true);
    const components = [makeComponent('a', { run: runSpy })];
    const args = ['--all', '--extra'];

    await runSetup(components, args);

    expect(runSpy).toHaveBeenCalledWith(args);
  });

  // -------------------------------------------------------------------------
  // --components flag
  // -------------------------------------------------------------------------

  it('--components a,b selects the named subset (equals form)', async () => {
    const runA = vi.fn(() => true);
    const runB = vi.fn(() => true);
    const runC = vi.fn(() => true);
    const components = [
      makeComponent('a', { run: runA }),
      makeComponent('b', { run: runB }),
      makeComponent('c', { run: runC }),
    ];

    const code = await runSetup(components, ['--components=a,b']);

    expect(code).toBe(0);
    expect(runA).toHaveBeenCalledOnce();
    expect(runB).toHaveBeenCalledOnce();
    expect(runC).not.toHaveBeenCalled();
  });

  it('--components a,b selects the named subset (two-token form)', async () => {
    const runA = vi.fn(() => true);
    const runC = vi.fn(() => true);
    const components = [
      makeComponent('a', { run: runA }),
      makeComponent('b', { run: () => true }),
      makeComponent('c', { run: runC }),
    ];

    const code = await runSetup(components, ['--components', 'a,c']);

    expect(code).toBe(0);
    expect(runA).toHaveBeenCalledOnce();
    expect(runC).toHaveBeenCalledOnce();
  });

  it('--components with a failing component returns 1', async () => {
    const components = [
      makeComponent('a', { run: () => false }),
      makeComponent('b', { run: () => true }),
    ];

    const code = await runSetup(components, ['--components=a,b']);

    expect(code).toBe(1);
  });

  it('returns 1 and writes to stderr when --components has no value', async () => {
    const components = [makeComponent('a')];

    const code = await runSetup(components, ['--components']);

    expect(code).toBe(1);
    const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(stderrOutput).toMatch(/--components/);
  });

  // -------------------------------------------------------------------------
  // Non-TTY without flags
  // -------------------------------------------------------------------------

  it('prints error and returns 1 when non-TTY and no flag is given', async () => {
    const components = [makeComponent('a')];
    // Ensure isTTY is falsy
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: undefined, configurable: true });

    try {
      const code = await runSetup(components, []);

      expect(code).toBe(1);
      const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toMatch(/No TTY detected/i);
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: originalIsTTY,
        configurable: true,
      });
    }
  });

  // -------------------------------------------------------------------------
  // Interactive (TTY) mode
  // -------------------------------------------------------------------------

  it('calls runCheckboxMenu when TTY is available and no flag given', async () => {
    const checkboxSpy = vi
      .spyOn(checkboxMenuModule, 'runCheckboxMenu')
      .mockResolvedValue(['a']);
    const runA = vi.fn(() => true);
    const components = [makeComponent('a', { run: runA })];
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });

    try {
      const code = await runSetup(components, []);

      expect(code).toBe(0);
      expect(checkboxSpy).toHaveBeenCalledOnce();
      expect(runA).toHaveBeenCalledOnce();
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: undefined,
        configurable: true,
      });
    }
  });

  it('returns 0 and prints cancelled message when interactive menu is cancelled', async () => {
    vi.spyOn(checkboxMenuModule, 'runCheckboxMenu').mockResolvedValue(null);
    const components = [makeComponent('a')];
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });

    try {
      const code = await runSetup(components, []);

      expect(code).toBe(0);
      const stdoutOutput = stdoutSpy.mock.calls.map((c) => c[0]).join('');
      expect(stdoutOutput).toMatch(/cancelled/i);
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: undefined,
        configurable: true,
      });
    }
  });

  it('returns 0 when interactive menu returns an empty selection', async () => {
    vi.spyOn(checkboxMenuModule, 'runCheckboxMenu').mockResolvedValue([]);
    const components = [makeComponent('a')];
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });

    try {
      const code = await runSetup(components, []);
      expect(code).toBe(0);
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: undefined,
        configurable: true,
      });
    }
  });

  // -------------------------------------------------------------------------
  // Summary table
  // -------------------------------------------------------------------------

  it('prints summary table with success/failure counts', async () => {
    const components = [
      makeComponent('a', { label: 'Alpha', run: () => true }),
      makeComponent('b', { label: 'Beta', run: () => false }),
    ];

    await runSetup(components, ['--all']);

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toMatch(/Setup summary/i);
    expect(output).toMatch(/Alpha/);
    expect(output).toMatch(/Beta/);
    // "1 succeeded" and "1 failed" (may be wrapped in ANSI codes)
    expect(output).toMatch(/1 succeeded/);
    expect(output).toMatch(/1 failed/);
  });

  // -------------------------------------------------------------------------
  // Exit codes
  // -------------------------------------------------------------------------

  it('returns exit code 0 when all components succeed', async () => {
    const components = [makeComponent('a'), makeComponent('b')];
    const code = await runSetup(components, ['--all']);
    expect(code).toBe(0);
  });

  it('returns exit code 1 when any component fails', async () => {
    const components = [
      makeComponent('a', { run: () => true }),
      makeComponent('b', { run: () => false }),
      makeComponent('c', { run: () => true }),
    ];
    const code = await runSetup(components, ['--all']);
    expect(code).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Barrel export
// ---------------------------------------------------------------------------

describe('src/setup/index.ts barrel export', () => {
  it('re-exports runSetup', async () => {
    const barrel = await import('../../src/setup/index.js');
    expect(typeof barrel.runSetup).toBe('function');
  });

  it('re-exports runCheckboxMenu', async () => {
    const barrel = await import('../../src/setup/index.js');
    expect(typeof barrel.runCheckboxMenu).toBe('function');
  });
});
