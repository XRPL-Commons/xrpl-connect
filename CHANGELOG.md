# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- UI: detach event listeners on disconnect and view change to prevent leaks (#54).

### Documentation

- Align all framework guides (Vanilla JS, React, Vue) with the current public API.
- Fix React import examples to use the meta-package (#48).
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

[Unreleased]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.7.1...HEAD
[0.7.1]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.5.2...v0.6.0
[0.5.2]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/XRPL-Commons/xrpl-connect/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/XRPL-Commons/xrpl-connect/releases/tag/v0.3.0
