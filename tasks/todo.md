# Issue #141

- [x] Validate GitHub access, repository, issue state, and default branch.
- [x] Create a clean issue worktree and review repository guidance.
- [x] Reproduce and trace the optional-chain constructor in the published bundles.
- [x] Implement the minimal production fix.
- [x] Add a packed-consumer Vite/Rollup build smoke test using the real umbrella tarball.
- [x] Replace the raw Vite smoke build with a Nuxt 4 production regression that fails on the affected artifact.
- [x] Re-run focused and repository-level verification after the review fix.
- [x] Commit and push the review fix to PR #159.
- [x] Verify the rebuilt ESM and UMD artifacts.
- [x] Run focused and repository-level formatting, linting, and tests.
- [x] Review the final diff against issue acceptance criteria.
- [x] Commit, push, and open the pull request.

## Review

- Root cause: Rolldown normalizes `xumm-sdk`'s guarded constructor into a parenthesized optional-chain constructor in both umbrella artifacts.
- Fix: normalize that exact final-bundle expression to the equivalent direct property constructor after the SDK's existing type guard.
- Regression coverage: assert the ESM and UMD output syntax, then install the real tarballs into an isolated consumer and build the umbrella ESM with Nuxt 4 and its Vite production pipeline.
- Fail-before proof: Nuxt 4.1.3 with pinned Vite 7.1.11 and Rollup 4.62.2 rejects the affected packed artifact with `Constructor in/after an optional chaining is not allowed`.
- Verification: `pnpm exec vp check`, `pnpm test`, and `pnpm --filter xrpl-connect test:publish` pass. The publish test covers package builds, pack/dry-run checks, strict consumer install, type/runtime checks, both emitted artifact forms, and the Nuxt/Vite production build.
- Documentation: the Unreleased changelog tells Nuxt/Vite consumers they can remove their `xrpl-connect.mjs` workaround after upgrading to the fixed release candidate.

---

# Issue #151 PR

## Issue summary

- The customization API accepts arbitrary Vue CSS-variable names even though the UI forwards a fixed whitelist, so misspellings compile but have no effect.
- Wallet and account modals live in separate body-level shadow-root portals; consumers lack a documented, stable mapping from hosts to parts, variables, targets, and lifecycle.
- The fix must establish one readonly runtime/type source of truth shared by UI and framework bindings, then document stable portal selectors and unscoped Vue/Nuxt usage.
- Drift coverage must keep runtime forwarding, public declarations, documentation, portal hosts, and part names aligned.

## Plan

- [x] Validate GitHub access, refresh `origin/develop`, inspect issue state/comments/linked PRs, and create a clean isolated worktree.
- [x] Inventory the current CSS-variable forwarding, portal hosts, shadow parts, framework props, documentation, and existing tests.
- [x] Design the smallest authoritative customization contract covering wallet and connected-account modal styling.
- [x] Export exact readonly CSS-variable metadata and public `WalletConnectorCssVariable` / `WalletConnectorCssVars` types from the owning package.
- [x] Adopt the exact contract in UI runtime forwarding and framework bindings without breaking supported customization paths.
- [x] Document every supported host, part, target, lifecycle, forwarded variable, and global Vue/Nuxt selector with working examples.
- [x] Add focused runtime, type-level, documentation, portal-host, and part-name drift regressions.
- [x] Run formatting, linting, focused tests, builds/type checks, publish checks, and repository-level verification appropriate to the change.
- [x] Review the final diff against every acceptance criterion and record results below.
- [x] Commit only intentional files, push the branch, open the PR, and verify the remote PR metadata/checks.

## Review

- `WALLET_CONNECTOR_CSS_VARIABLES` is the UI runtime/type source of truth for all 36 supported tokens; the exact `WalletConnectorCssVariable` and `WalletConnectorCssVars` types flow through the umbrella, React, and Vue declarations.
- Stable portal attributes/selectors and host-grouped part metadata now drive wallet and account modal markup, including connected-account overlay, modal, close, address, and disconnect styling hooks.
- Canonical docs map every host/part to its target and lifecycle, provide typed overrides plus global Vue and Nuxt examples, and the published UI README/example no longer advertise the ineffective `--xrpl-*` prefix or incorrect modal shadow tree.
- Runtime/type/documentation drift tests cover the stylesheet list, all-variable forwarding, typo filtering/rejection, direct-body portal placement, close/unmount lifecycle, exact host-to-part mappings, and packed ESM/CJS framework declarations.
- `pnpm exec vp check`, UI/React/Vue focused checks, `pnpm build`, `pnpm docs:snapshot:check`, `pnpm --filter xrpl-connect test:publish`, `pnpm test`, and `git diff --check` pass.
- Independent final review found three documentation/lifecycle/source-of-truth gaps; all were fixed and the exact final tree passed the focused UI suite and full monorepo pipeline.
- Signed commit `58fd901` was pushed and opened as PR #167 targeting `develop`; the remote head, signature, issue linkage, and checks were verified after delivery.

## Fix PR #167 review findings

- [x] Verify the dedicated worktree is clean and matches the exact remote PR head.
- [x] Make every exported customization token affect runtime styling or remove it from the contract.
- [x] Correct the UI README portal topology and add drift coverage for direct-body sibling hosts.
- [x] Run focused UI checks plus repository-level build, test, publish, and documentation verification.
- [x] Review the final diff, commit, push, and verify the updated PR head and CI.

### Fix review

- The contract now contains 34 runtime-effective tokens: base radius feeds the modal fallback, focus colors keyboard outlines, danger colors error/destructive UI, and unsupported success/warning tokens are no longer advertised.
- The package README renders the connector and both body-level portal hosts as siblings, with a drift test tied to the exported portal attributes.
- Static consumption coverage fails for declared-but-unused tokens, and Chromium verifies radius, focus, and danger overrides against rendered wallet/account portal UI.
- UI type/runtime tests, all nine Chromium tests, repository formatting/lint, the full monorepo build/test pipeline, documentation snapshot verification, and packed ESM/CJS/SSR/Nuxt consumer verification pass.
