import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readChangelogVersion,
  extractChangelogEntry,
  readPackageVersion,
  readPyprojectVersion,
} from '../src/changelog/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES_DIR = join(__dirname, '..', 'fixtures');
const CHANGELOGS_DIR = join(FIXTURES_DIR, 'changelogs');
const MANIFESTS_DIR = join(FIXTURES_DIR, 'manifests');

// ---------------------------------------------------------------------------
// readChangelogVersion()
// ---------------------------------------------------------------------------

describe('readChangelogVersion()', () => {
  it('parses ## v1.2.3 format', () => {
    expect(readChangelogVersion(join(CHANGELOGS_DIR, 'basic.md'))).toBe('v2.1.0');
  });

  it('parses ## [1.2.3] format', () => {
    expect(readChangelogVersion(join(CHANGELOGS_DIR, 'bracket-format.md'))).toBe('v1.5.2');
  });

  it('returns "unknown" for a missing file', () => {
    expect(readChangelogVersion(join(CHANGELOGS_DIR, 'does-not-exist.md'))).toBe('unknown');
  });

  it('returns "unknown" for a file with no version heading', () => {
    // /dev/null: reads as empty on POSIX (regex miss → 'unknown'); throws on Windows (catch → 'unknown').
    // Both code paths produce 'unknown', making this fixture cross-platform correct.
    expect(readChangelogVersion('/dev/null')).toBe('unknown');
  });

  it('parses CRLF file without error', () => {
    expect(readChangelogVersion(join(CHANGELOGS_DIR, 'crlf.md'))).toBe('v2.1.0');
  });
});

// ---------------------------------------------------------------------------
// extractChangelogEntry()
// ---------------------------------------------------------------------------

describe('extractChangelogEntry()', () => {
  it('returns version, title, and body for a valid entry', () => {
    const entry = extractChangelogEntry(join(CHANGELOGS_DIR, 'basic.md'));
    expect(entry).not.toBeNull();
    expect(entry?.version).toBe('v2.1.0');
    expect(entry?.title).toBe('CRLF Test Entry');
    expect(entry?.body).toContain('First bullet point');
  });

  it('stops body at the next ## heading', () => {
    const entry = extractChangelogEntry(join(CHANGELOGS_DIR, 'basic.md'));
    expect(entry?.body).not.toContain('Previous Entry');
    expect(entry?.body).not.toContain('Older change');
  });

  it('handles CRLF line endings', () => {
    const entry = extractChangelogEntry(join(CHANGELOGS_DIR, 'crlf.md'));
    expect(entry).not.toBeNull();
    expect(entry?.version).toBe('v2.1.0');
    expect(entry?.title).toBe('CRLF Test Entry');
    expect(entry?.body).toContain('First bullet point');
    expect(entry?.body).not.toContain('Previous Entry');
    // Body should not contain raw CR characters after normalisation
    expect(entry?.body).not.toContain('\r');
  });

  it('parses bracket-format heading', () => {
    const entry = extractChangelogEntry(join(CHANGELOGS_DIR, 'bracket-format.md'));
    expect(entry).not.toBeNull();
    expect(entry?.version).toBe('v1.5.2');
    expect(entry?.title).toBe('Bracket Format Entry');
    expect(entry?.body).toContain('Feature A added');
  });

  it('returns null for a missing file', () => {
    expect(extractChangelogEntry(join(CHANGELOGS_DIR, 'does-not-exist.md'))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readPackageVersion()
// ---------------------------------------------------------------------------

describe('readPackageVersion()', () => {
  it('extracts version from a valid package.json', () => {
    expect(readPackageVersion(MANIFESTS_DIR)).toBe('v3.7.1');
  });

  it('returns "unknown" for missing directory', () => {
    expect(readPackageVersion(join(MANIFESTS_DIR, 'nonexistent'))).toBe('unknown');
  });

  it('returns "unknown" for malformed JSON', async () => {
    // Write a malformed package.json to a temp dir and test
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const tmp = mkdtempSync(join(tmpdir(), 'cli-menu-test-'));
    writeFileSync(join(tmp, 'package.json'), 'NOT JSON');
    try {
      expect(readPackageVersion(tmp)).toBe('unknown');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// readPyprojectVersion()
// ---------------------------------------------------------------------------

describe('readPyprojectVersion()', () => {
  it('extracts version from a valid pyproject.toml', () => {
    expect(readPyprojectVersion(MANIFESTS_DIR)).toBe('v0.8.4');
  });

  it('returns "unknown" for missing directory', () => {
    expect(readPyprojectVersion(join(MANIFESTS_DIR, 'nonexistent'))).toBe('unknown');
  });

  it('returns "unknown" when pyproject.toml has no version field', async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const tmp = mkdtempSync(join(tmpdir(), 'cli-menu-test-'));
    writeFileSync(join(tmp, 'pyproject.toml'), '[tool.poetry]\nname = "no-version"\n');
    try {
      expect(readPyprojectVersion(tmp)).toBe('unknown');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
