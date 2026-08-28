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
