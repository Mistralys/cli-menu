# Project Manifest — @mistralys/cli-menu

**Version:** 0.1.0  
**Package:** `@mistralys/cli-menu`  
**Last Updated:** 2026-04-15

---

## Purpose

`@mistralys/cli-menu` is a zero-dependency TypeScript library for building interactive CLI
menus. It provides a `createMenu()` factory that wires argument parsing, help rendering, a
setup wizard, and a full keypress-driven TUI menu together into a single `run(argv)` entry
point.

---

## Manifest Index

| Document | Contents |
|----------|----------|
| [tech-stack.md](tech-stack.md) | Runtime, frameworks, layered architecture, build tooling, distribution format. |
| [file-tree.md](file-tree.md) | Annotated directory structure (18 source files, 12 test files). |
| [api-surface.md](api-surface.md) | All exported types, functions, and constants — signatures and description. |
| [data-flows.md](data-flows.md) | Build pipeline, `createMenu()` dispatch, setup wizard flow, interactive menu loop. |
| [constraints.md](constraints.md) | Architectural invariants, naming rules, known limitations. |

---

## Project Stats

| Property | Value |
|----------|-------|
| **Language** | TypeScript 5.8.2 (ES2022) |
| **Runtime** | Node.js ≥ 22 (ESM, dual CJS + ESM dist) |
| **Architecture** | Layered: factory → engines → utilities |
| **Package Manager** | npm |
| **Build Tool** | tsup (dual CJS + ESM) |
| **Test Framework** | Vitest |
| **Production Dependencies** | 0 (zero-dependency) |
| **Dev Dependencies** | 5 (`tsup`, `typescript`, `vitest`, `@vitest/coverage-v8`, `@types/node`) |
| **License** | MIT |

---

## Sub-path Exports

| Sub-path | Entry | Description |
|----------|-------|-------------|
| `@mistralys/cli-menu` | `dist/index.{js,cjs}` | Core library |
| `@mistralys/cli-menu/changelog` | `dist/changelog/index.{js,cjs}` | Changelog parsing utilities |
