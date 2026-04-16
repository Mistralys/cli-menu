import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChangelogEntry } from '../types.js';

export type { ChangelogEntry };

/**
 * Extract the version string from the first changelog heading in `filePath`.
 * Recognises both `## v1.2.3` and `## [1.2.3]` heading formats.
 *
 * @param filePath - Absolute path to the changelog Markdown file.
 * @returns A `"vX.Y.Z"` string, or `"unknown"` if the file is missing or has
 *          no parseable version heading.
 */
export function readChangelogVersion(filePath: string): string {
  try {
    const content = readFileSync(filePath, 'utf8');
    const m = content.match(/^##\s+(?:\[|v)?(\d+\.\d+\.\d+)/m);
    return m ? `v${m[1]}` : 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Extract the first entry from a changelog file, returning its version,
 * title, and body text.
 *
 * Recognises headings in the forms:
 * - `## v1.2.3 — Title`
 * - `## [1.2.3] Title`
 * - `## v1.2.3` (no title)
 *
 * CRLF line endings are normalised to LF before parsing.
 *
 * @param filePath - Absolute path to the changelog Markdown file.
 * @returns A `ChangelogEntry` object, or `null` if no parseable entry is found
 *          or the file cannot be read.
 */
export function extractChangelogEntry(filePath: string): ChangelogEntry | null {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const content = raw.replace(/\r\n/g, '\n');

    // Match the first ## heading containing a semver version.
    // Handles: ## v1.2.3, ## [1.2.3], ## v1.2.3 — Title, ## [1.2.3] - Title
    const headingRe = /^##\s+(?:\[?v?)(\d+\.\d+\.\d+)\]?\s*[-–—]?\s*(.*?)$/m;
    const headingMatch = content.match(headingRe);
    if (!headingMatch) return null;

    const version = `v${headingMatch[1]}`;
    const title = headingMatch[2].trim();

    // Body: everything after the heading line, up to the next ## heading or EOF.
    const headingEnd = (headingMatch.index ?? 0) + headingMatch[0].length;
    const remainder = content.slice(headingEnd);
    const nextHeadingPos = remainder.search(/^##\s/m);
    const bodyRaw = nextHeadingPos >= 0 ? remainder.slice(0, nextHeadingPos) : remainder;
    const body = bodyRaw.trim();

    return { version, title, body };
  } catch {
    return null;
  }
}

/**
 * Extract the version string from `package.json` inside `dirPath`.
 *
 * @param dirPath - Directory containing a `package.json` file.
 * @returns `"vX.Y.Z"`, or `"unknown"` on read or parse failure.
 */
export function readPackageVersion(dirPath: string): string {
  try {
    const content = readFileSync(join(dirPath, 'package.json'), 'utf8');
    const pkg = JSON.parse(content) as { version?: string };
    return pkg.version ? `v${pkg.version}` : 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Extract the version string from `pyproject.toml` inside `dirPath`.
 * Looks for a line matching `version = "X.Y.Z"`.
 *
 * @param dirPath - Directory containing a `pyproject.toml` file.
 * @returns `"vX.Y.Z"`, or `"unknown"` on read or parse failure.
 */
export function readPyprojectVersion(dirPath: string): string {
  try {
    const content = readFileSync(join(dirPath, 'pyproject.toml'), 'utf8');
    const m = content.match(/^version\s*=\s*"([^"]+)"/m);
    return m ? `v${m[1]}` : 'unknown';
  } catch {
    return 'unknown';
  }
}