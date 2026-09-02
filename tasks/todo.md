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

# Issue #178

## Issue summary

- Provider- and adapter-controlled values are interpolated into HTML strings used by the wallet connector, allowing hostile text, attributes, or URLs to create executable DOM.
- Dynamic text and attributes must be rendered through safe DOM APIs, and wallet/QR image URLs must reject executable or unexpected schemes while retaining bundled icons.
- The fix must cover errors, wallet lists, loading, account selection/details, and QR images without changing styling, accessibility semantics, or customization parts.
- Regression tests must prove markup, quote-breaking, event-handler, and unsafe-URL payloads remain inert and cannot create unexpected elements or execute code.

## Plan

- [x] Validate GitHub access, refresh `origin/develop`, and confirm issue state, comments, linked PRs, and acceptance criteria.
- [x] Create a clean isolated worktree from the refreshed default branch and review applicable repository guidance and lessons.
- [x] Inventory every UI rendering sink and define one consistent safe DOM boundary and URL policy.
- [x] Implement the minimal production-ready rendering change while preserving public behavior, styles, ARIA, and `part` hooks.
- [x] Add focused regressions for every affected view, account details, and QR image rendering.
- [x] Run formatting, linting, type checks, focused UI tests, browser coverage where relevant, and repository-level verification.
- [x] Review the final diff against every acceptance criterion and record results below.
- [x] Commit only intentional files, push the branch, open the PR, and verify remote PR metadata/checks.

## Review

- All adapter- and provider-controlled text and attributes now reach the DOM through text, property, dataset, attribute, or CSSOM APIs. Source-controlled markup is isolated behind a tagged static-template helper that rejects substitutions, while connector and portal roots use `replaceChildren`.
- Wallet and QR logo sources accept absolute HTTP(S) and supported `data:image/*` formats, including bundled SVG icons, while executable and unexpected schemes are rejected. Direct Xaman QR images additionally require HTTPS, the exact `xumm.app` host, `/sign/`, and a PNG path; adapter-produced deep links reject executable protocols.
- Security regressions cover hostile markup, quote-breaking wallet/account attributes, error messages, wallet names and icons, account addresses and balances, unsafe URL schemes, Xaman origin confusion, and direct QR-image rendering. Existing customization assertions continue to prove stable parts, and the browser suite proves styling, dialog semantics, focus, scrolling, and portal behavior.
- The UI dependency-inclusive build, source/public type checks, lint, all 134 UI tests, all 9 wallet-dialog browser tests, `pnpm exec vp check`, the full monorepo `pnpm test`, packed publish/consumer verification, and `git diff --check` pass.
- Independent surface and final reviews found no remaining actionable security, compatibility, accessibility, styling, or test gaps. The intentional residual policies are a deep-link denylist that preserves wallet-specific schemes and continued support for bundled SVG data icons as image sources.

## Fix PR #184 review finding

- [x] Reconfirm the dedicated worktree is clean and matches the exact remote PR head.
- [x] Replace unsupported `replaceChildren()` calls with one compatible DOM helper without reintroducing HTML parsing.
- [x] Add a regression that fails against the reviewed PR head when native `replaceChildren()` is unavailable.
- [x] Run focused UI checks, browser tests, repository checks, and packed-artifact verification appropriate to the fix.
- [x] Review the final diff, commit, push, and verify the updated PR head and CI state.

### Fix review

- A single `replaceViewChildren()` helper now removes and appends nodes through long-supported DOM primitives; every connector, portal, QR, error, and copy-feedback replacement path uses it without reintroducing HTML parsing.
- The compatibility regression temporarily masks native `replaceChildren()` on both affected DOM prototypes, then proves the connector renders its host button and opens its dialog. Against the reviewed PR head it failed with `TypeError: this.shadow.replaceChildren is not a function` before the button rendered.
- The rebuilt UI ESM and CommonJS artifacts contain no `replaceChildren` calls.
- All 135 UI tests, UI type-check/build, repository formatting/lint, all 9 Chromium wallet-dialog tests, the full monorepo build/test pipeline, packed ESM/CJS/SSR/React 18/React 19/Vue/Nuxt consumer verification, and `git diff --check` pass.
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
