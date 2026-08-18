# Issue #124: Nuxt SSR-safe composable guidance

## Issue summary

- The documented wallet component is universal, so its `<script setup>` calls Vue composables during SSR before the `.client.ts` Nuxt plugin installs their injection.
- Nuxt's template `<ClientOnly>` prevents server-rendered markup but does not prevent the containing component's setup function from executing.
- The wallet plugin, every component that calls its composables, and the connector UI must execute only on the client; package imports remain SSR-safe.
- Nuxt, migration, and production guidance must agree, and named `xrpl-connect` imports should not be paired with a redundant same-entry side-effect import.

## Plan

- [x] Validate GitHub access, issue state, default branch, and linked PR state.
- [x] Create a clean worktree from `origin/develop` on `fix/issue-124-nuxt-ssr-composables`.
- [x] Update the Nuxt guide to use a `.client.vue` wallet consumer and explain setup-time SSR behavior.
- [x] Align migration, production, and adjacent Vue guidance; remove redundant same-entry side-effect imports.
- [x] Add a practical regression fixture or document why a behavioral fixture is disproportionate.
- [x] Run formatting, docs build, and relevant checks.
- [x] Review the final diff for minimality and correctness.
- [x] Commit, push, and open PR #134 that fixes #124.

## Review

- The Nuxt example now keeps plugin installation and every injected composable consumer on the
  client, while clearly distinguishing SSR-safe imports from client-only execution.
- Nuxt, Vue, migration, production, and package README guidance now agree on the boundary and no
  longer pair named `xrpl-connect` imports with redundant same-entry side-effect imports.
- Added two Vue server-render regression tests: the unsafe same-component setup throws, while a
  composable child below the server's client-only placeholder is never executed.
- A temporary real Nuxt app successfully completed its client build, server build, and `/`
  prerender. Committing that fixture was disproportionate because it added thousands of lockfile
  lines and incompatible framework peer/engine ranges, so the focused SSR tests retain the
  behavioral guard without changing the production dependency graph.
- Verification passed:
  - `pnpm exec vp run -F @xrpl-connect/vue test` (13 tests)
  - `pnpm exec vp run -F @xrpl-connect/vue type-check`
  - `pnpm run docs:build`
  - `pnpm exec vp check` (230 files formatted; 93 files linted with no warnings)
  - `pnpm test` (full recursive build and package test suite)

## PR #134 review fix

- [x] Confirm the existing issue #124 worktree is clean and matches the current PR head.
- [x] Replace the independently resolved server renderer with Vue's matched SSR subpath export.
- [x] Refresh the lockfile and prove the Vue and renderer versions are aligned.
- [x] Run focused Vue tests, type-checking, formatting, and repository consistency checks.
- [x] Review the final diff, commit, push, and confirm the remote PR head.

### Result

The SSR tests now import `renderToString` through `vue/server-renderer`, which resolves Vue and
its renderer to the same 3.5.24 release. The redundant direct renderer dependency and lockfile
importer entry were removed. The full recursive build/test matrix, all 13 Vue tests, Vue
type-checking, formatting over 230 files, linting over 93 files, and `git diff --check` pass.

# Issue #119: v1 release candidate coordination

## Issue contract

- Broken behavior: the three v1 release-candidate manifests still identify as `0.8.2`, and the React/Vue peer ranges reject `xrpl-connect@1.0.0-rc.0`.
- Expected behavior: the exact umbrella, React, and Vue candidate artifacts publish as `1.0.0-rc.0`, install together without peer conflicts, and default to the public `rc` dist-tag without moving `latest`.
- Release constraints: `xrpl-connect@latest` must remain `0.8.2`; the scoped packages are first-time public publications; every candidate artifact must be rebuilt and dry-run before publishing.
- Documentation constraint: prerelease install examples must opt into `@rc` or use the exact prerelease version.

## Implementation

- [x] Set the three public candidate package versions to `1.0.0-rc.0`.
- [x] Change React and Vue's `xrpl-connect` peer range to accept the v1 prerelease.
- [x] Add package-level publish defaults that select the public npm registry, public access, and the `rc` dist-tag; propagate them into the generated umbrella manifest.
- [x] Extend packed-artifact verification to rebuild, pack, inspect, dry-run, and strict-peer-install the exact umbrella, React, and Vue tarballs together.
- [x] Make the umbrella publish build self-sufficient on a clean checkout by generating its declaration input before rolling the publish types.
- [x] Add explicit authenticated checks for npm scope membership and post-publish dist-tags without making CI publish anything.
- [x] Update prerelease installation documentation to opt into the `rc` tag.
- [x] Record the release-coordination change in the changelog.

## Conflict resolution

- [x] Refresh `develop` and the PR branch, then identify every semantic conflict.
- [x] Merge current `develop` while preserving RC release safeguards and newer base behavior.
- [x] Fix the confirmed release-command, npm-warning, and partial-publish recovery defects.
- [x] Run focused script, packed-consumer, repository, formatting, and diff verification.
- [x] Review the cumulative PR diff, commit, push, and confirm PR mergeability/checks.

### Result

Current `develop` is merged without conflict markers or unmerged paths. The resolution preserves
the newer React packed type/SSR coverage and Vue SSR guidance while making the RC publisher safe to
rerun after a partial upload: byte-identical candidates are skipped, divergent contents and
non-404 registry failures abort. Verification passed with a frozen install, the 9 focused release
tests, live read-only registry preflight, Vue type-checking, all three packed-candidate consumer
checks, the docs production build, formatting over 238 files, linting over 94 files, the full
recursive build/test suite, and both staged and cumulative diff checks.

## Release-readiness follow-up

- [x] Make the umbrella artifact genuinely safe to import without browser globals and add an
      unmasked packed ESM/CommonJS SSR regression test.
- [x] Make interrupted publishing recover missing `rc` tags, reject dirty source trees, pin the
      lifecycle registry, and verify both scoped and unscoped npm permissions.
- [x] Exercise the packed Vue artifact through ESM/CommonJS types, runtime loading, and SSR.
- [x] Repair audited documentation, examples, licensing, version labels, release instructions,
      workspace compatibility guidance, and supported-runtime CI coverage.
- [x] Run the complete release verification matrix and review the cumulative diff.
- [x] Sign, commit, push, and confirm PR #133 checks.

### Follow-up result

The four release blockers are resolved. The exact candidate artifacts now import without browser
globals, packed Vue consumers cover both module systems plus SSR and NodeNext declarations, and the
publisher rejects dirty or misconfigured releases while safely repairing an interrupted `rc` tag.
Standalone Crossmark ESM/CommonJS interop, package licenses, CI runtime coverage, frozen installs,
broken links, environment examples, RC labels, changelog state, and release instructions were also
repaired. The UI peer remains intentionally at `@xrpl-connect/core@^0.8.3`: UI consumes the new
shared `isMobile` API introduced after core 0.8.2, so widening it to 0.8.2 would advertise an
incompatible standalone pairing; the v1 candidate bundles the workspace source and is unaffected.

## Fresh review fixes

- [x] Make Xyra lazy loading browser-resolvable and cover the built consumer path.
- [x] Normalize the standalone Crossmark ESM SDK facade and strengthen runtime smoke coverage.
- [x] Make the recursive release-build filter portable across POSIX and Windows shells.
- [x] Run focused adapter, command, packed-artifact, formatting, and diff verification.
- [x] Review the final patch, commit it, push the PR branch, and confirm remote checks.

### Review-fix result

Xyra's SDK now remains lazy while resolving to a package-owned ESM chunk and an inlined lazy UMD
module; packed verification rejects both plain and Vite-ignored bare imports. Crossmark uses one
normalized SDK facade for the adapter and public export, with ESM/CommonJS shape assertions. The
release dependency filter now uses portable double quotes and is covered by the command tests.
Crossmark tests pass 19/19, Xyra tests 11/11, publisher tests 12/12, the complete three-package
publish build/dry-run/install/runtime/type suite passes, and repository formatting, lint, and diff
checks are clean. Two independent final reviews found no remaining actionable defects.

Verification passed the full recursive build/test suite, repository format/lint checks, docs and
React example production builds, the exact frozen docs install, public npm registry preflight,
standalone Crossmark module smoke tests, focused publisher and adapter tests, and the complete
three-tarball strict-peer pack/install/type/runtime/SSR matrix. The production audit reports only
the accepted, documented low-severity unpatched `elliptic` advisory in Crossmark's declaration-only
dependency graph.

## WalletConnect distribution licenses

- [x] Add the Reown attribution and identify the bundled WalletConnect packages.
- [x] Ship the exact WalletConnect Community License and the modal's Apache-2.0 license.
- [x] Make packed-artifact verification require the notices and both license texts.
- [x] Run focused and complete release verification.
- [x] Commit, push, and confirm PR checks.

### Review

The checked-in Community License is byte-for-byte identical to the installed
`@walletconnect/sign-client@2.23.10` license. The complete package test and packed-candidate matrix
pass, including strict peer installation, ESM/CommonJS type checks, SSR/runtime loads, and assertions
that the installed umbrella package contains the Reown notice and both WalletConnect license files.
Repository formatting and lint checks also pass.

## Release DevEx cleanup

- [x] Make the published quick start copy-paste safe and list all eight adapters.
- [x] Correct the React example configuration paths and standalone example instructions.
- [x] Declare the supported Node.js range on all three release candidates.
- [x] Prevent publishing the umbrella package from its source workspace directory.
- [x] Document the live-wallet release validation matrix.
- [x] Run focused tests, packed-candidate verification, example and docs builds, and repository checks.
- [x] Commit, push, and confirm PR checks.

### Review

The npm quick start now supplies Xaman's required application identifier, all public discovery text
lists the complete adapter set, and the React example documents its actual provider/hooks/component
architecture and `main.tsx` configuration. All three candidates declare the CI-tested Node.js range.
Direct publication from the source umbrella package fails with an actionable command, while the
prepared artifact retains its registry/tag/access guard. The focused 12-test suite, both example
production builds, the docs build, repository formatting/lint, and the complete three-tarball
strict-peer/type/runtime/SSR suite pass. No browser backend was exposed for an interactive local
smoke test; real extension, mobile, and hardware approvals are now an explicit pre-stable matrix.

## Versioned documentation

- [x] Audit v1 documentation and the existing 0.8.2-to-1.0 migration guide.
- [x] Generate an immutable 0.8.2 documentation snapshot from the `v0.8.2` tag.
- [x] Add a visible 0.8.2 / 1.0.0 documentation switch without breaking current URLs.
- [x] Expand migration guidance for package, framework, adapter, signing, and error changes.
- [x] Verify generated links, both versions, production builds, and repository checks.
- [x] Commit, push, and confirm PR checks.

### Review

The site now keeps the 1.0.0 documentation at every existing URL and serves a generated 0.8.2
archive under `/0.8.2/`. The archive is pinned to tag `v0.8.2` and commit
`01ce8a669bd81ec76b4d10750e406b601f6e2f51`; CI and Pages deployment reject snapshot drift.
Archived interactive pages explicitly defer to the current live demos instead of silently loading
1.0 code. The migration guide now covers the actual RC package matrix, modular imports, signing
artifacts, capabilities, live account refresh, compatible persistence, connector behavior,
framework lifecycle, SSR boundaries, and wallet-specific changes. The audit also repaired the
published rejection-code example, React lifecycle wording, adapter-maintainer guide, MetaMask
discovery description, and umbrella export reference.

Verification passed the deterministic 13-page snapshot check, repository formatting/lint, the
production VitePress build, both locale-specific navigation/search indexes, 32 rendered pages with
no missing internal links, and served 200 responses for both version roots plus representative
nested and migration routes. The in-app browser backend was unavailable, so rendered HTML and the
local preview server were used for route/navigation verification.
