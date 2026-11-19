# Curation Log

Why this manifest looks the way it does, and when it was last verified.
Read freely — Standing Decisions explains the deliberate gaps and conventions.
Written by the Manifest Curator only; no other agent edits this file.

## Standing Decisions

| Date | Decision | Rationale |
|---|---|---|
| — | — | None settled with the user yet. |

## History

### 2026-10-19 · Update · Curator v1.6.2

**Scope:** Partial upgrade, addition only: new `curation-log.md`, its row in the `README.md` Manifest Index, and removal of the hand-maintained `Version` and `Last Updated` fields from `README.md`. No other document was reconciled; the staleness spot-check below was a sample, not a verification.
**Commit:** 02118e5
**Changes:**
- Created this log. The manifest had none, so the trail says nothing about earlier maintenance.
- `README.md` index gained a Curation Log row; the `**Version:**` and `**Last Updated:**` header fields were removed (the log supersedes hand-maintained versions and dates).

**Notes:** The reverted-decision search and changed-code intersection were not run (partial pass by instruction, no floor commit); the next full pass should run both, reading history from the commit above or from the manifest's last edit (git shows 2026-05-30 for the manifest directory). Working tree was clean when scanned. No `context.yaml` exists and CTX is not planned. `dist/` is git-ignored and no tracked generated output was found, so no `generated-artefacts.md` is warranted. The adjacent-document check (root `README.md`, `AGENTS.md`) was out of scope for this dispatch.

Spot-check, observed but left untouched for a later full refresh:
- `README.md` index states the package is version 0.1.0; `package.json` declares 1.1.0 (the removed header carried the same stale number).
- `README.md` index describes the file tree as having a fixed number of source and test files; counts like these go stale and the tree no longer matches that figure on inspection.
- `api-surface.md` documents `checkNodeVersion(minMajor?)` with a default of 18, which matches `src/preflight.ts`; but `package.json` `engines.node` is `>=22.0.0`, so the default and the engine floor differ (documented floor in `tech-stack.md` is correct at 22).
- `package.json` scripts `release-check` and `menu`, and the tracked `scripts/cli.js`, `menu.sh` and `menu.cmd`, are not mentioned in `file-tree.md` or `tech-stack.md`.
- `package.json` lists `@vitest/coverage-v8` and `vitest` at `^4.1.2`; the README Project Stats and `tech-stack.md` TypeScript figures were not re-verified beyond the `^5.8.2` range, which matches.
- Confirmed consistent: `statusLines`, `firstRunRedirect` and `onFirstRun` (added in 1.1.0) appear in `api-surface.md`; the `./changelog` sub-path export and the Node 22 floor in `tech-stack.md` match `package.json`.
