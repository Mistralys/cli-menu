import { describe, it, expect, vi, afterEach } from 'vitest';
import { C, log } from '../src/colors.js';
import type { Colors } from '../src/colors.js';

const RESET = '\x1b[0m';

describe('C color helpers', () => {
  it('wraps input in correct ANSI codes and resets at end (green)', () => {
    expect(C.green('text')).toBe('\x1b[32mtext\x1b[0m');
  });

  it('wraps input in correct ANSI codes and resets at end (red)', () => {
    expect(C.red('text')).toBe('\x1b[31mtext\x1b[0m');
  });

  it('wraps input in correct ANSI codes and resets at end (cyan)', () => {
    expect(C.cyan('text')).toBe('\x1b[36mtext\x1b[0m');
  });

  it('wraps input in correct ANSI codes and resets at end (bold)', () => {
    expect(C.bold('text')).toBe('\x1b[1mtext\x1b[0m');
  });

  it('wraps input in correct ANSI codes and resets at end (yellow)', () => {
    expect(C.yellow('text')).toBe('\x1b[33mtext\x1b[0m');
  });

  it('wraps input in correct ANSI codes and resets at end (blue)', () => {
    expect(C.blue('text')).toBe('\x1b[34mtext\x1b[0m');
  });

  it('wraps input in correct ANSI codes and resets at end (magenta)', () => {
    expect(C.magenta('text')).toBe('\x1b[35mtext\x1b[0m');
  });

  it('wraps input in correct ANSI codes and resets at end (white)', () => {
    expect(C.white('text')).toBe('\x1b[37mtext\x1b[0m');
  });

  it('wraps input in correct ANSI codes and resets at end (gray)', () => {
    expect(C.gray('text')).toBe('\x1b[90mtext\x1b[0m');
  });

  it('wraps input in correct ANSI codes and resets at end (dim)', () => {
    expect(C.dim('text')).toBe('\x1b[2mtext\x1b[0m');
  });

  it('wraps input in correct ANSI codes and resets at end (underline)', () => {
    expect(C.underline('text')).toBe('\x1b[4mtext\x1b[0m');
  });

  it('produces nested sequences when composing: C.bold(C.cyan("text"))', () => {
    const result = C.bold(C.cyan('text'));
    expect(result).toBe('\x1b[1m\x1b[36mtext\x1b[0m\x1b[0m');
  });

  it('inner escape sequence is present inside outer when composing', () => {
    const inner = C.cyan('text');
    const outer = C.bold(inner);
    expect(outer).toContain('\x1b[1m');
    expect(outer).toContain(inner);
    expect(outer.endsWith(RESET)).toBe(true);
  });

  it('handles empty string input', () => {
    expect(C.green('')).toBe('\x1b[32m\x1b[0m');
  });
});

describe('log()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('outputs green-colored text to stdout for log("msg", "green")', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    log('msg', 'green');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(C.green('msg') + '\n');
  });

  it('outputs uncolored text to stdout for log("msg")', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    log('msg');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith('msg\n');
  });

  it('outputs uncolored text for log("msg", "nonexistent")', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    log('msg', 'nonexistent');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith('msg\n');
  });

  it('outputs uncolored text when color is an empty string', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    log('msg', '');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith('msg\n');
  });

  it('applies each valid color without throwing', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const colors: Colors[] = ['red', 'cyan', 'bold', 'yellow', 'blue', 'magenta', 'dim', 'gray'];
    for (const color of colors) {
      log('test', color);
    }
    expect(spy).toHaveBeenCalledTimes(colors.length);
  });
});

describe('Colors type', () => {
  it('Colors type encompasses all keys of C', () => {
    // Compile-time check: every key of C must be assignable to Colors.
    // This test confirms the type is derived from C by ensuring a runtime
    // enumeration of C's keys matches what we can assign to Colors.
    const keys = Object.keys(C) as Colors[];
    expect(keys).toContain('green');
    expect(keys).toContain('red');
    expect(keys).toContain('cyan');
    expect(keys).toContain('bold');
    expect(keys).toContain('yellow');
    expect(keys).toContain('blue');
    expect(keys).toContain('magenta');
    expect(keys).toContain('white');
    expect(keys).toContain('gray');
    expect(keys).toContain('dim');
    expect(keys).toContain('italic');
    expect(keys).toContain('underline');
    expect(keys).toContain('black');
  });
});
