import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.{js,ts}'],
    environment: 'node',
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        // Re-export barrels — no testable logic
        'src/index.ts',
        'src/setup/index.ts',
        'src/menu/index.ts',
        // Type-only module — no runtime code
        'src/types.ts',
        // CLI entry point — requires process.argv mocking
        'src/cli.ts',
        // TTY interaction module — all tests mock this out; cannot be exercised
        // without a real terminal
        'src/raw-mode.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
