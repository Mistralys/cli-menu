# Changelog Utilities

The `@mistralys/cli-menu/changelog` sub-path export provides utilities for reading version
information from changelog and package manifest files. These functions are designed for use in
CLI menus and help-rendering pipelines that display module versions.

## Import

```ts
import {
  readChangelogVersion,
  extractChangelogEntry,
  readPackageVersion,
  readPyprojectVersion,
  type ChangelogEntry,
} from '@mistralys/cli-menu/changelog';
```

Both ESM and CJS consumers are supported. TypeScript declarations are included.

> **Version prefix convention:** All four version functions return strings prefixed with `v`
> (e.g. `"v1.2.3"`). Do not add your own `v` prefix — the functions always include it.

---

## `ChangelogEntry`

```ts
interface ChangelogEntry {
  version: string;
  title:   string;
  body:    string;
}
```

A single parsed entry returned by `extractChangelogEntry()`.

| Property | Type | Description |
|---|---|---|
| `version` | `string` | Semantic version string with `v` prefix (e.g. `"v1.2.3"`). |
| `title` | `string` | Release title extracted from the changelog heading (the text after the version). Empty string when the heading has no title. |
| `body` | `string` | Full trimmed body text of the entry, up to the next `##` heading or EOF. |

---

## `readChangelogVersion(filePath)`

```ts
function readChangelogVersion(filePath: string): string
```

Extracts the version string from the first changelog heading. Designed for fast version probes
when only the version number is needed — not the full entry body.

Recognises both `## v1.2.3` and `## [1.2.3]` heading formats.

| Parameter | Type | Description |
|---|---|---|
| `filePath` | `string` | Absolute path to the changelog Markdown file. |

**Returns:** `"vX.Y.Z"`, or `"unknown"` when the file is missing, unreadable, or contains no
parseable version heading.

```ts
import { join } from 'node:path';
import { readChangelogVersion } from '@mistralys/cli-menu/changelog';

const version = readChangelogVersion(join(workspaceRoot, 'CHANGELOG.md'));
// → "v1.4.2"
```

---

## `extractChangelogEntry(filePath)`

```ts
function extractChangelogEntry(filePath: string): ChangelogEntry | null
```

Extracts the first entry from a changelog file as a structured `ChangelogEntry` object. Stops
collecting body text at the next `##` heading. CRLF line endings are normalised to LF before
parsing.

**Recognised heading formats:**

- `## v1.2.3 — Release title`
- `## [1.2.3] Release title`
- `## v1.2.3` (no title → `title` is `""`)

| Parameter | Type | Description |
|---|---|---|
| `filePath` | `string` | Absolute path to the changelog Markdown file. |

**Returns:** A `ChangelogEntry`, or `null` when no parseable entry is found or the file cannot
be read.

```ts
import { join } from 'node:path';
import { extractChangelogEntry } from '@mistralys/cli-menu/changelog';

const entry = extractChangelogEntry(join(workspaceRoot, 'CHANGELOG.md'));

if (entry) {
  console.log(`${entry.version} — ${entry.title}`);
  console.log(entry.body);
}
```

---

## `readPackageVersion(dirPath)`

```ts
function readPackageVersion(dirPath: string): string
```

Reads the `version` field from `package.json` inside `dirPath`. Useful for Node.js packages
that do not maintain a separate changelog but keep the canonical version in `package.json`.

| Parameter | Type | Description |
|---|---|---|
| `dirPath` | `string` | Directory containing a `package.json` file (not the path to the file itself). |

**Returns:** `"vX.Y.Z"`, or `"unknown"` on read or parse failure.

```ts
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPackageVersion } from '@mistralys/cli-menu/changelog';

const __dirname = dirname(fileURLToPath(import.meta.url));
const version = readPackageVersion(__dirname);
// → "v2.0.1"
```

### Using with `MenuConfig.version`

```ts
const config: MenuConfig = {
  version: () => readPackageVersion(__dirname),
  // …
};
```

---

## `readPyprojectVersion(dirPath)`

```ts
function readPyprojectVersion(dirPath: string): string
```

Reads the version from a `pyproject.toml` inside `dirPath`. Looks for a line matching
`version = "X.Y.Z"`.

| Parameter | Type | Description |
|---|---|---|
| `dirPath` | `string` | Directory containing a `pyproject.toml` file (not the path to the file itself). |

**Returns:** `"vX.Y.Z"`, or `"unknown"` on read or parse failure.

```ts
import { join } from 'node:path';
import { readPyprojectVersion } from '@mistralys/cli-menu/changelog';

const version = readPyprojectVersion(join(workspaceRoot, 'services/api'));
// → "v0.9.0"
```

---

## Using multiple version sources

A common pattern for multi-module workspaces combines `readPackageVersion()` and
`readChangelogVersion()` in `categoryVersions`:

```ts
import { join } from 'node:path';
import {
  readPackageVersion,
  readChangelogVersion,
} from '@mistralys/cli-menu/changelog';

const config: MenuConfig = {
  name:    'Workspace CLI',
  version: () => readPackageVersion(workspaceRoot),
  categoryVersions: {
    'Node API':  () => readPackageVersion(join(workspaceRoot, 'packages/api')),
    'Python ML': () => readPyprojectVersion(join(workspaceRoot, 'services/ml')),
    'Docs':      () => readChangelogVersion(join(workspaceRoot, 'docs/CHANGELOG.md')),
  },
  // …
};
```
