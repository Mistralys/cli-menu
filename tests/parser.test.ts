import { describe, it, expect } from 'vitest';
import { parseArgs } from '../src/parser.js';
import type { ParsedArgs } from '../src/parser.js';

describe('parseArgs', () => {
  it('returns { command: null, flags: [] } for empty argv', () => {
    expect(parseArgs([])).toEqual({ command: null, flags: [] });
  });

  it('returns { command: null, flags } for flags-only input', () => {
    expect(parseArgs(['--verbose'])).toEqual({ command: null, flags: ['--verbose'] });
  });

  it('returns { command: null, flags } for multiple flags-only input', () => {
    expect(parseArgs(['--verbose', '--dry-run'])).toEqual({
      command: null,
      flags: ['--verbose', '--dry-run'],
    });
  });

  it('returns command and empty flags when no flags given', () => {
    expect(parseArgs(['build'])).toEqual({ command: 'build', flags: [] });
  });

  it('returns correct command and all flags for command + flags input', () => {
    expect(parseArgs(['build', '--watch', '--verbose'])).toEqual({
      command: 'build',
      flags: ['--watch', '--verbose'],
    });
  });

  it('parses a command with dashes as a command, not a flag', () => {
    expect(parseArgs(['build-docs'])).toEqual({ command: 'build-docs', flags: [] });
    expect(parseArgs(['build-docs', '--check'])).toEqual({
      command: 'build-docs',
      flags: ['--check'],
    });
  });

  it('collects multiple flags in order', () => {
    expect(parseArgs(['run', '-v', '--force', '--env', 'prod'])).toEqual({
      command: 'run',
      flags: ['-v', '--force', '--env', 'prod'],
    });
  });

  it('treats a leading flag as no-command and everything as flags', () => {
    expect(parseArgs(['--help'])).toEqual({ command: null, flags: ['--help'] });
  });
});

describe('ParsedArgs (re-export from parser.ts)', () => {
  it('is importable from parser.ts and matches the shape of parseArgs output', () => {
    const result: ParsedArgs = parseArgs(['build', '--watch']);
    expect(result.command).toBe('build');
    expect(result.flags).toEqual(['--watch']);
  });
});
