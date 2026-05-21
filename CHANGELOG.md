# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.8.2...HEAD
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
