# AI Agents Operating System — @mistralys/cli-menu

> **Purpose:** Authoritative entry point for AI agents entering the `@mistralys/cli-menu`
> codebase. Defines how agents discover, navigate, and interact with the library to ensure
> architectural integrity and token efficiency.

---

## 📚 Project Manifest — Start Here!

**Core Philosophy:** The Project Manifest is the canonical documentation of this codebase. If
implementation code contradicts the manifest, the **code is likely wrong**.

**Manifest location:** [`docs/agents/project-manifest/`](docs/agents/project-manifest/README.md)

| Document | Contents |
|----------|----------|
| [README.md](docs/agents/project-manifest/README.md) | Project overview, version, and manifest index. |
| [tech-stack.md](docs/agents/project-manifest/tech-stack.md) | Runtime, layered architecture, build tooling, distribution format. |
| [file-tree.md](docs/agents/project-manifest/file-tree.md) | Annotated directory structure with layer annotations. |
| [api-surface.md](docs/agents/project-manifest/api-surface.md) | All exported types, functions, and constants — signatures only. |
| [data-flows.md](docs/agents/project-manifest/data-flows.md) | Build pipeline, `createMenu()` dispatch, setup wizard, interactive menu loop. |
| [constraints.md](docs/agents/project-manifest/constraints.md) | Architectural invariants, naming rules, known limitations. |

### Quick Start Workflow

Follow this sequence before making any changes:

1. **Read [README.md](docs/agents/project-manifest/README.md)** — Understand project purpose and scope.
2. **Read [tech-stack.md](docs/agents/project-manifest/tech-stack.md)** — Understand layered architecture and zero-dependency invariant.
3. **Read [constraints.md](docs/agents/project-manifest/constraints.md)** — **MANDATORY** before writing any code.
4. **Consult [file-tree.md](docs/agents/project-manifest/file-tree.md) + [api-surface.md](docs/agents/project-manifest/api-surface.md)** — Find files and public interfaces.
5. **Read source code** — Only when implementation details are needed.

---

## 📝 Manifest Maintenance Rules

When you change the codebase, update the corresponding manifest documents:

| Change Made | Documents to Update |
|-------------|---------------------|
| Add/modify exported function | `api-surface.md`, verify zero-dep invariant in `constraints.md` |
| Add/modify exported type or interface | `api-surface.md` |
| Add new source file | `file-tree.md`, `api-surface.md` (if public) |
| Add/remove npm dependency | `tech-stack.md` (`devDependencies` and/or `dependencies`) |
| Change layered architecture | `tech-stack.md`, `data-flows.md`, `constraints.md` |
| Add/change dispatch step in `createMenu` | `data-flows.md` §3, `api-surface.md` §Factory |
| Change interactive menu loop | `data-flows.md` §4 |
| Change setup wizard flow | `data-flows.md` §5 |
| Change checkbox TUI flow | `data-flows.md` §6, `api-surface.md` |
| Change help rendering | `data-flows.md` §7, `api-surface.md` |
| Change naming convention | `constraints.md` |
| Discover new limitation | `constraints.md` (Known Limitations) |
| Add/change CLI-facing behaviour | `README.md` (user docs) |

---

## ⚡ Efficiency Rules — Search Smart, Read Less

**Token efficiency is critical. Follow this search hierarchy:**

| What You Need | Search Here FIRST | Then Here | Read Source LAST |
|---------------|-------------------|-----------|------------------|
| Find a file location | `file-tree.md` | `grep` / file search | Never needed |
| Understand a function/type | `api-surface.md` | Source code | Only for implementation logic |
| Trace data flow | `data-flows.md` | Source code | Only for edge cases |
| Check a rule or convention | `constraints.md` | Source comments | Only if ambiguous |
| Identify dependencies | `tech-stack.md` | `package.json` | Never needed |
| Understand layer architecture | `tech-stack.md` | Source code | Only for complex logic |

### Anti-Patterns

| ❌ Inefficient | ✅ Efficient |
|---------------|-------------|
| Grep entire codebase for a type name | Search `api-surface.md` |
| Read `create-menu.ts` to understand dispatch order | Read `data-flows.md` §3 |
| Read 5 files to check the layer rules | Read `constraints.md` §3 |
| Read `package.json` to check dependencies | Check `tech-stack.md` |
| Read the menu loop in `interactive.ts` | Read `data-flows.md` §4 |

---

## 🚨 Failure Protocol & Decision Matrix

| Scenario | Action | Priority |
|----------|--------|----------|
| **Manifest vs. code conflict** | Trust manifest. Flag code for correction. | MUST |
| **Ambiguous requirement** | Use most restrictive interpretation. Document assumption. | MUST |
| **Missing manifest documentation** | Flag gap. Do not invent facts. Draft entry for review. | MUST |
| **Untested code path** | Proceed with caution. Add test recommendation. | SHOULD |
| **New production dependency proposed** | Justify in writing. Update `tech-stack.md`. Never add without justification. | MUST |
| **Code needs to call `process.exit()`** | Do NOT add `process.exit()` inside library code. Return an exit code instead. | MUST |
| **New engine module imports from factory** | Layer violation — restructure to keep factory above engine. | MUST |
| **Breaking change to public API** | Document before implementing. Flag for review. Never implement silently. | MUST |
| **SIGINT handler missing from interactive module** | Add handler + cleanup. See `constraints.md` §6. | MUST |

### Escalation Path

```
Issue Detected
    ↓
Can I resolve with manifest + constraints?
    ↓ YES → Proceed
    ↓ NO  →
Is it an architectural concern (zero-dep, layer violation, process.exit)?
    ↓ YES → Pause and request user input
    ↓ NO  →
Is it a breaking change to the public API?
    ↓ YES → Pause and request user input
    ↓ NO  →
Is it a missing manifest entry?
    ↓ YES → Draft entry + request review
    ↓ NO  →
Unclear → Pause and request user clarification
```

---

## 📊 Project Stats

| Property | Value |
|----------|-------|
| **Package** | `@mistralys/cli-menu` |
| **Version** | 0.1.0 |
| **Language** | TypeScript 5.8.2 (ES2022) |
| **Runtime** | Node.js ≥ 18 (ESM) |
| **Architecture** | Layered: factory → engine → service → primitive |
| **Package Manager** | npm |
| **Build Tool** | tsup (dual CJS + ESM) |
| **Test Framework** | Vitest |
| **Production Dependencies** | 0 (zero-dependency) |
| **License** | MIT |

### npm Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Production build via tsup. |
| `npm run dev` | Watch-mode build. |
| `npm test` | Run all tests once. |
| `npm run test:watch` | Run tests in watch mode. |
| `npm run typecheck` | Type-check without emitting (`tsc --noEmit`). |

---

## 🧭 Navigation Quick Reference

| I Need To… | Go Here |
|------------|---------|
| Understand the project | [README.md](README.md) |
| See the full manifest | [docs/agents/project-manifest/](docs/agents/project-manifest/README.md) |
| Find a source file | [file-tree.md](docs/agents/project-manifest/file-tree.md) |
| Look up a function signature | [api-surface.md](docs/agents/project-manifest/api-surface.md) |
| Understand build + dispatch flows | [data-flows.md](docs/agents/project-manifest/data-flows.md) |
| Check naming rules or invariants | [constraints.md](docs/agents/project-manifest/constraints.md) |
| Understand the tech stack + layers | [tech-stack.md](docs/agents/project-manifest/tech-stack.md) |
| See test fixtures | `fixtures/changelogs/` and `fixtures/manifests/` |
| Review agent work plans (historical) | `docs/agents/plans/` |
| Review design research notes | `docs/agents/research/` |
| User-facing configuration reference | [docs/configuration.md](docs/configuration.md) |
| Changelog utility docs | [docs/changelog-utilities.md](docs/changelog-utilities.md) |
| Run tests | `npm test` |
| Build the library | `npm run build` |
