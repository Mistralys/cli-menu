import type { MenuConfig } from './types.js';

/**
 * Resolve the version string from a `MenuConfig`.
 *
 * Returns the literal string when `version` is a string, or invokes the
 * function and returns its result when `version` is a function.
 *
 * If `version` is a function and it throws, the exception propagates to
 * the caller — no error boundary is applied here.
 */
export function resolveVersion(config: MenuConfig): string {
  return typeof config.version === 'function' ? config.version() : config.version;
}
