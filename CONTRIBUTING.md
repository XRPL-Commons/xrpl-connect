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

- **Node.js** 22.18+, 24.11+, or 26+ for the Vite+ development toolchain
- **pnpm** ≥ 8 (the repo pins `pnpm@10.18.3` via `packageManager`)
- **Vite+** (installed as a workspace dependency; invoke it with `pnpm exec vp`)

Published packages also support Node.js 20.19+. CI builds with Node.js 22 or 24
and verifies the packed packages on Node.js 20, 22, and 24.

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
│   ├── xrpl-connect/          # Meta-package that re-exports everything
│   ├── react/                 # React bindings (@xrpl-commons/xrpl-connect-react)
│   ├── vue/                   # Vue bindings (@xrpl-commons/xrpl-connect-vue)
│   └── privy/                 # Privy social login (@xrpl-commons/xrpl-connect-privy)
├── examples/                  # vanilla-js, react, and privy-vanilla integration examples
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

The four coordinated artifacts are `xrpl-connect`, `@xrpl-commons/xrpl-connect-react`,
`@xrpl-commons/xrpl-connect-vue`, and `@xrpl-commons/xrpl-connect-privy`. Their versions and the
`xrpl-connect` peer ranges of the React, Vue, and Privy packages must move together. The core, UI,
and adapter workspace packages (`@xrpl-connect/*`) are not published to npm; `xrpl-connect` bundles
and re-exports them.

The automated release path uses the `npm` GitHub environment in `release.yaml`. Configure each
package's npm trusted publisher for `XRPL-Commons/xrpl-connect`, workflow `release.yaml`, environment
`npm`, and the `npm publish` action. `NPM_READ_TOKEN` must be read-only and is exposed only to the
access/ownership preflight. `NPM_DIST_TAG_TOKEN` must be a granular token limited to these packages;
it is exposed only to the resumable `dist-tag` operations, which the workflow's pinned npm 11.6.2
does not authenticate through OIDC. Artifact uploads run without either token through npm's OIDC
trusted publisher and emit provenance. Configure required reviewers on that environment before
using the automated path.

npm can configure a trusted publisher only for a package that already exists, so the workflow cannot
publish a coordinated package for the first time. `@xrpl-commons/xrpl-connect-privy` is not on npm
yet, so publish its first release, `1.1.0-rc.0`, through
[manual local publication](#manual-local-publication) instead of the workflow. Use an account that
owns `xrpl-connect` and may create packages in the `xrpl-commons` organization, and answer npm's
two-factor prompts. The coordinated command publishes all four packages, so do not publish the Privy
package on its own first: its new `latest` tag would fail the RC preflight. Then configure the new
package's trusted publisher as above and add it to the `NPM_DIST_TAG_TOKEN` package selection before
the next automated release.

Before dispatching a release:

1. Make sure `develop` is green and the worktree is clean.
2. Set the exact version in all four artifact manifests and `docs/package.json`; set the three
   `xrpl-connect` peer ranges (React, Vue, and Privy) to `^<version>`.
3. Move `[Unreleased]` into a dated changelog section and update current release/migration docs.
4. Merge those changes to `develop`, then dispatch **Publish Release** from that exact commit with
   the matching channel and version.

The workflow repeats the complete build, packed-consumer, registry, access, ownership, and integrity
checks. Only after final registry verification does it create the immutable `v<version>` source tag
and GitHub Release. Publishing and tag/release creation are resumable, but an existing version or tag
with different contents/commit is rejected. The guarded workflow then invokes the Pages workflow
with that exact tag and waits for deployment, so unreleased `develop` content cannot get ahead of the
documented npm channel.

### Release candidates

Release candidates must never move any existing `latest` dist-tag. Prepare a version such as
`1.1.0-rc.0`, keep the guarded manifest default on `rc`, and dispatch the release workflow with
channel `rc`. For local maintainer verification, the equivalent guarded command is:

```bash
pnpm --filter xrpl-connect run publish:rc -- --confirm 1.1.0-rc.0
```

The packed-consumer checks also read the install commands of the root README, the React and Vue
package READMEs, the example READMEs, and the getting-started, framework, and migration guides
(`DOCUMENTED_INSTALL_PATHS` in `packages/xrpl-connect/scripts/test-publish.mjs`). Each must install
`xrpl@^5` and at least one coordinated package, and every coordinated package must be spelled
`<package>@rc` for a candidate and as the bare package name for a stable release. Switch those
commands as part of preparing each channel.

Preflight records each package's existing `latest`, permits only an older candidate on `rc`, and
rejects unknown tags. Before the first registry mutation, every local tarball is packed and every
already-published artifact is checked for exact integrity. Fresh artifacts publish under `rc`; exact
artifacts from an interrupted run are reused and retagged. The final check requires all four `rc`
tags on the confirmed candidate and every `latest` value unchanged.

### Stable releases

After live-wallet approval, prepare the stable version with the three `xrpl-connect` peers at
`^<version>`, switch the documented install commands from `@rc` to the bare package names, and
dispatch channel `stable`. The stable publisher uploads under the temporary `release` tag. It
verifies the immutable integrity of all four registry artifacts before moving the first `latest`
tag, promotes all four packages, removes the temporary tag, and verifies the final coordinated state
while preserving `rc`. An interrupted upload or promotion is resumed by rerunning the exact workflow
input; never repair tags with ad hoc commands.

### Manual local publication

Use this path to publish from your terminal with your npm account instead of configuring GitHub
Actions credentials. Start from the reviewed release-preparation commit merged into `develop`, with
a supported Node.js 24 release (24.11 or later) and pnpm 10.18.3. All four package versions must
equal the release version, and the React, Vue, and Privy peers must require
`xrpl-connect@^<version>`. A `-rc.N` version is a release candidate published on `rc`; any other
version is a stable release published on `latest`. The read-only checks below derive the channel
from the version, and each publish command refuses a version of the other channel.

Set `RELEASE_COMMIT` to the full SHA of the reviewed commit on `develop` and `RELEASE_VERSION` to the
exact manifest version, for example `1.1.0-rc.0`. Stop if any command fails; do not substitute a
newer branch tip without reviewing it.

```bash
RELEASE_COMMIT="<full reviewed commit SHA>"
RELEASE_VERSION="<exact release version>"
git fetch origin develop
git switch --detach "$RELEASE_COMMIT"
test "$(git rev-parse HEAD)" = "$RELEASE_COMMIT"
git status --porcelain=v1 --untracked-files=all
corepack pnpm install --frozen-lockfile
```

The status command must produce no output. If your normal checkout contains unrelated work, use a
clean worktree at `RELEASE_COMMIT`. Retain both variables throughout publication; the source tag
must identify that same commit. Check `pnpm --version` from this checkout: it must report `10.18.3`
because the release scripts also invoke `pnpm` directly. If it resolves to another version, run
`corepack enable pnpm` for your active Node installation and check again.

Log in through npm's browser flow. Complete any account or two-factor authentication prompts in
your own terminal/browser.

```bash
npm login --auth-type=web --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
```

The commands below use the npm user config written by `npm login`. They clear release-token
environment overrides so a stale CI token cannot override that login. Local publication does not
produce the GitHub Actions provenance attestation.

First run the read-only access and registry preflight:

```bash
env -u NODE_AUTH_TOKEN -u NPM_TOKEN -u NPM_READ_TOKEN -u NPM_DIST_TAG_TOKEN \
  NPM_CONFIG_PROVENANCE=false \
  corepack pnpm --filter xrpl-connect run verify:release:preflight
```

It verifies membership in `xrpl-commons`, ownership of `xrpl-connect`, and that the current npm tags
allow the coordinated release. Resolve any failure before publishing.

The following commands **publish all four npm packages**. Each first repeats the full packed-consumer
checks, then publishes, verifies, and tags the artifacts together. For a release candidate:

```bash
env -u NODE_AUTH_TOKEN -u NPM_TOKEN -u NPM_READ_TOKEN -u NPM_DIST_TAG_TOKEN \
  NPM_CONFIG_PROVENANCE=false \
  corepack pnpm --filter xrpl-connect run publish:rc -- --confirm "$RELEASE_VERSION"
```

For a stable release:

```bash
env -u NODE_AUTH_TOKEN -u NPM_TOKEN -u NPM_READ_TOKEN -u NPM_DIST_TAG_TOKEN \
  NPM_CONFIG_PROVENANCE=false \
  corepack pnpm --filter xrpl-connect run publish:stable -- --confirm "$RELEASE_VERSION"
```

Answer any npm authentication prompts interactively. If an upload or tag operation is interrupted,
rerun the same command from the same clean commit. The publisher reuses matching artifacts and
rejects integrity mismatches. Do not overwrite versions or manually move tags to bypass a failure.

Verify the final npm state:

```bash
env -u NODE_AUTH_TOKEN -u NPM_TOKEN -u NPM_READ_TOKEN -u NPM_DIST_TAG_TOKEN \
  corepack pnpm --filter xrpl-connect run verify:release:registry
```

For a release candidate, all four packages must have `rc` pointing to `RELEASE_VERSION` and every
`latest` tag unchanged. For a stable release, all four must have `latest` pointing to
`RELEASE_VERSION`, their previous `rc` tags preserved, and no temporary `release` tag. Only after this
verification succeeds, create `v<version>` at the recorded source commit and create the GitHub
Release. If the tag already exists, verify it identifies that commit; never force-move it.

```bash
RELEASE_TAG="v$RELEASE_VERSION"
if ! git show-ref --verify --quiet "refs/tags/$RELEASE_TAG"; then
  git tag --annotate "$RELEASE_TAG" "$RELEASE_COMMIT" --message "XRPL Connect $RELEASE_VERSION"
fi
test "$(git rev-parse "$RELEASE_TAG^{commit}")" = "$RELEASE_COMMIT" &&
  git push origin "refs/tags/$RELEASE_TAG"
```

Stop if the tag check or push fails. Once the remote tag is confirmed, create the GitHub Release
if it does not already exist; otherwise inspect the existing release. A candidate is marked as a
prerelease, a stable release as the latest release.

```bash
if gh release view "$RELEASE_TAG"; then
  echo "Review the existing $RELEASE_TAG release above."
else
  case "$RELEASE_VERSION" in
    *-rc.*) gh release create "$RELEASE_TAG" --verify-tag --title "$RELEASE_TAG" --generate-notes --prerelease ;;
    *) gh release create "$RELEASE_TAG" --verify-tag --title "$RELEASE_TAG" --generate-notes --latest ;;
  esac
fi
```

Local npm publication and creating a GitHub Release do not automatically deploy documentation.
Once the source tag and published GitHub Release exist, dispatch the documentation workflow from
`develop`, the repository's default branch:

```bash
gh workflow run deploy_vitepressDoc.yaml --ref develop --field release_tag="$RELEASE_TAG"
```

The workflow requires a published, non-draft GitHub Release and builds from its exact source tag.
It uses GitHub Pages permissions and does not require npm publishing credentials or republish any
packages. The automated release workflow continues to call the same deployment workflow.

Watch the resulting run in Actions. After it succeeds, check that the live installation guide
installs the release's channel: `<package>@rc` for a candidate, the bare package names for a stable
release. Rerun the same dispatch if only the documentation deployment needs to be retried; keep the
release tag unchanged.

### Live wallet validation

Automated package tests validate exports, types, SSR loading, and mocked adapter behavior; they do
not replace approvals in real wallets. Before promoting an RC to a stable release, test the exact
packed candidate in a fresh browser application and record the result for every adapter:

| Adapter       | Required environment                                              |
| ------------- | ----------------------------------------------------------------- |
| Xaman         | Desktop QR and mobile deep link with a registered application     |
| Crossmark     | Supported browser with the Crossmark extension installed          |
| GemWallet     | Supported browser with the approved GemWallet extension/API usage |
| WalletConnect | Desktop QR and mobile deep link with a Reown project ID           |
| Ledger        | Supported browser, connected device, and the XRP app open         |
| Xyra          | Supported browser with the Xyra wallet installed                  |
| GHOSTSIG      | Supported browser with a PRF-capable passkey and popups allowed   |
| Otsu          | Supported browser with the Otsu wallet installed                  |
| MetaMask Snap | Supported browser with MetaMask and the XRPL Snap installed       |
| Privy         | Privy app with dashboard login methods, origin, and callback URL  |

For each wallet, verify availability, connect, account/network reporting, every declared signing
capability, rejection or cancellation, disconnect, and session restoration. Also verify switching
between two adapters in one session. Record the browser, wallet version, network, account, candidate
tarball integrity, and result so the stable-release decision is reproducible.

For Privy, also verify:

| Privy scenario     | Expected result                                                                  |
| ------------------ | -------------------------------------------------------------------------------- |
| Social login       | Every enabled dashboard method signs in, including OAuth return and CAPTCHA      |
| Embedded wallet    | First login creates the XRPL wallet; a returning login restores the same one     |
| Transaction review | The connector shows the review; Approve signs, Reject fails with `SIGN_REJECTED` |
| Testnet submission | `signAndSubmit` on a funded testnet account returns the validated result         |

## Reporting Security Issues

Please **do not** open public issues for security vulnerabilities. Email the maintainers via the contact details in the [`xrpl-connect` GitHub organization page](https://github.com/XRPL-Commons) instead.

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](./LICENSE).
