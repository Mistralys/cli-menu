#!/usr/bin/env node

/**
 * CLI menu for @mistralys/cli-menu project operations.
 *
 * Dogfoods the library itself: imports `createMenu` from the built `dist/`
 * output and wires up developer-facing commands (pre-release checks, test,
 * build, etc.).
 *
 * Usage:
 *   node scripts/cli.js                  # interactive menu (TTY)
 *   node scripts/cli.js release-check    # run all pre-release checks
 *   node scripts/cli.js typecheck        # run TypeScript type check
 *   node scripts/cli.js test             # run test suite
 *   node scripts/cli.js build            # build dist/ output
 *   node scripts/cli.js help             # show all commands
 */

import { existsSync, accessSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Import from own dist/ — a fresh build is required before first use.
// ---------------------------------------------------------------------------

const distIndex = join(ROOT, 'dist', 'index.js');
if (!existsSync(distIndex)) {
  process.stderr.write(
    'Error: dist/ not found. Run `npm run build` before using this menu.\n',
  );
  process.exit(1);
}

const {
  createMenu,
  checkNodeVersion,
  runScript,
  NPM,
  C,
  log,
} = await import(distIndex);

const { readChangelogVersion, readPackageVersion } = await import(
  join(ROOT, 'dist', 'changelog', 'index.js')
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHANGELOG_PATH = join(ROOT, 'CHANGELOG.md');

/**
 * Run a shell command synchronously, returning the trimmed stdout.
 * Returns an empty string on failure.
 */
function capture(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/**
 * Print a check result line.
 */
function printCheck(label, passed, detail) {
  const icon = passed ? C.green('✓') : C.red('✗');
  const msg = detail ? `${label} — ${detail}` : label;
  log(`  ${icon} ${msg}`);
}

/**
 * Compare two semver strings (vX.Y.Z). Returns >0 if a > b.
 */
function semverCompare(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkTypecheck() {
  log(`\n${C.bold('TypeScript type check')}`);
  const code = runScript(NPM, ['run', 'typecheck'], { cwd: ROOT });
  printCheck('typecheck', code === 0, code === 0 ? 'no errors' : `exit code ${code}`);
  return code === 0;
}

function checkTest() {
  log(`\n${C.bold('Test suite')}`);
  const code = runScript(NPM, ['test'], { cwd: ROOT });
  printCheck('tests', code === 0, code === 0 ? 'all tests passed' : `exit code ${code}`);
  return code === 0;
}

function checkBuild() {
  log(`\n${C.bold('Build')}`);
  const code = runScript(NPM, ['run', 'build'], { cwd: ROOT });
  printCheck('build', code === 0, code === 0 ? 'dist/ produced' : `exit code ${code}`);
  return code === 0;
}

function checkDistOutput() {
  log(`\n${C.bold('Verify dist output')}`);
  const requiredFiles = [
    'dist/index.js',
    'dist/index.cjs',
    'dist/changelog/index.js',
    'dist/changelog/index.cjs',
  ];
  let allPresent = true;
  for (const file of requiredFiles) {
    const fullPath = join(ROOT, file);
    try {
      accessSync(fullPath);
      printCheck(file, true);
    } catch {
      printCheck(file, false, 'missing');
      allPresent = false;
    }
  }
  return allPresent;
}

function checkChangelogVersionAhead() {
  log(`\n${C.bold('Changelog version ahead check')}`);
  const changelogVersion = readChangelogVersion(CHANGELOG_PATH);
  const packageVersion = readPackageVersion(ROOT);

  if (changelogVersion === 'unknown') {
    printCheck('changelog version', false, 'could not parse CHANGELOG.md');
    return false;
  }
  if (packageVersion === 'unknown') {
    printCheck('package.json version', false, 'could not read package.json');
    return false;
  }

  const ahead = semverCompare(changelogVersion, packageVersion) > 0;
  printCheck(
    'version ahead',
    ahead,
    `CHANGELOG.md: ${changelogVersion}, package.json: ${packageVersion}` +
      (ahead ? '' : ' — changelog must be ahead of package.json'),
  );
  return ahead;
}

function checkGitTagGap() {
  log(`\n${C.bold('Git tag gap check')}`);
  const changelogVersion = readChangelogVersion(CHANGELOG_PATH);
  if (changelogVersion === 'unknown') {
    printCheck('tag gap', false, 'could not parse changelog version');
    return false;
  }

  const tags = capture('git tag --sort=-v:refname');
  const tagList = tags.split('\n').filter(Boolean);
  const alreadyTagged = tagList.includes(changelogVersion);

  printCheck(
    'tag gap',
    !alreadyTagged,
    alreadyTagged
      ? `${changelogVersion} is already tagged — nothing new to release`
      : `${changelogVersion} is not yet tagged — ready to release`,
  );
  return !alreadyTagged;
}

function checkGitClean() {
  log(`\n${C.bold('Git working tree')}`);
  const status = capture('git status --short');
  const clean = status.length === 0;
  printCheck(
    'working tree',
    clean,
    clean ? 'clean' : `uncommitted changes:\n${status}`,
  );
  return clean;
}

// ---------------------------------------------------------------------------
// Composite commands
// ---------------------------------------------------------------------------

async function runReleaseCheck() {
  log(C.bold('\n  Pre-Release Check\n'));

  const results = [];

  // 1. Changelog version ahead
  results.push(['Changelog version ahead', checkChangelogVersionAhead()]);

  // 2. Git tag gap
  results.push(['Git tag gap', checkGitTagGap()]);

  // 3. TypeScript type check
  results.push(['TypeScript type check', checkTypecheck()]);

  // 4. Test suite
  results.push(['Test suite', checkTest()]);

  // 5. Build
  results.push(['Build', checkBuild()]);

  // 6. Verify dist output
  results.push(['Dist output', checkDistOutput()]);

  // 7. Git working tree
  results.push(['Git working tree', checkGitClean()]);

  // Summary
  log(C.bold('\n  Summary\n'));
  const allPassed = results.every(([, ok]) => ok);
  for (const [label, ok] of results) {
    printCheck(label, ok);
  }

  log('');
  if (allPassed) {
    log(C.green('  All checks passed — ready to release.\n'));
  } else {
    const failed = results.filter(([, ok]) => !ok).map(([label]) => label);
    log(C.red(`  ${failed.length} check(s) failed: ${failed.join(', ')}\n`));
  }
}

// ---------------------------------------------------------------------------
// Menu definition
// ---------------------------------------------------------------------------

const menu = createMenu({
  name: '@mistralys/cli-menu',
  banner: [
    '',
    C.bold('  @mistralys/cli-menu'),
    C.dim('  Developer CLI'),
    '',
  ],
  version: () => readPackageVersion(ROOT),
  workspaceRoot: ROOT,
  preflightChecks: [() => checkNodeVersion(18)],
  commands: [
    // --- Release ---
    {
      id: 'release-check',
      key: 'r',
      label: 'Release Check',
      category: 'Release',
      description: 'Run all pre-release checks (mirrors CI + release gates)',
      run: () => runReleaseCheck(),
    },

    // --- Development ---
    {
      id: 'typecheck',
      key: 't',
      label: 'Type Check',
      category: 'Development',
      description: 'Run TypeScript type check (tsc --noEmit)',
      run: () => { checkTypecheck(); },
    },
    {
      id: 'test',
      key: 'e',
      label: 'Test Suite',
      category: 'Development',
      description: 'Run all Vitest tests',
      run: () => { checkTest(); },
    },
    {
      id: 'build',
      key: 'b',
      label: 'Build',
      category: 'Development',
      description: 'Build dist/ output via tsup',
      run: () => { checkBuild(); },
    },

    // --- Info ---
    {
      id: 'verify-dist',
      key: 'v',
      label: 'Verify Dist',
      category: 'Info',
      description: 'Check that all expected dist output files exist',
      run: () => { checkDistOutput(); },
    },
    {
      id: 'git-status',
      key: 'g',
      label: 'Git Status',
      category: 'Info',
      description: 'Check if the Git working tree is clean',
      run: () => { checkGitClean(); },
    },
  ],
});

const exitCode = await menu.run(process.argv.slice(2));
process.exit(exitCode);
