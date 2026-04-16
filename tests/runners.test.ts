import { describe, it, expect, vi, afterEach } from 'vitest';
import { IS_WIN, NPM, runScript, runLongScript, sh } from '../src/runners.js';
import type { ChildProcess } from 'node:child_process';

// ESM built-in modules cannot be configured via vi.spyOn — use vi.mock with factory.
const mockSpawnSync = vi.fn();
const mockSpawn = vi.fn();

vi.mock('node:child_process', () => ({
  spawnSync: (...args: unknown[]) => mockSpawnSync(...args),
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

function makeSpawnResult(status: number | null) {
  return {
    status,
    pid: 1,
    output: [],
    stdout: Buffer.from(''),
    stderr: Buffer.from(''),
    signal: null,
    error: undefined,
  };
}

// ---------------------------------------------------------------------------
// Platform constants
// ---------------------------------------------------------------------------

describe('IS_WIN', () => {
  it('is a boolean', () => {
    expect(typeof IS_WIN).toBe('boolean');
  });

  it('is true only on Windows', () => {
    expect(IS_WIN).toBe(process.platform === 'win32');
  });
});

describe('NPM', () => {
  it('is a non-empty string', () => {
    expect(typeof NPM).toBe('string');
    expect(NPM.length).toBeGreaterThan(0);
  });

  it('is "npm.cmd" on Windows, "npm" elsewhere', () => {
    expect(NPM).toBe(process.platform === 'win32' ? 'npm.cmd' : 'npm');
  });
});

// ---------------------------------------------------------------------------
// runScript()
// ---------------------------------------------------------------------------

describe('runScript()', () => {
  afterEach(() => {
    mockSpawnSync.mockReset();
  });

  it('returns numeric exit code 0 on success', () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult(0));
    expect(runScript('echo', ['hello'])).toBe(0);
  });

  it('returns non-zero exit code on failure', () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult(2));
    expect(runScript('false', [])).toBe(2);
  });

  it('returns 1 when status is null (process killed)', () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult(null));
    expect(runScript('something', [])).toBe(1);
  });

  it('passes command and args to spawnSync', () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult(0));
    runScript('node', ['--version']);
    expect(mockSpawnSync).toHaveBeenCalledWith(
      'node',
      ['--version'],
      expect.objectContaining({ stdio: 'inherit' }),
    );
  });

  it('merges custom options into spawnSync call', () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult(0));
    runScript('node', [], { cwd: '/tmp', shell: true });
    expect(mockSpawnSync).toHaveBeenCalledWith(
      'node',
      [],
      expect.objectContaining({ cwd: '/tmp', shell: true }),
    );
  });
});

// ---------------------------------------------------------------------------
// runLongScript()
// ---------------------------------------------------------------------------

describe('runLongScript()', () => {
  afterEach(() => {
    mockSpawn.mockReset();
  });

  it('returns an object with child (ChildProcess) and exitCode (Promise)', () => {
    const fakeChild = { on: vi.fn(), pid: 42 } as unknown as ChildProcess;
    mockSpawn.mockReturnValue(fakeChild);

    const result = runLongScript('node', ['--version']);

    expect(result).toHaveProperty('child');
    expect(result).toHaveProperty('exitCode');
    expect(result.child).toBe(fakeChild);
    expect(result.exitCode).toBeInstanceOf(Promise);
  });

  it('exitCode resolves to the exit code from the "exit" event', async () => {
    type ExitHandler = (code: number | null) => void;
    const handlers: Record<string, ExitHandler> = {};
    const fakeChild = {
      on: vi.fn((event: string, handler: ExitHandler) => {
        handlers[event] = handler;
      }),
    } as unknown as ChildProcess;
    mockSpawn.mockReturnValue(fakeChild);

    const { exitCode } = runLongScript('node', []);
    handlers['exit'](3);
    expect(await exitCode).toBe(3);
  });

  it('exitCode resolves to 1 when exit code is null', async () => {
    type ExitHandler = (code: number | null) => void;
    const handlers: Record<string, ExitHandler> = {};
    const fakeChild = {
      on: vi.fn((event: string, handler: ExitHandler) => {
        handlers[event] = handler;
      }),
    } as unknown as ChildProcess;
    mockSpawn.mockReturnValue(fakeChild);

    const { exitCode } = runLongScript('node', []);
    handlers['exit'](null);
    expect(await exitCode).toBe(1);
  });

  it('exitCode resolves to 1 on error event', async () => {
    type ErrorHandler = (err: Error) => void;
    const handlers: Record<string, ErrorHandler> = {};
    const fakeChild = {
      on: vi.fn((event: string, handler: ErrorHandler) => {
        handlers[event] = handler;
      }),
    } as unknown as ChildProcess;
    mockSpawn.mockReturnValue(fakeChild);

    const { exitCode } = runLongScript('node', []);
    handlers['error'](new Error('ENOENT'));
    expect(await exitCode).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// sh()
// ---------------------------------------------------------------------------

describe('sh()', () => {
  afterEach(() => {
    mockSpawnSync.mockReset();
  });

  it('returns 0 on success', () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult(0));
    expect(sh('echo', ['hello'])).toBe(0);
  });

  it('returns non-zero exit code on failure', () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult(127));
    expect(sh('unknown-cmd', [])).toBe(127);
  });

  it('returns 1 when status is null', () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult(null));
    expect(sh('cmd', [])).toBe(1);
  });

  it('defaults shell to IS_WIN', () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult(0));
    sh('echo', ['hi']);
    expect(mockSpawnSync).toHaveBeenCalledWith(
      'echo',
      ['hi'],
      expect.objectContaining({ shell: IS_WIN }),
    );
  });

  it('allows overriding shell option', () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult(0));
    sh('echo', ['hi'], { shell: true });
    expect(mockSpawnSync).toHaveBeenCalledWith(
      'echo',
      ['hi'],
      expect.objectContaining({ shell: true }),
    );
  });

  it('merges cwd option into spawnSync call', () => {
    mockSpawnSync.mockReturnValue(makeSpawnResult(0));
    sh('npm', ['install'], { cwd: '/workspace' });
    expect(mockSpawnSync).toHaveBeenCalledWith(
      'npm',
      ['install'],
      expect.objectContaining({ cwd: '/workspace' }),
    );
  });
});

// ---------------------------------------------------------------------------
// No process.exit() in module (static check via source inspection)
// ---------------------------------------------------------------------------

describe('runners module — no process.exit()', () => {
  it('source does not contain process.exit() in executable code lines', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath, URL } = await import('node:url');
    const src = readFileSync(
      fileURLToPath(new URL('../src/runners.ts', import.meta.url)),
      'utf8',
    );
    // Strip comment lines (single-line `//` and JSDoc `*` lines) before checking.
    const codeLines = src
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*)/.test(line));
    const codeOnly = codeLines.join('\n');
    expect(codeOnly).not.toMatch(/process\.exit\(/);
  });
});
