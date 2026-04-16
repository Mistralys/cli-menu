# Tech Stack — @mistralys/cli-menu

---

## Runtime & Language

| Property | Value |
|----------|-------|
| **Language** | TypeScript 5.8.2 |
| **Target** | ES2022 |
| **Module system** | ESNext (source); dual CJS + ESM (dist) |
| **Node.js** | ≥ 22.0.0 |
| **`moduleResolution`** | `bundler` |
| **Strict mode** | `true` |

---

## Architecture — Layered Design

The library is organized into four horizontal layers. Higher layers depend on lower ones;
lower layers never import from higher ones.

```
┌─────────────────────────────────────────────────────┐
│  Factory layer       src/create-menu.ts             │  ← Public entry point
├─────────────────────────────────────────────────────┤
│  Engine layer        src/menu/   src/setup/         │  ← TUI engines (interactive)
├─────────────────────────────────────────────────────┤
│  Service layer       src/help.ts  src/version.ts    │  ← Business logic
│                      src/runners.ts  src/parser.ts  │
│                      src/preflight.ts               │
├─────────────────────────────────────────────────────┤
│  Primitive layer     src/colors.ts   src/screen.ts  │  ← ANSI / terminal primitives
│                      src/raw-mode.ts                │
└─────────────────────────────────────────────────────┘
         Barrel: src/index.ts       Types: src/types.ts
         Subpath: src/changelog/
```

**Key rules:**
- `src/create-menu.ts` imports from both the engine and service layers but never from test code.
- Engine layer (`src/menu/`, `src/setup/`) imports from the service and primitive layers only.
- Primitive layer modules import only Node.js built-ins.
- `src/types.ts` is type-only; all other modules may import from it.
- `src/index.ts` is a barrel re-export; it contains no logic.

---

## Build Tooling

| Tool | Version | Purpose |
|------|---------|---------|
| **tsup** | ^8.4.0 | Production build — dual CJS + ESM, DTS generation, source maps, tree-shaking |
| **tsc** | bundled with `typescript` | Type-checking (`tsc --noEmit`) |

### Build outputs (`dist/`)

tsup compiles two entry points:

| Entry | CJS output | ESM output | DTS (ESM) | DTS (CJS) |
|-------|-----------|-----------|-----------|-----------|
| `src/index.ts` | `dist/index.cjs` | `dist/index.js` | `dist/index.d.ts` | `dist/index.d.cts` |
| `src/changelog/index.ts` | `dist/changelog/index.cjs` | `dist/changelog/index.js` | `dist/changelog/index.d.ts` | `dist/changelog/index.d.cts` |

Build config: `tsup.config.ts` — `format: ['cjs', 'esm']`, `dts: true`, `clean: true`,
`splitting: false`, `treeshake: true`, `target: 'node22'`.

---

## Test Framework

| Tool | Purpose |
|------|---------|
| **Vitest** | Unit and integration tests |
| **@vitest/coverage-v8** | V8 coverage reporting |

Tests live in `tests/` and mirror the `src/` directory structure.  
Config: `vitest.config.ts` — environment `node`, globals `true`, coverage thresholds 80%.

The following files are excluded from coverage thresholds:

| Excluded File | Reason |
|---------------|--------|
| `src/index.ts` | Barrel re-export (no logic) |
| `src/menu/index.ts` | Barrel re-export |
| `src/setup/index.ts` | Barrel re-export |
| `src/types.ts` | Type-only (no runtime code) |
| `src/raw-mode.ts` | TTY interaction (cannot be exercised without a real terminal) |

---

## Distribution Format

The package ships dual CJS + ESM bundles. Consumers using `import` (ESM) receive the `.js`
bundle; consumers using `require()` (CJS) receive the `.cjs` bundle. TypeScript consumers
receive `.d.ts` declarations for both entry points.

`package.json` `exports` map:

```json
{
  ".": {
    "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
  },
  "./changelog": {
    "import": { "types": "./dist/changelog/index.d.ts", "default": "./dist/changelog/index.js" },
    "require": { "types": "./dist/changelog/index.d.cts", "default": "./dist/changelog/index.cjs" }
  }
}
```

---

## Production Dependencies

**None.** The library imports only Node.js built-ins (`readline`, `child_process`, `fs`). The
zero-dependency invariant is architectural — see [constraints.md](constraints.md).

---

## npm Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `build` | `tsup` | Production build |
| `dev` | `tsup --watch` | Watch-mode build |
| `test` | `vitest run` | Run all tests once |
| `test:watch` | `vitest` | Watch-mode tests |
| `typecheck` | `tsc --noEmit` | Type-check without emitting |
| `prebuild` | `node -e "..."` | Clean `dist/` before build |
