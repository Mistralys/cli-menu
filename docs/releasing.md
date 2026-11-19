# Releasing

How to cut a release of `@mistralys/cli-menu`. A release is published to NPM and mirrored by a Git tag and a GitHub release; those three must name the same version.

## Quick reference

Replace `X.Y.Z` with the new version. **Never create the tag yourself** — `npm version` does it.

1. Add the changelog entry as the topmost `## vX.Y.Z - Title` heading. **Do not touch the `package.json` version.**
2. Commit the changelog and any other pending changes.
3. Run the release check: `npm run release-check` (or `r` in the menu). Fix anything it reports and re-run.
4. `npm login` if you are not logged in.
5. `npm version X.Y.Z` — bumps `package.json` and the lock file, commits, and creates the tag **`vX.Y.Z`** (with the `v`).
6. `npm publish`
7. `git push && git push origin vX.Y.Z` — push the version commit and the tag.
8. Create the GitHub release **from the existing tag `vX.Y.Z`**.

## Tag naming: always `vX.Y.Z`

`npm version X.Y.Z` adds the `v` prefix on its own and creates the tag `vX.Y.Z`. All existing tags in this repository follow that form.

The trap: tagging a version by hand *without* the `v` (`git tag X.Y.Z`) and then running `npm version`. The result is two tags for one release, or a GitHub release attached to a tag that does not match the one npm created. Version and tag then disagree, and tooling that expects `vX.Y.Z` cannot find the release.

Rules:

- Do not run `git tag` for releases. Let `npm version` create the tag.
- When pushing or referring to the tag, always include the `v`.
- When creating the GitHub release, select the existing `vX.Y.Z` tag; do not let GitHub create a new tag with a different name.
- If a bare `X.Y.Z` tag was created by mistake, delete it before running `npm version` (`git tag -d X.Y.Z`, and `git push origin :refs/tags/X.Y.Z` if it was pushed).

The release check fails when a tag exists for the changelog version in **either** form.

## Why the changelog comes first

At release-check time `CHANGELOG.md` already documents the new version while `package.json` still holds the old one. `npm version` closes that gap. The check requires the changelog version to be strictly greater than the `package.json` version, so a release without a changelog entry, or a version bumped early, is caught.

## What the release check covers

`npm run release-check` runs:

| Check | Expected |
|-------|----------|
| Changelog version ahead | Changelog version > `package.json` version |
| Git tag gap | No `X.Y.Z` or `vX.Y.Z` tag for the changelog version |
| Type check | No errors |
| Test suite | All pass |
| Build | `dist/` produced |
| Dist output | Required `dist/` entry files exist |
| Git working tree | Clean — commit before `npm version` |

## Order matters

NPM, Git and GitHub are published separately and nothing keeps them in sync, so follow the order above:

1. `npm version` first — it fails early if the tree is dirty or the tag exists, before anything is published.
2. `npm publish` next. A published version cannot be re-published, so only run it once the checks pass.
3. Push the commit and tag, then create the GitHub release from that tag.

If publishing fails, fix the cause and retry `npm publish` — the local tag and version commit stay valid. If it succeeded but the push was forgotten, push the commit and tag; do not re-run `npm version`.

## Authentication

The package is scoped (`@mistralys/`) and published with `publishConfig.access: public`. Run `npm login` first if your session has expired; accounts with 2FA will prompt for a one-time code on `npm publish`.
