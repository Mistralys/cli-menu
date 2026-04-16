import { C } from '../colors.js';
import { enterRawMode, isRawModeSupported, restoreTerminal } from '../raw-mode.js';
import type { SetupComponent } from '../types.js';

/** Minimal shape of the readline Key object emitted with `keypress` events. */
interface KeyInfo {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  sequence?: string;
}

/** ANSI: move cursor up N lines then erase to end of screen. */
const erasePrevious = (n: number): string => `\x1b[${n}A\x1b[0J`;

function buildLines(
  components: SetupComponent[],
  detected: readonly boolean[],
  checked: readonly boolean[],
  cursor: number,
): string[] {
  const lines: string[] = [];
  lines.push(C.bold('  Select components to set up:'));
  lines.push(C.dim('  ↑/↓  j/k navigate · Space toggle · a toggle all · Enter confirm · q cancel'));
  lines.push('');

  for (let i = 0; i < components.length; i++) {
    const isActive = i === cursor;
    const box = checked[i] ? C.green('[x]') : '[ ]';
    const doneTag = detected[i] ? C.dim(' (done)') : '';
    const rawLabel = `${components[i].label}${doneTag}`;
    const label = isActive ? C.bold(rawLabel) : rawLabel;
    const pointer = isActive ? C.cyan('▶') : ' ';
    lines.push(`  ${pointer} ${box} ${label}`);
    lines.push(`        ${C.dim(components[i].desc)}`);
  }

  return lines;
}

/**
 * Interactive TUI checkbox selector for setup wizard components.
 *
 * Pre-detected components (where `detect()` returns `true`) are pre-checked
 * and labelled `(done)`. Returns the selected component IDs on `Enter`, or
 * `null` when the user presses `q` to cancel.
 *
 * In non-TTY environments the function returns `null` immediately without
 * rendering.
 *
 * Key bindings:
 * - `↑` / `k` — move cursor up
 * - `↓` / `j` — move cursor down
 * - `Space` — toggle the current item
 * - `a` — toggle all items
 * - `Enter` — confirm selection
 * - `q` — cancel
 *
 * A `SIGINT` handler is registered for the duration of the interaction and
 * unregistered when the function resolves (either via `Enter` or `q`).
 *
 * @param components - Setup wizard components to display.
 * @returns Selected component IDs, or `null` on cancel.
 */
export function runCheckboxMenu(components: SetupComponent[]): Promise<string[] | null> {
  if (!isRawModeSupported()) {
    return Promise.resolve(null);
  }

  if (components.length === 0) {
    return Promise.resolve([]);
  }

  const detected = components.map((c) => c.detect());
  const checked: boolean[] = [...detected];
  let cursor = 0;
  let lineCount = 0;

  const draw = (): void => {
    if (lineCount > 0) {
      process.stdout.write(erasePrevious(lineCount));
    }
    const lines = buildLines(components, detected, checked, cursor);
    process.stdout.write(lines.join('\n') + '\n');
    lineCount = lines.length;
  };

  return new Promise<string[] | null>((resolve) => {
    enterRawMode();
    draw();

    const sigintHandler = (): void => {
      process.off('SIGINT', sigintHandler);
      restoreTerminal();
      process.kill(process.pid, 'SIGINT');
    };
    process.on('SIGINT', sigintHandler);

    const cleanup = (result: string[] | null): void => {
      process.off('SIGINT', sigintHandler);
      restoreTerminal();
      resolve(result);
    };

    const onKeypress = (str: string | undefined, key: KeyInfo | undefined): void => {
      const ch = str ?? '';
      const name: string = key?.name ?? '';

      if (name === 'up' || ch === 'k') {
        cursor = Math.max(0, cursor - 1);
        draw();
      } else if (name === 'down' || ch === 'j') {
        cursor = Math.min(components.length - 1, cursor + 1);
        draw();
      } else if (ch === ' ') {
        checked[cursor] = !checked[cursor];
        draw();
      } else if (ch === 'a') {
        checked.fill(!checked.every(Boolean));
        draw();
      } else if (name === 'return') {
        cleanup(components.filter((_, i) => checked[i]).map((c) => c.id));
      } else if (ch === 'q') {
        cleanup(null);
      }
    };

    process.stdin.on('keypress', onKeypress as Parameters<typeof process.stdin.on>[1]);
  });
}
