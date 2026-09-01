# Issue #168

## Issue summary

- The React wrapper cannot expose the UI connector's supported `show-unavailable` behavior because `WalletConnectorProps` has no corresponding prop and unknown props are not forwarded.
- `showUnavailable` must use boolean-attribute presence/removal semantics so unavailable wallet rows can be enabled and disabled after mount.
- React's direct custom-element JSX declaration is stale: it omits `show-unavailable` and advertises unsupported legacy attributes such as `background-color`.
- Focused runtime, source and packed public type, and documentation coverage must keep the wrapper and intrinsic-element APIs aligned.

## Plan

- [x] Validate GitHub access, refresh `origin/develop`, and confirm issue state, comments, linked PRs, and acceptance criteria.
- [x] Create a clean isolated worktree from the refreshed default branch and review applicable repository guidance.
- [x] Trace the React wrapper, UI boolean-attribute behavior, Vue parity implementation, tests, public type checks, and documentation.
- [x] Implement the minimal production-ready React prop and exact intrinsic custom-element JSX declaration.
- [x] Add focused runtime regressions for enabling, disabling, and updating unavailable-wallet rendering.
- [x] Add source and packed public type regressions for the wrapper prop and direct custom-element JSX.
- [x] Document the React prop and align any generated or mirrored documentation required by the repository.
- [x] Run formatting, linting, focused tests, builds/type checks, publish checks, and relevant repository-level verification.
- [x] Review the final diff against every acceptance criterion and record results below.
- [x] Commit only intentional files, push the branch, open the PR, and verify remote PR metadata/checks.

## Review

- `WalletConnector` now maps the typed `showUnavailable` prop to `show-unavailable=""` when true and omission when false or undefined, matching the native component and Vue parity without React 18's unsafe `"false"` serialization.
- Direct custom-element JSX types expose only the real `primary-wallet`, `wallets`, `show-unavailable`, and host attributes; the stale `background-color` declaration is gone and `show-unavailable` rejects the unsafe explicit false form.
- The React declaration rollup restores both `React.JSX` and legacy global `JSX` augmentations after API Extractor, with packed ESM and CommonJS fixtures proving the wrapper prop, supported intrinsic attribute, legacy rejection, and React 18/19 namespace coverage.
- Runtime coverage verifies omitted, enabled, and disabled attribute states across rerenders; the package README, React framework guide, API reference, and Unreleased changelog document the public behavior.
- `pnpm exec vp check`, the full React build/type/SSR/runtime suite, strict packed declaration checks, `pnpm docs:snapshot:check`, `pnpm --filter xrpl-connect test:publish`, `pnpm test`, and `git diff --check` pass.
- Independent final review found one stale API-reference omission, which was fixed; the updated diff has no remaining runtime, declaration, test, documentation, compatibility, or scope findings.
