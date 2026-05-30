import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderMenu } from '../../src/menu/renderer.js';
import * as screen from '../../src/screen.js';
import type { Command, MenuConfig } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ANSI cyan code */
const CYAN_CODE = '\x1b[36m';
/** ANSI dim code */
const DIM_CODE = '\x1b[2m';
/** ANSI bold code */
const BOLD_CODE = '\x1b[1m';

function makeCommand(overrides: Partial<Command> & Pick<Command, 'id' | 'key' | 'label' | 'category'>): Command {
  return {
    description: 'Test command',
    run: () => {},
    ...overrides,
  };
}

function makeConfig(overrides: Partial<MenuConfig> = {}): MenuConfig {
  return {
    name: 'Test CLI',
    banner: ['=== TEST CLI ==='],
    version: '1.2.3',
    commands: [
      makeCommand({ id: 'build', key: 'b', label: 'Build', category: 'Development' }),
      makeCommand({ id: 'test', key: 't', label: 'Test', category: 'Development' }),
    ],
    workspaceRoot: '/tmp/test',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('renderMenu()', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let clearScreenSpy: ReturnType<typeof vi.spyOn>;
  let output: () => string;

  beforeEach(() => {
    clearScreenSpy = vi.spyOn(screen, 'clearScreen').mockImplementation(() => {});
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    output = () => writeSpy.mock.calls.map(([arg]) => String(arg)).join('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  it('calls clearScreen() to clear the terminal', () => {
    renderMenu(makeConfig());
    expect(clearScreenSpy).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Banner
  // -------------------------------------------------------------------------

  it('renders banner lines wrapped in cyan', () => {
    renderMenu(makeConfig({ banner: ['LINE ONE', 'LINE TWO'] }));
    const result = output();
    expect(result).toContain(CYAN_CODE + 'LINE ONE');
    expect(result).toContain(CYAN_CODE + 'LINE TWO');
  });

  it('renders each banner line on a separate line', () => {
    renderMenu(makeConfig({ banner: ['LINE ONE', 'LINE TWO'] }));
    const result = output();
    expect(result).toMatch(/LINE ONE.*\n/);
    expect(result).toMatch(/LINE TWO.*\n/);
  });

  // -------------------------------------------------------------------------
  // Version
  // -------------------------------------------------------------------------

  it('renders the version string wrapped in dim', () => {
    renderMenu(makeConfig({ version: '3.7.1' }));
    const result = output();
    expect(result).toContain(DIM_CODE);
    expect(result).toContain('3.7.1');
  });

  it('resolves a version function and renders the result in dim', () => {
    renderMenu(makeConfig({ version: () => '9.0.0' }));
    const result = output();
    expect(result).toContain(DIM_CODE);
    expect(result).toContain('9.0.0');
  });

  it('renders the application name alongside the version', () => {
    renderMenu(makeConfig({ name: 'My CLI', version: '1.0.0' }));
    const result = output();
    expect(result).toContain('My CLI');
    expect(result).toContain('1.0.0');
    // Both appear on the same dim-wrapped line
    const dimIdx = result.indexOf(DIM_CODE + '  My CLI');
    expect(dimIdx).toBeGreaterThanOrEqual(0);
  });

  // -------------------------------------------------------------------------
  // Category headers
  // -------------------------------------------------------------------------

  it('renders category headers in bold', () => {
    renderMenu(makeConfig());
    expect(output()).toContain(BOLD_CODE + '  Development');
  });

  it('renders each unique category header once', () => {
    const config = makeConfig({
      commands: [
        makeCommand({ id: 'a', key: 'a', label: 'A', category: 'Cat A' }),
        makeCommand({ id: 'b', key: 'b', label: 'B', category: 'Cat B' }),
        makeCommand({ id: 'c', key: 'c', label: 'C', category: 'Cat A' }),
      ],
    });
    renderMenu(config);
    const result = output();
    // 'Cat A' should appear exactly once as a bold header (use split to avoid regex ANSI issues)
    const headerMatches = result.split(BOLD_CODE + '  Cat A').length - 1;
    expect(headerMatches).toBe(1);
  });

  it('appends sub-project version in dim after category header when categoryVersions is set', () => {
    const config = makeConfig({
      categoryVersions: { Development: () => '2.0.0' },
    });
    renderMenu(config);
    const result = output();
    expect(result).toContain(BOLD_CODE + '  Development');
    expect(result).toContain('2.0.0');
    // The version part is dim (not bold)
    const devIdx = result.indexOf(BOLD_CODE + '  Development');
    const versionIdx = result.indexOf('2.0.0', devIdx);
    const dimBeforeVersion = result.lastIndexOf(DIM_CODE, versionIdx);
    expect(dimBeforeVersion).toBeGreaterThan(devIdx);
  });

  it('does not append a version to categories without a categoryVersions entry', () => {
    const config = makeConfig({
      commands: [
        makeCommand({ id: 'a', key: 'a', label: 'A', category: 'Build' }),
        makeCommand({ id: 'b', key: 'b', label: 'B', category: 'Test' }),
      ],
      categoryVersions: { Build: () => '1.0.0' },
    });
    renderMenu(config);
    const result = output();
    // 'Test' header line should be present but have no version after it on the same segment
    expect(result).toContain(BOLD_CODE + '  Test');
    // Check that '1.0.0' only appears near the Build section, not the Test section
    const testHeaderIdx = result.indexOf(BOLD_CODE + '  Test');
    const buildHeaderIdx = result.indexOf(BOLD_CODE + '  Build');
    const versionIdx = result.indexOf('1.0.0');
    expect(versionIdx).toBeGreaterThan(buildHeaderIdx);
    expect(versionIdx).toBeLessThan(testHeaderIdx);
  });

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  it('renders commands with their hotkey and label', () => {
    renderMenu(makeConfig());
    const result = output();
    // Key is rendered as "b." in cyan
    expect(result).toContain(CYAN_CODE + 'b.');
    expect(result).toContain(CYAN_CODE + 't.');
    // Label text is present
    expect(result).toContain('Build');
    expect(result).toContain('Test');
  });

  it('renders command keys in cyan', () => {
    renderMenu(makeConfig());
    const result = output();
    expect(result).toContain(CYAN_CODE + 'b.');
  });

  it('renders command descriptions in dim after the label', () => {
    const config = makeConfig({
      commands: [
        makeCommand({ id: 'build', key: 'b', label: 'Build', category: 'Dev', description: 'Compile the project' }),
      ],
    });
    renderMenu(config);
    const result = output();
    expect(result).toContain('Compile the project');
    // Description is dim-wrapped
    const descIdx = result.indexOf('Compile the project');
    const dimBeforeDesc = result.lastIndexOf(DIM_CODE, descIdx);
    expect(dimBeforeDesc).toBeGreaterThanOrEqual(0);
  });

  it('pads labels to 26 characters so descriptions align', () => {
    const config = makeConfig({
      commands: [
        makeCommand({ id: 'short', key: 'a', label: 'Hi', category: 'Cat', description: 'Desc A' }),
        makeCommand({ id: 'long', key: 'b', label: 'A Longer Label Here', category: 'Cat', description: 'Desc B' }),
      ],
    });
    renderMenu(config);
    const result = output();
    // The padding means 'Desc A' and 'Desc B' start at the same column offset;
    // verify the short label is padded (there are many spaces between label and desc)
    expect(result).toMatch(/Hi {24}/);
  });

  it('does not render commands with hidden: true', () => {
    const config = makeConfig({
      commands: [
        makeCommand({ id: 'show', key: 's', label: 'Visible', category: 'A' }),
        makeCommand({ id: 'hide', key: 'h', label: 'Hidden', category: 'A', hidden: true }),
      ],
    });
    renderMenu(config);
    expect(output()).toContain(CYAN_CODE + 's.');
    expect(output()).toContain('Visible');
    expect(output()).not.toContain('Hidden');
  });

  it('does not render commands with key: null', () => {
    const config = makeConfig({
      commands: [
        makeCommand({ id: 'show', key: 's', label: 'Visible', category: 'A' }),
        makeCommand({ id: 'cli-only', key: null, label: 'CLI Only', category: 'A' }),
      ],
    });
    renderMenu(config);
    expect(output()).toContain(CYAN_CODE + 's.');
    expect(output()).toContain('Visible');
    expect(output()).not.toContain('CLI Only');
  });

  it('preserves category insertion order based on first command occurrence', () => {
    const config = makeConfig({
      commands: [
        makeCommand({ id: 'z', key: 'z', label: 'Z cmd', category: 'Zeta' }),
        makeCommand({ id: 'a', key: 'a', label: 'A cmd', category: 'Alpha' }),
      ],
    });
    renderMenu(config);
    const result = output();
    const zetaIdx = result.indexOf('Zeta');
    const alphaIdx = result.indexOf('Alpha');
    expect(zetaIdx).toBeLessThan(alphaIdx);
  });

  // -------------------------------------------------------------------------
  // Footer
  // -------------------------------------------------------------------------

  it('footer shows [h] Help', () => {
    renderMenu(makeConfig());
    expect(output()).toContain('[h] Help');
  });

  it('footer shows [q] Quit', () => {
    renderMenu(makeConfig());
    expect(output()).toContain('[q] Quit');
  });

  // -------------------------------------------------------------------------
  // Prompt
  // -------------------------------------------------------------------------

  it('ends with a Choose: prompt', () => {
    renderMenu(makeConfig());
    expect(output()).toContain('Choose: ');
  });

  it('Choose: prompt has no trailing newline (cursor stays on line)', () => {
    renderMenu(makeConfig());
    const calls = writeSpy.mock.calls.map(([arg]) => String(arg));
    const lastCall = calls[calls.length - 1];
    expect(lastCall).toContain('Choose: ');
    expect(lastCall).not.toMatch(/Choose:.*\n/);
  });

  // -------------------------------------------------------------------------
  // statusLines (AC-1, AC-2, AC-3)
  // -------------------------------------------------------------------------

  it('renders each statusLine indented with two spaces, one per line', () => {
    const config = makeConfig({
      statusLines: [() => 'line alpha', () => 'line beta'],
    });
    renderMenu(config);
    const result = output();
    expect(result).toContain('  line alpha\n');
    expect(result).toContain('  line beta\n');
  });

  it('renders a single blank line after the status block, before commands', () => {
    const config = makeConfig({
      statusLines: [() => '\u2713 Status OK'],
    });
    renderMenu(config);
    const result = output();
    // The blank line after status must appear before the first category header
    const statusIdx = result.indexOf('  \u2713 Status OK');
    const categoryIdx = result.indexOf(BOLD_CODE + '  Development');
    // There should be a blank line (\n\n) between the last status line and the category
    const segment = result.slice(statusIdx, categoryIdx);
    expect(segment).toContain('\n\n');
  });

  it('renders status block between the version line and the command categories', () => {
    const config = makeConfig({
      statusLines: [() => 'health: OK'],
    });
    renderMenu(config);
    const result = output();
    const versionIdx = result.indexOf('1.2.3');
    const statusIdx  = result.indexOf('  health: OK');
    const categoryIdx = result.indexOf(BOLD_CODE + '  Development');
    expect(versionIdx).toBeGreaterThanOrEqual(0);
    expect(statusIdx).toBeGreaterThan(versionIdx);
    expect(categoryIdx).toBeGreaterThan(statusIdx);
  });

  it('leaves output unchanged when statusLines is undefined (AC-3)', () => {
    const withoutStatus = makeConfig();
    const withExplicitUndefined = makeConfig({ statusLines: undefined });

    const captures: string[] = [];
    writeSpy.mockImplementation((chunk) => { captures.push(String(chunk)); return true; });

    renderMenu(withoutStatus);
    const outputWithout = captures.join('');
    captures.length = 0;

    renderMenu(withExplicitUndefined);
    const outputWithUndefined = captures.join('');

    expect(outputWithUndefined).toBe(outputWithout);
  });

  it('leaves output unchanged when statusLines is an empty array (AC-3)', () => {
    const withoutStatus = makeConfig();
    const withEmptyArray = makeConfig({ statusLines: [] });

    const captures: string[] = [];
    writeSpy.mockImplementation((chunk) => { captures.push(String(chunk)); return true; });

    renderMenu(withoutStatus);
    const outputWithout = captures.join('');
    captures.length = 0;

    renderMenu(withEmptyArray);
    const outputWithEmpty = captures.join('');

    expect(outputWithEmpty).toBe(outputWithout);
  });

  it('calls each statusLines function exactly once per render', () => {
    const spy1 = vi.fn(() => 'check one');
    const spy2 = vi.fn(() => 'check two');
    renderMenu(makeConfig({ statusLines: [spy1, spy2] }));
    expect(spy1).toHaveBeenCalledOnce();
    expect(spy2).toHaveBeenCalledOnce();
  });
});
