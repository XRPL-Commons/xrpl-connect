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
