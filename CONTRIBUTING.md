# Contributing to XRPL Connect

Thanks for your interest in contributing! XRPL Connect is an open-source, framework-agnostic wallet-connection toolkit for the XRP Ledger, and contributions of every size are welcome — bug reports, documentation fixes, new adapters, and core improvements.

## Code of Conduct

This project follows the spirit of the [Contributor Covenant](https://www.contributor-covenant.org/). Be kind, be constructive, and assume good intent.

## Ways to Contribute

- **Report bugs** or request features via [GitHub Issues](https://github.com/XRPL-Commons/xrpl-connect/issues).
- **Improve the docs** under [`docs/`](./docs) — they are published with VitePress.
- **Add a wallet adapter** — see [Creating Wallet Adapters](./docs/guide/adapter-integration.md).
- **Fix bugs or implement features** — please open an issue first for non-trivial changes so we can align on the approach.

## Development Setup

### Prerequisites

- **Node.js** 20.19+, 22.18+, or 24.11+
- **pnpm** ≥ 8 (the repo pins `pnpm@10.18.3` via `packageManager`)
- **Vite+** (installed as a workspace dependency; invoke it with `pnpm exec vp`)

### Install

```bash
git clone https://github.com/XRPL-Commons/xrpl-connect.git
cd xrpl-connect
pnpm exec vp install
```

### Common Commands

All commands run from the repository root via Vite+:

```bash
pnpm exec vp run -r build  # Build all packages
pnpm exec vp run dev       # Watch mode across packages
pnpm exec vp run test      # Build and test all packages
pnpm exec vp check         # Type-check, lint, and verify formatting
pnpm exec vp fmt           # Format with Oxfmt
pnpm exec vp run docs:dev  # Run the VitePress docs site locally
```

### Repository Layout

```
xrpl-connect/
├── packages/
│   ├── core/                  # WalletManager, events, storage
│   ├── ui/                    # Web component
│   ├── adapters/              # All wallet adapters (xaman, crossmark, gemwallet,
│   │                          # walletconnect, ledger, xyra, otsu, …)
│   └── xrpl-connect/          # Meta-package that re-exports everything
├── examples/                  # vanilla-js and react integration examples
└── docs/                      # VitePress documentation site
```

## Branching & Workflow

- The default branch is **`develop`** — open all pull requests against it.
- **`main`** tracks released versions; releases are merged from `develop` to `main` and tagged.
- Use short, descriptive branch names. Suggested prefixes:
  - `feat/<short-slug>` — new functionality
  - `fix/<short-slug>` — bug fixes
  - `docs/<short-slug>` — documentation only
  - `refactor/<short-slug>` — internal refactors
  - `chore/<short-slug>` — tooling, deps, CI
- If your work resolves an issue, including the issue number in the branch name (e.g. `fix/issue-42-…`) helps reviewers.

## Commit Messages

Aim for [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

<optional body>

Fixes #<issue>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`. Optional scopes match the package (`core`, `ui`, `adapter-xaman`, …). Keep the subject line under ~72 characters.

## Pull Requests

Before opening a PR:

1. Rebase or merge from the latest `develop`.
2. Run `pnpm exec vp run build`, `pnpm exec vp check`, and `pnpm exec vp run test` locally.
3. Add or update tests for behavior changes.
4. Update the relevant docs under `docs/` if you change public API.
5. Add a `CHANGELOG.md` entry under the `[Unreleased]` section describing user-visible changes (see [`CHANGELOG.md`](./CHANGELOG.md)).

In the PR description:

- State **what** changed and **why** (link the issue with `Fixes #<num>` to auto-close it on merge).
- List manual test steps reviewers can follow.
- Call out breaking changes explicitly, including any required migration.

CI runs build, lint, and tests on every PR and on `develop`. Please keep it green.

## Adding a New Adapter

XRPL Connect's adapter architecture is intentionally small. Follow the dedicated guide — it covers the `WalletAdapter` interface, package layout, registration in the meta-package, and the bundled examples:

➡️ [Creating Wallet Adapters](./docs/guide/adapter-integration.md)

A good reference adapter to copy from is [`@xrpl-connect/adapter-crossmark`](./packages/adapters/crossmark).

## Persisted-state migrations

`@xrpl-connect/core` persists wallet-connection state (the `StoredState`
shape) through the `Storage` class in `packages/core/src/storage.ts`. The
stored value is always wrapped in a versioned envelope:

```ts
{ version: number, payload: StoredState }
```

`Storage.loadState()` reads the envelope, runs any registered migrations to
bring the payload up to the current version, and **never throws** —
unrecognized, too-new, or un-migratable entries are cleared so
`WalletManager.autoConnect` cannot fail because of stale data.

### When you have to bump the version

Bump `STORED_STATE_VERSION` (in `packages/core/src/storage.ts`) whenever you
change `StoredState` in a way an older runtime cannot safely interpret:

- renaming a field,
- changing a field's type,
- adding a field that downstream code assumes is present,
- changing the semantic meaning of a field (e.g. switching adapter ids).

Additive changes that older code would silently ignore (a new optional field
that's never read except by new code paths) do **not** require a bump.

### How to add a migration

1. Bump `STORED_STATE_VERSION` to `N + 1`.
2. Add an entry to `STATE_MIGRATIONS` keyed by `N` (the _source_ version)
   whose function takes the previous payload and returns the new shape:
   ```ts
   export const STATE_MIGRATIONS: Record<number, StoredStateMigration> = {
     1: (payload) => {
       const p = payload as OldStoredStateV1;
       return { ...p, newField: defaultValue };
     },
   };
   ```
3. Add a unit test in `packages/core/src/storage.test.ts` that writes a
   `version: N` envelope through `MemoryStorageAdapter` and asserts the
   loaded result matches the new shape.
4. Avoid throwing inside a migration — `Storage` already treats thrown
   migrations as "discard and clear." Use that escape hatch sparingly; the
   point of a migration is to preserve the user's session, not drop it.

### What gets cleared instead of migrated

`Storage.loadState()` will clear the entry and return `null` if:

- the value is not JSON,
- the value parses but isn't a `{ version, payload }` envelope (data
  written by a pre-versioning release falls here),
- `version` is greater than `STORED_STATE_VERSION`,
- there's no registered migration for some intermediate version,
- a migration throws.

This is deliberate: a partially-migrated or unknown payload is worse than a
fresh reconnect prompt.

## Release Process

Maintainers cut releases as follows:

1. Make sure `develop` is green and the `CHANGELOG.md` `[Unreleased]` section is up to date.
2. Bump the version in the relevant `package.json` files and move the `[Unreleased]` entries into a new dated version section.
3. Merge `develop` → `main` via PR.
4. Publish from the clean merge commit using the maintainer release procedure, verify the registry, then tag that exact commit (for example, `v0.8.0`) and push the tag. Stable publishing is currently a maintainer-run operation; this repository does not have a tag-triggered publish workflow.

If you are not a maintainer, you do not need to bump versions or update `main` in your PR — leave that to the release process.

### Release candidates

Release candidates must never move the `latest` dist-tag. The candidate manifests declare the
public npm registry and the `rc` tag, while the release command fixes those values, rejects dirty
source trees or missing confirmation, verifies npm access, package ownership, and registry state,
rebuilds and dry-runs every artifact, and checks the resulting dist-tags:

```bash
pnpm --filter xrpl-connect run publish:rc -- --confirm 1.0.0-rc.0
```

The preflight requires `xrpl-connect@latest` at `0.8.2`; each candidate must be either unpublished
or already present at the exact confirmed version. The packed candidate test performs each dry-run
and installs the exact tarballs together with strict peer checking. For an exact candidate uploaded
by an interrupted attempt, the publisher verifies its immutable integrity and restores the `rc` tag.
The final registry check requires `rc` to point to the candidate, keeps the umbrella `latest` at
`0.8.2`, and rejects unintended framework `latest` tags. If an attempt is interrupted, rerun the same
command; do not bypass it with a manual publish. Before running it, move the changelog entries into
a dated `[1.0.0-rc.0]` section, reset `[Unreleased]`, and commit those release changes. After the
registry verification succeeds, tag that same clean commit as `v1.0.0-rc.0` and push the tag.

## Reporting Security Issues

Please **do not** open public issues for security vulnerabilities. Email the maintainers via the contact details in the [`xrpl-connect` GitHub organization page](https://github.com/XRPL-Commons) instead.

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](./LICENSE).
