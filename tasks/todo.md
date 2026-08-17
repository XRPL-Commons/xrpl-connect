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
