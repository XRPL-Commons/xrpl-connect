# Issue #170

## Issue summary

- The React package advertises React 18 and 19 peer compatibility, but its packed-consumer verification installs and exercises React 18 only.
- Each supported major must use matching React, React DOM, and type-package versions while checking the complete public React surface.
- Both versions must prove mounted custom-event/callback behavior plus ESM, CJS, and SSR-safe package imports.
- Any genuine React 19 incompatibility must be fixed; otherwise the existing peer range remains justified by executable coverage.

## Plan

- [x] Validate GitHub access, refresh `origin/develop`, and confirm issue state, comments, linked PRs, and acceptance criteria.
- [x] Create a clean isolated worktree from the refreshed default branch and review applicable repository guidance.
- [x] Trace the current React publish fixture, public contract, mount/event behavior, import checks, and version assumptions.
- [x] Design the smallest packed-consumer matrix with isolated React 18 and React 19 dependency sets.
- [x] Implement type, mounted-runtime, ESM/CJS, and SSR verification for both supported majors.
- [x] Run focused fail-before/proof checks, formatting, linting, builds, and repository-level verification.
- [x] Review the final diff against every acceptance criterion and record results below.
- [x] Commit only intentional files, push the branch, open the PR, and verify remote PR metadata/checks.

## Review

- The packed fixture previously used one uncontrolled runtime install with React 18 type packages, so it could not prove matching React 18/19 dependency sets; the global-only custom-element JSX declaration was also removed by the API Extractor rollup.
- The publish test now creates isolated strict-peer React 18 and React 19 consumers, asserts matching `react`, `react-dom`, `@types/react`, and `@types/react-dom` majors, and preserves both `React.JSX` and React 18 global `JSX` augmentations in the published declarations.
- Packed public-contract fixtures cover hooks, provider, wrapper callback inference, custom JSX attributes, and a typed custom-element ref; runtime fixtures cover ESM, CommonJS, SSR-safe loading, a real DOM mount, normalized custom events, callbacks, and manager-driven connection state in both majors.
- A React 19 packed-consumer fail-before check produced `TS2339` for the missing `xrpl-wallet-connector` intrinsic; the new fixture passes with the generated declaration.
- `pnpm --filter @xrpl-commons/xrpl-connect-react type-check`, `pnpm --filter @xrpl-commons/xrpl-connect-react test:types`, the React test suite, `pnpm exec vp check`, `pnpm test`, two exact-head `pnpm --filter xrpl-connect test:publish` runs, and `git diff --check` pass.
- Independent review found two declaration defects after PR #175 merged: the branch dropped React 18's global `JSX` augmentation and replaced the supported `show-unavailable` attribute with inert `background-color`. Both are resolved below.

## Fix PR #177 review findings

- [x] Rebase the PR branch onto current `origin/develop` and resolve overlapping PR #175 changes without regressing its public contract.
- [x] Preserve both `React.JSX` and React 18 global `JSX` custom-element augmentation in source and packed declarations.
- [x] Keep the intrinsic attribute contract aligned with the runtime: support `show-unavailable` and reject inert `background-color`.
- [x] Extend the React 18/19 packed fixtures to prove the merged declaration and attribute contract.
- [x] Run focused React checks, the full packed publish matrix, repository checks, and `git diff --check`.
- [x] Review the final diff, commit, push with lease protection, and verify PR head and CI state.

### Fix review

- The branch is rebased onto `develop` at `36edb79`; the conflict resolution preserves PR #175's unavailable-wallet contract, PR #176's forwarded wrapper ref/host attributes, and the dual `React.JSX` / React 18 global `JSX` augmentation.
- `WalletConnectorIntrinsicProps` now targets `WalletConnectorElement`, so object refs expose the connector methods while refs to unrelated hosts are rejected in both React majors.
- The isolated packed-consumer matrix verifies matching React/React DOM/runtime type-package majors, ESM, CommonJS, JSX, SSR, mounted callbacks, and the exact raw-element attribute/ref contract for React 18 and 19.
- The React build, source and packed type checks, SSR smoke, all 33 React tests, `pnpm exec vp check`, `pnpm test`, `pnpm --filter xrpl-connect test:publish`, and `git diff --check` pass after the final rebase over PR #176.
- Independent final declaration review found no remaining actionable findings.

---

# Issue #182

## Issue summary

- The guarded publisher hard-codes `1.0.0-rc.0` and assumes framework `latest` points at the candidate, so immutable RC0 artifacts block current `develop` and RC1 cannot preserve every existing `latest` tag.
- Stable v1 needs a coordinated policy that uploads all three `1.0.0` artifacts without moving `latest`, verifies every immutable artifact, and only then promotes the complete set.
- Release metadata is split across package manifests, peer ranges, docs, changelog links, npm tags, git tags, and GitHub Releases; RC0 has no matching source tag or release.
- The solution must retain clean-tree, registry, access/ownership, integrity, resumability, partial-publication, and packed-consumer safeguards while adding a trusted GitHub Actions publication path with npm provenance.

## Plan

- [x] Validate GitHub access, refresh `origin/develop`, confirm issue state/comments/linked PRs, inspect npm tags, and create a clean isolated worktree.
- [x] Define one release configuration contract for version, channel, allowed registry tags, previous `latest` values, and RC/stable promotion phases.
- [x] Refactor the publisher and registry verifier around that contract while preserving access, ownership, clean-tree, integrity, retry, and resumability guarantees.
- [x] Add focused policy/publisher tests for fresh and subsequent RCs, stable staging/promotion, partial interruptions, identical and mismatched artifacts, and forbidden channel/tag/registry states.
- [x] Prepare coordinated `1.0.0-rc.1` umbrella/React/Vue manifests and framework peer ranges, including generated packed-manifest guard expectations.
- [x] Add a protected manual GitHub Actions release workflow using npm trusted publishing/OIDC and provenance, with post-verification source tag and GitHub Release creation.
- [x] Cut the RC1 changelog and update maintainer, migration, install, release-channel, trusted-publisher, and docs-deployment guidance so documented tags match npm availability.
- [x] Run focused fail-before/proof tests, formatting/linting, builds, packed publish verification, docs checks, repository tests, and workflow/static validation.
- [x] Review the final diff against every acceptance criterion, record results below, and correct any design or coverage gaps.
- [x] Commit only intentional files, push the branch, open the PR, and verify the remote PR metadata and checks.

## Review

- `release-policy.mjs` is the single version/channel/tag contract. RC publication preserves the exact preflight `latest` snapshot; stable publication uses the temporary `release` tag, verifies every immutable artifact, promotes all `latest` tags, removes staging tags, and preserves `rc`.
- The publisher validates all local/remote integrities before its first mutation and rechecks the exact tag snapshot after the build, preventing both partial publication before a late mismatch and an RC downgrade race. Existing identical artifacts, uploads, tag promotion, staging cleanup, and registry propagation are resumable.
- Access/ownership uses a read-only token, artifact uploads are tokenless OIDC with provenance, and only `dist-tag` subprocesses receive the granular package-write token; builds, tests, packs, registry reads, and git checks receive no npm secrets.
- The coordinated umbrella, React, Vue, and docs versions are `1.0.0-rc.1`; framework peers are `^1.0.0-rc.1`, while the standalone modular packages remain unchanged.
- The protected `Publish Release` workflow accepts exact RC/stable inputs, publishes only from the default branch, creates the immutable source tag and GitHub Release after registry verification, and lets only published releases deploy the matching documentation tag.
- All three immutable npm RC0 artifacts record git head `6cddda6`; the missing annotated `v1.0.0-rc.0` tag and prerelease now exist at that exact commit, repairing the changelog source links.
- Verification passes: 18 focused release tests; live npm RC1 preflight; YAML parsing; `pnpm exec vp check`; `pnpm docs:snapshot:check`; `pnpm --filter xrpl-connect test:publish` including React 18/19, Vue, ESM/CJS/SSR, strict peers, and Nuxt 4; two exact-tree `pnpm test` runs; and `git diff --check`.
- Independent review found a tag rollback race, job-wide credential exposure, unrestricted manual docs deployment, and the missing RC0 metadata. The race, credential scoping, and deployment trigger were corrected; RC0 metadata was created. A proposed stable-cleanup issue was disproved by the existing partial-cleanup regression, which re-adds missing staging tags before verification and promotion.
- Signed commit `575fa08` was pushed as PR #185 targeting `develop`; the remote head, issue linkage, commit verification, and four started CI jobs were confirmed after delivery.

---

# Issue #172

## Issue summary

- The React `WalletConnector` keeps its custom-element ref private, so consumers cannot use the exported `WalletConnectorElement` imperative API through the wrapper.
- The wrapper destructures a closed SDK-specific prop set and drops ordinary host metadata such as `id`, `title`, `data-*`, and `aria-*` instead of forwarding it to `<xrpl-wallet-connector>`.
- The fix must preserve provider registration, SDK callbacks, `className`, merged theme/CSS-variable/inline styles, and React 18/19 support while making managed-prop precedence explicit.
- Runtime and source/packed declaration tests must prove the ref contract, imperative methods, host passthrough, collision precedence, and unsupported CSS-variable rejection.

## Plan

- [x] Validate GitHub access, refresh `origin/develop`, and confirm issue state, comments, linked PRs, and acceptance criteria.
- [x] Create a clean isolated worktree from the refreshed default branch and review applicable repository guidance and lessons.
- [x] Trace the React wrapper, custom-element contract, Vue passthrough behavior, runtime tests, public declarations, and publish fixtures.
- [x] Define the narrowest idiomatic React host-prop/ref contract and explicit precedence for managed connector attributes.
- [x] Implement typed `WalletConnectorElement` ref forwarding and safe host-attribute passthrough without changing existing lifecycle or style semantics.
- [x] Add focused runtime regressions for ref lifecycle, `open`, `openAndWait`, `close`, `toggle`, host attributes, callback isolation, and managed-attribute precedence.
- [x] Add source and packed ESM/CJS type regressions for typed refs and host attributes under the supported React contract.
- [x] Update current React documentation, API reference, and Unreleased changelog to describe the new contract and precedence.
- [x] Run formatting/linting, focused React tests/type checks/builds, publish verification, and repository-level verification appropriate to the diff.
- [x] Review the final diff against every acceptance criterion and record results below.
- [x] Commit only intentional files, push the branch, open the PR, and verify remote PR metadata/checks.

## Review

- `WalletConnector` is now an idiomatic `forwardRef` component that exposes the exact `WalletConnectorElement` instance while retaining its private lifecycle ref; callback-ref cleanup is preserved for React 19 and object/callback refs clear on unmount.
- Standard React host attributes flow to `<xrpl-wallet-connector>` through a typed HTML-attribute contract, including explicit `data-*` support, while children/HTML injection and the conflicting native `onError` signature remain excluded.
- SDK callbacks remain internal, `className` still maps to native `class`, and managed `primaryWallet`, `wallets`, class, and merged styles are applied after passthrough. Per-token style precedence remains `theme < cssVars < style`.
- Runtime tests obtain the exact host through a ref, exercise `open`, `openAndWait`, `close`, and `toggle`, verify ref cleanup, host metadata/event passthrough, and raw collision precedence. Source plus packed ESM/CJS fixtures enforce the ref and host-prop declarations.
- The package README, current React guide, API reference, and Unreleased changelog document refs, host attributes, and precedence; versioned documentation remains unchanged.
- Under Node 24.11.0, `pnpm exec vp check`, the dependency-inclusive React build, focused and full React tests, `pnpm test`, `pnpm docs:snapshot:check`, `pnpm --filter xrpl-connect test:publish`, and `git diff --check` pass.
- Self-review corrected an invalid module-scope hook in the first README example draft; an independent final review found no remaining correctness, lifecycle, type, test, documentation, or scope defects.

## Fix PR #176 review finding

- [x] Reconfirm the dedicated worktree and remote PR head are clean and identical.
- [x] Guard callback-ref cleanup returns by function type while preserving React 18/19 behavior.
- [x] Add a regression for concise callback refs that return the assigned element.
- [x] Run focused React checks and repository-level verification appropriate to the fix.
- [x] Review the final diff, commit, push, and verify the updated PR head and CI.

### Fix review

- Callback-ref returns are treated as React 19 cleanup callbacks only when they are functions; truthy assignment results are ignored so React can deliver the normal `null` detach callback.
- The new React 18 regression failed against the original PR code with `Unexpected return value from a callback ref` and passes with the function guard.
- The rebuilt packed artifact passes the original React 19.2.8 unmount reproduction for both native and wrapped refs.
- Focused and full React checks, dependency-inclusive build, repository formatting/lint, documentation snapshot verification, full monorepo tests, packed publish/consumer verification, and `git diff --check` pass.
- Merged the latest `origin/develop`, resolved the overlapping React API, documentation, and publish fixtures with `showUnavailable` intact, and repeated the full monorepo and packed-consumer verification on the combined tree.
