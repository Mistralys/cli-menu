/**
 * Typed error thrown by pre-flight check functions when a condition is not met.
 * Consumers should catch this error and decide the appropriate exit behavior.
 */
export class PreflightError extends Error {
  /** Exit code to use when reporting this failure. Defaults to 1. */
  readonly exitCode: number;

  constructor(message: string, exitCode: number = 1) {
    super(message);
    this.name = 'PreflightError';
    this.exitCode = exitCode;
    // Restore prototype chain for instanceof checks across transpilation targets
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Built-in pre-flight check that verifies the running Node.js version meets
 * the minimum required major version.
 *
 * @throws {PreflightError} When the Node.js major version is below `minMajor`.
 */
export function checkNodeVersion(minMajor: number = 18): void {
  const current = parseInt(process.versions.node.split('.')[0], 10);
  if (current < minMajor) {
    throw new PreflightError(
      `Node.js >= ${minMajor} required (found ${process.versions.node})`,
    );
  }
}
