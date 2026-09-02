# Issue #180

## Issue summary

- Ledger currently treats an empty `SigningPubKey` as multisign intent but signs the ordinary transaction serialization and writes a top-level `TxnSignature`, producing an invalid multisign contribution.
- Valid multisigning must bind the signing preimage to the connected Ledger account and return a transaction with a `Signers` entry and no top-level signature.
- Single-sign behavior and submission must remain unchanged, malformed multisign inputs must fail safely, and XRPL client connections must close on every path.
- Ledger-specific and aggregate documentation must describe the actual v1 signing contract.

## Plan

- [x] Validate GitHub access, refresh `origin/develop`, inspect issue state/comments/linked PRs, and create a clean isolated worktree.
- [x] Audit Ledger signing, public transaction types, XRPL serialization APIs, tests, lifecycle paths, and documentation claims.
- [x] Define valid single-sign and multisign input/output invariants against authoritative XRPL vectors.
- [x] Implement signer-bound multisigning and guaranteed client cleanup without changing single-sign submission behavior.
- [x] Add focused regressions for single-sign, multisign, signer binding, malformed input, multiple signer contributions, and success/failure cleanup.
- [x] Update Ledger and aggregate adapter documentation to match the implemented contract.
- [x] Run focused formatting, linting, type/build, and tests plus repository-level verification appropriate to the change.
- [x] Review the final diff against every acceptance criterion and record results below.
- [x] Commit only intentional files, push the branch, open the PR, and verify remote metadata/checks.

## Review

- The root cause was a host/device contract mismatch: an empty `SigningPubKey` tells Ledger firmware to create the signer-bound multisigning preimage, while the adapter serialized the returned signature as a top-level single signature.
- Ledger signing now sends the firmware's expected ordinary unsigned serialization, independently verifies the returned signature against either the single-sign or account-bound multisign preimage, and emits multisign contributions under `Signers` without a top-level `TxnSignature`.
- Multisign input rejects missing source accounts and any pre-existing signature material; `signAndSubmit` rejects partial multisign contributions while preserving single-sign submission behavior. XRPL clients disconnect after successful signing and all covered autofill, device, verification, and submission failures.
- Official XRPL TrustSet vectors prove the exact firmware payload, signer-bound preimages, each Ledger contribution, and the combined transaction hash `BD636194C48FD7A100DE4C972336534C8E710FD008C0F3CF7BC5BF34DAF3C3E6`. A fail-before check confirmed the prior top-level signature neither verified as a single signature nor could be combined with `xrpl.multisign`.
- The initial Ledger suite passes all 39 tests. `pnpm exec vp check`, `pnpm docs:snapshot:check`, `pnpm docs:build`, `pnpm test`, and `git diff --check` pass; the exact final tree was rechecked with the focused Ledger suite, `vp check`, and the full monorepo suite.
- Independent protocol, vector, and final-diff reviews found no blocking findings. The final review's documentation note was resolved by documenting multisign contribution hashes as potentially empty/non-final until aggregation.

## Fix PR #183 review finding

- [x] Make multisign signing consume an already prepared transaction without per-signer autofill.
- [x] Reject multisign inputs missing the fee or sequence required for a submission-ready contribution.
- [x] Add regressions for exact-payload preservation and fail-closed incomplete inputs.
- [x] Align Ledger and aggregate documentation with the enforced prepared-input contract.
- [x] Run focused and repository-level verification, review the final diff, commit, push, and verify the PR head.

### Fix review

- Multisign `sign()` now signs the caller-prepared transaction exactly as supplied and does not create an XRPL client, preventing signer-count fee underestimation and per-signer autofill drift.
- Missing `Fee` or `Sequence` fails before XRPL or Ledger interaction; the authoritative two-signer vector still combines to the expected transaction hash.
- Ledger documentation, aggregate adapter guidance, API reference, transaction guide, and changelog all state the enforced prepared-input contract.
- All 41 Ledger tests, `pnpm exec vp check`, `pnpm test`, `pnpm docs:snapshot:check`, and `git diff --check` pass on the final tree.

## Final documentation cleanup

- [x] Make the Ledger multisign example use the manager defined by its setup.
- [x] Make generic signing guidance distinguish single-sign artifacts from multisign artifacts whose quorum cannot be inferred locally.
- [x] Align the active migration guide with the multisign contribution contract.
- [x] Correct the stale authoritative transaction hash in this audit log.
- [x] Run documentation and repository checks, review the diff, commit, push, and verify the final PR head.

### Cleanup review

- The Ledger example now uses the configured `walletManager` and an XRPL endpoint matching its network.
- Generic and migration guidance refuse automatic submission of a `Signers` artifact without claiming that every such artifact is incomplete; both explain that quorum readiness requires adapter-specific handling.
- The migration guide explicitly documents Ledger contributions and aggregation, and the internal audit now matches the authoritative combined-transaction hash asserted by the test vector.
- `pnpm exec vp check`, `pnpm docs:snapshot:check`, `pnpm docs:build`, and `git diff --check` pass on the cleanup diff.

---

# Issue #179

## Issue summary

- Explicit network requests can currently be silently substituted or incorrectly attached to an account even when a wallet is signing on another ledger.
- Adapters must reject unsupported explicit networks with `NETWORK_NOT_SUPPORTED` and use a wallet-reported live network whenever their provider exposes one.
- `WalletManager` must reject requested-versus-returned mismatches before attaching listeners, committing account state, or persisting a session; an omitted request must preserve the adapter's authoritative network.
- Signing, submission, regression coverage, and the bundled-adapter support documentation must all reflect the authoritative connected network.

## Plan

- [x] Validate GitHub access, refresh `origin/develop`, and confirm issue state, lock state, comments, linked PRs, and acceptance criteria.
- [x] Create a clean isolated worktree from the refreshed default branch and review applicable repository guidance and lessons.
- [x] Trace core connection state, typed network errors, and every bundled adapter's requested/reported/signing network behavior.
- [x] Define the minimal authoritative-network contract for explicit standard/custom requests and omitted network options.
- [x] Implement manager validation before state/session commit and correct adapters that substitute or mislabel requested networks.
- [x] Add focused core and adapter regressions for mainnet, testnet, devnet, custom/unknown identifiers, omitted requests, and wallet/request mismatches.
- [x] Document the supported network set and omitted-network behavior of each bundled adapter.
- [x] Run formatting, type checks, focused tests, builds, repository verification, and `git diff --check` appropriate to the final diff.
- [x] Review the final behavior and diff against every acceptance criterion and record results below.
- [x] Commit only intentional files, push the branch, open the PR, and verify remote PR metadata/checks.

## Review

- `WalletManager` now validates an explicit call-level or configured network before reconnect serialization, listeners, state commit, or persistence. Exact IDs and equivalent CAIP chain IDs are accepted, conflicting IDs are rejected with `NETWORK_MISMATCH`, and omitted requests preserve the adapter-reported live network.
- Xaman, Crossmark, GemWallet, WalletConnect, Xyra, Otsu, Ledger, and MetaMask Snap now expose explicit supported-network behavior without silent substitution. Wallet-reported adapters fail closed when the live network is missing, unsupported, or different from the request.
- Transaction signing/submission revalidates authoritative live state where the wallet can change networks independently; Xaman validates the selected rail and returned signed payload, WalletConnect binds requests to the approved CAIP chain, and Ledger uses the configured endpoint as authority for autofill/submission.
- Regression coverage spans standard and custom networks, omitted requests, request/live mismatches, malformed provider data, contradictory CAIP metadata, network changes before signing, persistence ordering, and stale connection races. Independent review findings in those edge cases were corrected before final verification.
- The affected core/adapter matrix passes 395 tests. `pnpm lint`, `pnpm format:check`, `pnpm docs:snapshot:check`, the full `pnpm test` build-and-test run, and `git diff --check` pass on the final tree.

## Fix PR #186 review findings

- [x] Reject contradictory standard network IDs and CAIP identifiers before manager state commit.
- [x] Prevent Xaman from committing a connection after disconnect during live-network resolution.
- [x] Track or fail closed on WalletConnect account and chain session changes before signing.
- [x] Normalize Otsu's real primitive account/network event payloads and preserve object compatibility.
- [x] Add focused regressions that reproduce all four reviewed defects.
- [x] Run focused and repository-level verification, review the final diff, commit, push, and verify the remote PR head.

### Fix review

- Standard XRPL IDs now derive their canonical CAIP chain and reject contradictory request or adapter metadata while custom aliases with the same explicit chain remain compatible.
- Xaman rechecks its connection generation after the authoritative network query, so a completed lookup cannot revive state cleared by `disconnect()`.
- WalletConnect reconciles `accountsChanged`, `chainChanged`, and `session_update`, emits adapter state events, removes all four session handlers, and closes invalid authorization before any signing request.
- Otsu accepts the provider's primitive account/network events and the legacy object shape, retaining its existing malformed-network error behavior.
- The four focused suites pass 247 tests. `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm docs:snapshot:check`, and `git diff --check` pass on the final tree.

## Rebase PR #186 for merge

- [x] Rebase the PR branch onto current `origin/develop` and resolve overlapping changelog and Crossmark test changes without losing either branch's coverage.
- [x] Review the integrated cumulative diff and verify no adjacent source or task-history changes were dropped.
- [ ] Run focused conflict-area checks plus full repository tests, lint, formatting, documentation snapshot, and diff validation.
- [ ] Push the rewritten branch with lease protection and verify the exact remote head, mergeability, and CI state.

---

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
- The protected `Publish Release` workflow accepts exact RC/stable inputs, publishes only from the default branch, creates the immutable source tag and GitHub Release after registry verification, and invokes the reusable Pages workflow with the matching documentation tag.
- All three immutable npm RC0 artifacts record git head `6cddda6`; the missing annotated `v1.0.0-rc.0` tag and prerelease now exist at that exact commit, repairing the changelog source links.
- Verification passes: 18 focused release tests; live npm RC1 preflight; YAML parsing; `pnpm exec vp check`; `pnpm docs:snapshot:check`; `pnpm --filter xrpl-connect test:publish` including React 18/19, Vue, ESM/CJS/SSR, strict peers, and Nuxt 4; two exact-tree `pnpm test` runs; and `git diff --check`.
- Independent review found a tag rollback race, job-wide credential exposure, unrestricted manual docs deployment, and the missing RC0 metadata. The race, credential scoping, and deployment trigger were corrected; RC0 metadata was created. A proposed stable-cleanup issue was disproved by the existing partial-cleanup regression, which re-adds missing staging tags before verification and promotion.
- Signed commit `575fa08` was pushed as PR #185 targeting `develop`; the remote head, issue linkage, commit verification, and four started CI jobs were confirmed after delivery.

## Fix PR #185 review findings

- [x] Replace the suppressed release-event handoff with an exact-tag documentation deployment that runs inside the guarded release workflow and satisfies the existing Pages environment policy.
- [x] Validate resumed GitHub Releases for published state, RC/stable type, and stable latest status.
- [x] Permit an older `rc` tag when starting a newer RC train while retaining same-train stable safeguards.
- [x] Enforce channel-correct package specifications in every current installation document before tarball substitution.
- [x] Add focused regressions for workflow orchestration, release metadata, future release trains, and RC/stable documentation channels.
- [x] Run focused and repository-level verification, review the final diff, commit, push, and verify the remote PR head/checks.

### Fix review

- Documentation deployment is now a synchronous reusable-workflow job after verified release creation. It inherits the guarded default-branch ref required by the existing Pages environment while checking out and building the exact immutable release tag.
- Existing releases are normalized and rechecked for tag, draft/publication state, RC/stable prerelease state, and stable Latest status before documentation can deploy.
- RC preflight accepts only older release trains when advancing `rc`; stable promotion still requires the matching release train, and newer RC versions or trains remain rejected.
- Every current install command must use `@rc` for RC releases and unqualified coordinated packages for stable releases before candidate specs are replaced with local tarballs.
- All 20 focused release tests, workflow YAML and shell parsing, `pnpm exec vp check`, the documentation snapshot check, packed publication/consumer verification, the full monorepo build/test suite, and `git diff --check` pass. Independent final review found no remaining workflow, policy, documentation, or cross-file defects.

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
