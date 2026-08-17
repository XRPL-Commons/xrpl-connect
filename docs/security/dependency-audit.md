# Production dependency audit

Audit date: 2026-08-17

This audit covers the production dependency graph reported by:

```sh
pnpm audit --prod
```

## Result

| Severity | Before | After |
| -------- | -----: | ----: |
| Critical |      0 |     0 |
| High     |     10 |     0 |
| Moderate |      8 |     0 |
| Low      |      1 |     1 |

The lockfile refresh updates the WalletConnect 2.x packages from 2.22.3 to 2.23.10. Narrow pnpm overrides also keep vulnerable transitive ranges out of the graph while respecting each upstream package's declared major-version range:

- WalletConnect runtime graph: `ws` 7.5.13, `h3` 1.15.11, and `defu` 6.1.7.
- Crossmark declarations graph: `node-forge` 1.4.0, `lodash` 4.18.1, `bn.js` 4.12.5, and `bn.js` 5.2.5.
- Documentation graph: `ws` 8.21.1 through `xrpl` and `@xrplf/isomorphic`.

## Reachability classification

WalletConnect is bundled browser runtime code. Its vulnerable websocket, storage, and utility paths were upgraded even where an advisory described a Node-only server API.

Crossmark's `@crossmarkio/typings` package is required by the published declaration surface. Its dependency graph includes `@transia/xrpl`, `xrpl` 2.14.1, `node-forge`, `lodash`, `bn.js`, and `elliptic`, but these paths are declarations-only for XRPL Connect: the Crossmark adapter imports `@crossmarkio/typings/sdk` with `import type`, and neither the Crossmark SDK's JavaScript artifacts nor the built XRPL Connect browser artifacts import those packages at runtime.

The `ws` 8.x path under `docs` is documentation tooling rather than a published XRPL Connect package dependency. It is still constrained to a patched release so a workspace production audit stays clean at high and moderate severities.

## Accepted residual risk

`GHSA-848j-6mx2-7j84` remains as a low-severity advisory for `elliptic` 6.6.1 through `@crossmarkio/typings > @transia/xrpl > @transia/ripple-keypairs`. The same installation also has parallel paths through `@crossmarkio/typings > xrpl@2.14.1 > ripple-keypairs` and `@crossmarkio/typings > xrpl@2.14.1 > bip32 > tiny-secp256k1`. The advisory has no patched release. XRPL Connect does not execute these dependency paths: they are installed to resolve Crossmark's public declarations and are absent from the adapter and meta-package browser JavaScript bundles. Replacing them would require an upstream Crossmark typings release; overriding `elliptic` cannot remove the advisory because every published version is affected.
