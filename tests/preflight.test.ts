import { describe, it, expect, vi, afterEach } from 'vitest';
import { PreflightError, checkNodeVersion } from '../src/preflight.js';

describe('PreflightError', () => {
  it('extends Error', () => {
    const err = new PreflightError('test error');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PreflightError);
  });

  it('carries a descriptive message', () => {
    const err = new PreflightError('Node.js >= 18 required');
    expect(err.message).toBe('Node.js >= 18 required');
  });

  it('carries exitCode with default 1', () => {
    const err = new PreflightError('something failed');
    expect(err.exitCode).toBe(1);
  });

  it('accepts a custom exitCode', () => {
    const err = new PreflightError('something failed', 2);
    expect(err.exitCode).toBe(2);
  });

  it('has name "PreflightError"', () => {
    const err = new PreflightError('test');
    expect(err.name).toBe('PreflightError');
  });
});

describe('checkNodeVersion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not throw when current Node is above minimum', () => {
    expect(() => checkNodeVersion(1)).not.toThrow();
  });

  it('does not throw when current Node meets the minimum exactly', () => {
    const major = parseInt(process.versions.node.split('.')[0], 10);
    expect(() => checkNodeVersion(major)).not.toThrow();
  });

  it('throws PreflightError when required major version is very high', () => {
    expect(() => checkNodeVersion(99)).toThrow(PreflightError);
  });

  it('includes the current version in the thrown error message', () => {
    try {
      checkNodeVersion(99);
    } catch (err) {
      expect(err).toBeInstanceOf(PreflightError);
      expect((err as PreflightError).message).toContain(process.versions.node);
    }
  });

  it('thrown PreflightError has exitCode 1', () => {
    try {
      checkNodeVersion(99);
    } catch (err) {
      expect((err as PreflightError).exitCode).toBe(1);
    }
  });

  it('defaults to minMajor = 18 (does not throw on current Node >= 18)', () => {
    const major = parseInt(process.versions.node.split('.')[0], 10);
    if (major >= 18) {
      expect(() => checkNodeVersion()).not.toThrow();
    } else {
      expect(() => checkNodeVersion()).toThrow(PreflightError);
    }
  });
});
