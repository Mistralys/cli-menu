import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printHelp } from '../src/help.js';
import { C } from '../src/colors.js';
import type { Command, MenuConfig } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noop = (): void => {};

function makeCommand(
  overrides: Partial<Command> & Pick<Command, 'id' | 'category'>,
): Command {
  return {
    key: null,
    label: overrides.id,
    description: `Description for ${overrides.id}`,
    run: noop,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<MenuConfig> = {}): MenuConfig {
  return {
    name: 'Test CLI',
    banner: [],
    version: '1.0.0',
    commands: [],
    workspaceRoot: process.cwd(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('printHelp()', () => {
  let output: string;

  beforeEach(() => {
    output = '';
    vi.spyOn(process.stdout, 'write').mockImplementation(
      (chunk: string | Uint8Array) => {
        output += String(chunk);
        return true;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Header ────────────────────────────────────────────────────────────────

  it('prints the menu name and resolved version in the header', () => {
    printHelp([], makeConfig({ name: 'My CLI', version: '2.3.4' }));
    expect(output).toContain('My CLI — v2.3.4');
  });

  it('resolves a version function and prints the result', () => {
    printHelp([], makeConfig({ version: () => '9.9.9' }));
    expect(output).toContain('v9.9.9');
  });

  // ── Category grouping ────────────────────────────────────────────────────

  it('groups commands by category — each category header appears in output', () => {
    const commands = [
      makeCommand({ id: 'build', category: 'Build' }),
      makeCommand({ id: 'test', category: 'Testing' }),
    ];
    printHelp(commands, makeConfig());

    expect(output).toContain('Build');
    expect(output).toContain('Testing');
  });

  it('places commands in their category — build and setup before Testing header', () => {
    const commands = [
      makeCommand({ id: 'build', category: 'Build' }),
      makeCommand({ id: 'test', category: 'Testing' }),
      makeCommand({ id: 'setup', category: 'Build' }),
    ];
    printHelp(commands, makeConfig());

    const testingHeaderIdx = output.indexOf(C.bold('Testing'));
    const buildCmdIdx = output.indexOf('  build');
    const setupCmdIdx = output.indexOf('  setup');
    const testCmdIdx = output.indexOf('  test ');

    expect(buildCmdIdx).toBeGreaterThanOrEqual(0);
    expect(setupCmdIdx).toBeGreaterThanOrEqual(0);
    expect(testCmdIdx).toBeGreaterThanOrEqual(0);

    // build and setup appear before the Testing header
    expect(buildCmdIdx).toBeLessThan(testingHeaderIdx);
    expect(setupCmdIdx).toBeLessThan(testingHeaderIdx);
    // test command appears after the Testing header
    expect(testCmdIdx).toBeGreaterThan(testingHeaderIdx);
  });

  // ── Visibility filtering ────────────────────────────────────────────────

  it('excludes commands with hidden: true', () => {
    const commands = [
      makeCommand({ id: 'visible', category: 'Cat' }),
      makeCommand({ id: 'secret', category: 'Cat', hidden: true }),
    ];
    printHelp(commands, makeConfig());

    expect(output).toContain('visible');
    expect(output).not.toContain('secret');
  });

  it('excludes commands with helpHidden: true', () => {
    const commands = [
      makeCommand({ id: 'shown', category: 'Cat' }),
      makeCommand({ id: 'nohelp', category: 'Cat', helpHidden: true }),
    ];
    printHelp(commands, makeConfig());

    expect(output).toContain('shown');
    expect(output).not.toContain('nohelp');
  });

  it('excludes a command with both hidden and helpHidden set', () => {
    const commands = [
      makeCommand({ id: 'double-hidden', category: 'Cat', hidden: true, helpHidden: true }),
    ];
    printHelp(commands, makeConfig());
    expect(output).not.toContain('double-hidden');
  });

  // ── helpVariants ─────────────────────────────────────────────────────────

  it('renders helpVariants as sub-entries immediately after the parent command', () => {
    const commands = [
      makeCommand({
        id: 'setup',
        category: 'Build',
        description: 'Run setup',
        helpVariants: [
          ['setup --all', 'Non-interactive full setup'],
          ['setup --skip', 'Skip optional steps'],
        ],
      }),
    ];
    printHelp(commands, makeConfig());

    const setupIdx = output.indexOf('  setup ');
    const allIdx = output.indexOf('setup --all');
    const skipIdx = output.indexOf('setup --skip');

    expect(setupIdx).toBeGreaterThanOrEqual(0);
    expect(allIdx).toBeGreaterThan(setupIdx);
    expect(skipIdx).toBeGreaterThan(allIdx);
  });

  it('renders helpVariant descriptions in dim color', () => {
    const commands = [
      makeCommand({
        id: 'setup',
        category: 'Build',
        helpVariants: [['setup --all', 'Full setup']],
      }),
    ];
    printHelp(commands, makeConfig());
    expect(output).toContain(C.dim('Full setup'));
  });

  // ── Sorting ───────────────────────────────────────────────────────────────

  it('sorts commands with helpOrder numerically (ascending)', () => {
    const commands = [
      makeCommand({ id: 'cmd-c', category: 'Cat', helpOrder: 3 }),
      makeCommand({ id: 'cmd-a', category: 'Cat', helpOrder: 1 }),
      makeCommand({ id: 'cmd-b', category: 'Cat', helpOrder: 2 }),
    ];
    printHelp(commands, makeConfig());

    const aIdx = output.indexOf('  cmd-a');
    const bIdx = output.indexOf('  cmd-b');
    const cIdx = output.indexOf('  cmd-c');

    expect(aIdx).toBeLessThan(bIdx);
    expect(bIdx).toBeLessThan(cIdx);
  });

  it('retains insertion order for commands without helpOrder', () => {
    const commands = [
      makeCommand({ id: 'first', category: 'Cat' }),
      makeCommand({ id: 'second', category: 'Cat' }),
      makeCommand({ id: 'third', category: 'Cat' }),
    ];
    printHelp(commands, makeConfig());

    const firstIdx = output.indexOf('  first');
    const secondIdx = output.indexOf('  second');
    const thirdIdx = output.indexOf('  third');

    expect(firstIdx).toBeLessThan(secondIdx);
    expect(secondIdx).toBeLessThan(thirdIdx);
  });

  it('preserves insertion order among unordered commands when mixed with ordered ones', () => {
    // un-1 and un-2 have no helpOrder; they should retain their relative order.
    const commands = [
      makeCommand({ id: 'un-1', category: 'Cat' }),
      makeCommand({ id: 'ordered', category: 'Cat', helpOrder: 1 }),
      makeCommand({ id: 'un-2', category: 'Cat' }),
    ];
    printHelp(commands, makeConfig());

    const un1Idx = output.indexOf('  un-1');
    const un2Idx = output.indexOf('  un-2');
    expect(un1Idx).toBeLessThan(un2Idx);
  });

  // ── help entry ────────────────────────────────────────────────────────────

  it('appends a synthetic help entry as the last command in output', () => {
    const commands = [makeCommand({ id: 'build', category: 'Cat' })];
    printHelp(commands, makeConfig());

    // The help entry must appear after all user commands.
    const buildIdx = output.lastIndexOf('  build');
    const helpIdx = output.lastIndexOf('  help');

    expect(helpIdx).toBeGreaterThan(buildIdx);
  });

  it('appends help last even when a command has a very large helpOrder', () => {
    const commands = [
      makeCommand({ id: 'cmd-x', category: 'Cat', helpOrder: 9999 }),
    ];
    printHelp(commands, makeConfig());

    const cmdXIdx = output.lastIndexOf('  cmd-x');
    const helpIdx = output.lastIndexOf('  help');

    expect(helpIdx).toBeGreaterThan(cmdXIdx);
  });

  it('renders the help entry with "Show this help" description in dim color', () => {
    printHelp([], makeConfig());
    expect(output).toContain(C.dim('Show this help'));
  });

  // ── Formatting ────────────────────────────────────────────────────────────

  it('renders command descriptions in dim color', () => {
    const commands = [makeCommand({ id: 'build', category: 'Cat', description: 'Build it' })];
    printHelp(commands, makeConfig());
    expect(output).toContain(C.dim('Build it'));
  });

  it('pads command names to CMD_WIDTH before the description', () => {
    const commands = [makeCommand({ id: 'x', category: 'Cat', description: 'Desc' })];
    printHelp(commands, makeConfig());
    // 'x' padded to 28 chars = 'x' + 27 spaces
    expect(output).toContain('  ' + 'x'.padEnd(28) + C.dim('Desc'));
  });

  it('outputs the usage line from config.usageLine when provided', () => {
    printHelp([], makeConfig({ usageLine: 'node scripts/cli.js [command] [options]' }));
    expect(output).toContain('Usage: node scripts/cli.js [command] [options]');
  });

  it('falls back to process.argv[1] as usage line when usageLine is not set', () => {
    printHelp([], makeConfig());
    expect(output).toContain(`Usage: ${process.argv[1]}`);
  });

  // ── duplicated help-guard ─────────────────────────────────────────────────

  it("skips synthetic help entry when commands include id: 'help'", () => {
    const commands = [
      makeCommand({ id: 'build', category: 'Cat' }),
      makeCommand({ id: 'help', category: 'Cat', description: 'Custom help command' }),
    ];
    printHelp(commands, makeConfig());
    // 'help' entry must appear exactly once (the user-registered one, not a duplicate).
    const first = output.indexOf('  help');
    const last = output.lastIndexOf('  help');
    expect(first).toBe(last);
  });

  it("still appends synthetic help entry when no command has id: 'help'", () => {
    const commands = [makeCommand({ id: 'build', category: 'Cat' })];
    printHelp(commands, makeConfig());
    // The format mirrors formatEntry: 2 spaces + name padded to 28 + dim description.
    expect(output).toContain('  ' + 'help'.padEnd(28) + C.dim('Show this help'));
  });

  it('outputs the footer line', () => {
    printHelp([], makeConfig());
    expect(output).toContain('Run without arguments for interactive mode.');
  });
});
