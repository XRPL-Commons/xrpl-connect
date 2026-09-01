# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0-rc.1] - 2026-09-01

### Added

- React: forward typed `WalletConnectorElement` refs and safe host attributes through `<WalletConnector>`, with explicit managed-prop precedence (#172).
- React: make `useWalletModal()` awaitable with connector readiness, `openAndWait()`, explicit missing-connector failures, and deterministic ownership when multiple connectors are mounted (#171).
- React: expose unavailable-wallet rows through the typed `showUnavailable` wrapper prop and align direct custom-element JSX attributes (#168).
- Vue: make `useWalletModal()` awaitable with connector readiness, `openAndWait()`, explicit missing-connector failures, and deterministic ownership when multiple connectors are mounted (#145).
- Vue: expose the native unavailable-wallet display behavior through the typed `showUnavailable` component prop (#146).
- UI: export the exact wallet-connector CSS-variable contract and stable modal portal/part metadata, with typed React and Vue overrides and connected-account modal styling hooks (#151).

### Changed

- Release: parameterize coordinated RC and stable publication, preserve every `latest` tag during RC publication, stage and verify all stable artifacts before promotion, and publish through protected npm trusted publishing with provenance (#182).
- Documentation: deploy current documentation from verified GitHub Releases so the documented npm channel and deployed API stay aligned.

### Fixed

- React: ship the custom-element JSX and typed-ref declaration in the packed package, and verify the advertised React 18 and 19 runtime/type compatibility in isolated consumers (#170).
- Documentation: pin current install commands to `xrpl@^4` so registry-latest v5 cannot drift outside the supported v3/v4 peer range; packed-consumer verification now executes the literal React dependency specifications and rejects stale install examples (#169).
- xrpl-connect (meta-bundle): emit the Xaman mock-WebSocket constructor without an optional chain so Nuxt 4 and Vite/Rollup production builds can consume the published ESM artifact. Consumers can remove `patch-package` or transpilation workarounds for `xrpl-connect.mjs` (#141).

## [1.0.0-rc.0] - 2026-08-18

### Added

- New package `@xrpl-commons/xrpl-connect-react`: official React bindings so consumers no longer hand-roll a context/hooks layer. Provides `<XrplConnectProvider config={…}>` (owns a single `WalletManager`, configured once), the hooks `useWallet`, `useSigner`, `useWalletModal`, and a themeable `<WalletConnector>` modal component with typed props and typed-`WalletError` callbacks (`onError(err) → err.code`/`err.category`). Ships its own tests (#33).
- New adapter `@xrpl-connect/adapter-metamask-snap`: connect XRPL through MetaMask via the `xrpl-snap` Snap (provider RPC, no extra npm dependency). Wired into the `xrpl-connect` meta-package (`MetaMaskSnapAdapter`, `Adapters.MetaMaskSnap`). Adapter authored by @LeJamon; modernised to current conventions (shared tsup config, SVG icon asset, typed EIP-1193 provider) with added Vitest coverage (#46).
- UI: optional `show-unavailable` attribute on `<xrpl-wallet-connector>`. By default the modal hides wallets that aren't installed (unchanged). With `show-unavailable` set, those wallets are listed with an "Install" label that opens the wallet's download page (`url`) instead of attempting to connect. Mirrors Stellar Wallets Kit's `hideUnsupportedWallets` / install-label option.
- Core: add declarative signing capabilities through `WalletAdapter.capabilities`, `WalletManager.supports()`, `adapterSupports()`, and `CAPABILITY_DEFAULTS`. Undeclared `sign`, `signAndSubmit`, and `signMessage` flags default to `true` for compatibility; explicitly unsupported manager operations fail with typed `UNSUPPORTED_METHOD` before the adapter is called. Xaman and WalletConnect now declare arbitrary message signing unsupported.
- Core: add optional `signerAddress` fields to direct-adapter `SignedTransaction` and `SignedMessage` results, plus `ManagedSignedTransaction` and `ManagedSignedMessage` manager result types where the signer address is required. The manager preserves an adapter-provided signer and otherwise records the account that started the signing request.
- Core/adapters: add strict live account refresh through `SupportsFetchAccount`, `supportsFetchAccount()`, and `WalletManager.fetchAccount()`. Crossmark, GemWallet, Ledger, Otsu, and Xaman query their wallet or device and refresh manager account/network state; WalletConnect, Xyra, and custom adapters without the optional interface fail with typed `UNSUPPORTED_METHOD` rather than returning cached data. A missing live account clears the manager session. `ConnectOptions.skipRequestAccess` is also exposed as a best-effort silent-access hint that adapters may ignore.
- xrpl-connect (meta-package): re-export each adapter's full public surface, not just the adapter class. Consumers can now reach adapter-specific exports — including every `*AdapterOptions`/`*ConnectOptions` type — and the complete upstream Xaman, Xaman OAuth, Crossmark, and GemWallet APIs through the collision-safe `XamanSDK`, `XamanOAuth2`, `CrossmarkSDK`, and `GemWalletAPI` namespaces (#35).
- UI: `<xrpl-wallet-connector>.openAndWait()` opens the modal and returns a `Promise<AccountInfo>` that resolves when a wallet connects and rejects if the user closes the modal first — so callers can `await` a connection in one call instead of wiring up `connected` / `close` listeners.
- UI: the wallet list now surfaces the most-recently-used wallet first. The connector remembers the last-used wallets (localStorage) and orders the list by usage, keeping the original order for wallets with no history. An explicit `primary-wallet` still takes precedence.

### Changed

- Release: prepare `xrpl-connect`, `@xrpl-commons/xrpl-connect-react`, and `@xrpl-commons/xrpl-connect-vue` as `1.0.0-rc.0` with RC-compatible peers, guarded `rc` publishing defaults, and combined packed-artifact verification (#119).
- Release tooling: reject dirty worktrees and non-npm registries, verify ownership of the unscoped package, and safely restore missing `rc` tags after interrupted publishes.
- DevEx: test all supported Node.js release lines in CI with frozen installs, ship an MIT license in every candidate artifact, and align release, framework, and RC documentation.

### Fixed

- Otsu/UI: report Otsu as available only when its injected provider is present,
  and retry unavailable wallets when the connector is reopened so late provider
  injection is discovered (#140).
- Dependencies: refresh WalletConnect and constrain vulnerable transitive ranges used by WalletConnect, Crossmark declarations, and documentation tooling so production installs no longer report high-severity advisories; document the remaining declarations-only low-severity finding (#116).
- Xyra/meta-bundle: lazy-load the browser-only Xyra SDK so both ESM and CommonJS umbrella imports are safe during SSR; verify no-DOM imports in fresh packed consumers.
- Crossmark: normalize the upstream CommonJS SDK namespace so the standalone adapter loads through both Node ESM and CommonJS, with a build-time runtime smoke test.
- Vue: verify the packed ESM and CommonJS runtime, SSR rendering, and strict NodeNext declaration consumption alongside the React candidate.
- MetaMask Snap adapter: discover MetaMask through EIP-6963 without polluting global provider types, invalidate partial reconnects, accept queued submissions, reject lossy byte-message decoding, and preserve typed wallet errors.
- Adapters (`@xrpl-connect/adapter-xaman`): `sign()` and `signAndSubmit()` now pass `options.submit` explicitly (`false` / `true`), force and validate supported Xaman network rails, bind requests and resolved payloads to the connected signer, cryptographically verify single- and multi-signatures, use Xaman's managed payload subscription without leaking a second websocket, and validate the authoritative resolved transaction hash, blob, signature, and JSON. Opened requests can resolve after payload expiry; disconnect waits for authoritative cancellation or resolution before logging out; sign-only requests fail if Xaman dispatches them; and submit requests return only after Xaman reports that the transaction was applied or accepted into the queue. Unsupported arbitrary message signing now fails explicitly instead of returning an empty signature (#105).
- Adapters (`@xrpl-connect/adapter-walletconnect`): `sign()` and `signAndSubmit()` no longer report `TxnSignature` as `tx_blob`. `TxnSignature` is a raw signature, not a serialized transaction blob — reporting it as `tx_blob` broke any `sign()`-then-submit-yourself flow (e.g. multi-party transactions needing a second cosigner) even though it went unnoticed in `signAndSubmit()`, since the wallet submits directly there. Both methods now return the full signed `tx_json` (with `SigningPubKey`/`TxnSignature`) and the raw signature under `SignedTransaction`'s existing `signature` field; `tx_blob` is only set when the wallet actually provides one (#103).
- Core / UI: wallet availability checks are now bounded by a timeout. Modal population, `WalletManager.getAvailableWallets()`, connection preflights, and GemWallet's extension check could wait indefinitely for an adapter's `isAvailable()` call, so a slow or hung probe (e.g. on a flaky mobile connection) could leave the wallet list or selected-wallet flow blank/frozen. Checks are now raced against a 1000 ms timeout (`TIME.AVAILABILITY_TIMEOUT`) via a new `withTimeout` helper — an unresponsive wallet is treated as unavailable, while the modal continues with the rest of the list (#16).
- Core/Ledger: reconnect persists only the adapter-approved effective derivation path, replays it with the stored network, and rejects a restored session when the wallet returns a different account or network. Older stored states without reconnect options remain supported.
- xrpl-connect (meta-bundle): the published npm package now ships TypeScript types. The self-contained Vite bundle previously emitted no `.d.ts` and the generated `package.json` had no `types`/`exports.types`, so `npm install xrpl-connect` consumers got zero IntelliSense for the re-exported core/UI/adapter API. `publish:build` now rolls a single inlined `dist-publish/index.d.ts` via api-extractor (mirroring the JS bundle, with `@xrpl-connect/*` and `eventemitter3` types inlined) and `prepare-publish.mjs` wires up `types` + `exports.types`. Every declaration import left external by the rollup is now declared as a peer or direct dependency in the published manifest so it resolves for consumers. The manifest also drops the erroneous `"type": "module"` so CommonJS `require()` works, and the `publish:build` step is self-sufficient on a clean checkout (#56).

## [0.8.2] - 2026-05-21

### Fixed

- xrpl-connect (meta-bundle): load `.svg` imports as raw text in the Vite build so adapter icons aren't double-encoded as `data:image/svg+xml,data%3Aimage%2Fsvg%2Bxml%2C…` and render correctly in consumer apps (#87). The 0.8.1 fix in #85 corrected the per-adapter tsup builds but the published meta-bundle still shipped the broken pattern.

## [0.8.1] - 2026-05-21

### Fixed

- Adapters: drop the invalid `;utf8` media-type parameter from inlined SVG icon data URLs so wallet logos render in browsers / CSP / sanitizer setups that strict-parse `data:` URIs (#85).

## [0.8.0] - 2026-05-21

### Added

- Core: `WalletError` category taxonomy for consistent error handling across adapters (#63).
- Core: configurable logger via `WalletManagerOptions` (#65).
- Core: versioned persisted session schema with a migration path (#61).
- Core/UI: adapter capability interfaces so the UI can adapt to per-adapter features (#57).

### Changed

- Core: extract a shared `resolveNetwork` helper used across adapters (#53).
- UI: replace pervasive `any` with a typed component context (#52).
- UI: consolidate magic numbers and theme tokens into shared constants (#58).
- Adapters: extract inline base64 icons into dedicated asset files (#67).
- Build: standardize `tsup` configuration across all packages (#62).

### Fixed

- Core: detach adapter event listeners on disconnect to prevent leaks (#64).
- WalletConnect & Xaman: isolate per-instance state so multiple instances no longer interfere (#59).
- UI: detach event listeners on disconnect and view change to prevent leaks (#54).

### Tests

- Adapters: add Vitest coverage for the 7 bundled wallet adapters (#55).

### Documentation

- Align all framework guides (Vanilla JS, React, Vue) with the current public API.
- Fix React import examples to use the meta-package (#48).
- Show error handling and `autoConnect` usage in the quickstart (#68).
- Add `CHANGELOG.md` and `CONTRIBUTING.md` at the repository root (#60).

## [0.7.1] - 2026-04-10

### Fixed

- Otsu adapter: correct wallet URL.
- Otsu adapter: fix `isAvailable` detection.

## [0.7.0] - 2026-04-10

### Added

- Otsu Wallet adapter (`@xrpl-connect/adapter-otsu`) and Otsu in the bundled examples.

## [0.6.0] - 2026-03-02

### Added

- Xyra Wallet adapter (`@xrpl-connect/adapter-xyra`), with separate `sign` and `signAndSubmit` methods.

### Changed

- Updated adapters README with directory structure and Xyra integration details.
- Run formatting across the codebase.

## [0.5.2] - 2026-02-20

### Changed

- UI: render the modal centered in the viewport.

### Added

- CI now runs on the `develop` branch.

## [0.5.1] - 2026-02-17

### Changed

- Maintenance release (version bump only).

## [0.5.0] - 2026-02-17

### Changed

- **Breaking:** split the adapter signing API into separate `sign` and `signAndSubmit` methods. Adapters and consumers calling `sign` need to update accordingly.
- Refactor the UI web component into smaller pieces and add unit tests.
- Migrate to ESLint 9.

### Fixed

- Build pipeline fixes and a clean `pnpm` install path.
- `pnpm audit` vulnerability fixes.

## [0.4.0] - 2025-11-14

### Added

- Ledger hardware wallet adapter (`@xrpl-connect/adapter-ledger`).
- React example/template.
- LLM-friendly documentation output (VitePress LLMs plugin) with a "download all documentation" link.
- Adapter authoring guide.

### Changed

- WalletConnect: use the WalletConnect modal on mobile to ensure proper deep-linking.
- Logo reworked to use a base64 SVG.

## [0.3.0] - 2025-10-27

### Added

- VitePress-based documentation site published via GitHub Pages.
- Auto-detection of available wallets.
- Post-connect modal (replaces the disconnect-on-click flow).
- "Connect" button shipped inside the web component (component is now button + modal).
- CSS-based style customization with the `xc-` prefix.

### Changed

- Switch the build to Vite for the meta package.
- Crossmark adapter: use `signAndSubmitAndWait` and improve `isAvailable`.

[Unreleased]: https://github.com/XRPL-Commons/xrpl-connect/compare/v1.0.0-rc.1...HEAD
[1.0.0-rc.1]: https://github.com/XRPL-Commons/xrpl-connect/compare/v1.0.0-rc.0...v1.0.0-rc.1
[1.0.0-rc.0]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.8.2...v1.0.0-rc.0
[0.8.2]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.5.2...v0.6.0
[0.5.2]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/XRPL-Commons/xrpl-connect/releases/tag/v0.3.0
