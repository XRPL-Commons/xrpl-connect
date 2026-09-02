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

---

# Issue #181 / PR #138

## Issue summary

- Crossmark's sign-in challenge used `Math.random()` when browser crypto was unavailable, weakening authentication material without warning.
- The challenge must be generated exclusively with a supported cryptographically secure primitive and remain exactly 32 bytes / 64 hexadecimal characters.
- Environments without secure randomness must fail closed with a clear typed error before Crossmark receives a sign-in request.
- Regression coverage must prove the output contract, prevent any `Math.random()` fallback, and exercise the unavailable-crypto path.

## Plan

- [x] Validate GitHub access, refresh refs, inspect issue #181 and PR #138, and confirm authorization to update the existing PR.
- [x] Attach a clean dedicated worktree to PR #138 and merge current `origin/develop` without rewriting history.
- [x] Inspect the current Crossmark flow, typed-error conventions, test harness, and stale CI failures.
- [x] Implement the minimal fail-closed secure randomness behavior.
- [x] Add focused regressions for 32-byte/64-hex output, no `Math.random()` calls, and unavailable crypto.
- [x] Run focused tests, formatting, linting, type checks, builds, and relevant repository verification.
- [x] Review the cumulative diff against `develop` and every acceptance criterion, then record results below.
- [x] Commit only intentional changes, push PR #138's branch, refresh its metadata, and verify CI.

## Review

- PR #138's original `window.crypto` check failed 14 of 19 Crossmark tests under CI's browser-free Node environment; the new regression suite also failed before the production fix, proving the defect.
- The challenge generator now calls `globalThis.crypto.getRandomValues` with a 32-byte array, returns exactly 64 lowercase hexadecimal characters, and throws a clear typed `CONNECTION_FAILED` error before invoking Crossmark if the primitive is missing.
- Focused tests deterministically verify the byte/hex contract, prove `Math.random()` is never called, and cover the unavailable-crypto error path; the Crossmark suite passes all 22 tests.
- Crossmark formatting, lint, dependency-inclusive build, runtime smoke, and public-type checks pass. `pnpm exec vp check`, `pnpm test`, `pnpm --filter xrpl-connect test:publish`, `pnpm docs:snapshot:check`, and `git diff --check` also pass.
- Independent security/test review found no remaining correctness, compatibility, isolation, or scope issues in the cumulative diff against `origin/develop`.
- PR #138's refreshed CI is green for documentation and the complete test/build matrix on Node 20.19, 22.18, and 24.11.
