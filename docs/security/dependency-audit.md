# Dependency security audit

Last verified: 2026-11-06

This audit covers all 59 open GitHub Dependabot alerts and the complete workspace
dependency graph, including development tools:

```sh
pnpm audit
pnpm audit --prod
```

## Result

| Severity | Before (all dependencies) | After (all dependencies) |
| -------- | ------------------------: | -----------------------: |
| Critical |                         2 |                        0 |
| High     |                        38 |                        0 |
| Moderate |                        27 |                        0 |
| Low      |                        11 |                        1 |

The updated lockfile excludes the vulnerable versions for **58 of 59** open
Dependabot alerts. Both audit commands report only the remaining low-severity
`elliptic` advisory. Alerts are not dismissed; GitHub reevaluates the dependency
graph after the changes reach the default branch.

## Dependency changes

- Upgrade the coordinated Vite+ packages to 1.5.0, including Vitest 5.1.0 and
  Tinypool 2.2.0, and Vue to 3.5.45.
- Constrain affected transitive ranges to patched releases of Babel, URI and
  query-string parsers, CSS and Markdown tooling, browser mappings, multipart
  handling, cryptographic helpers, and glob expansion. Upgrade `node-forge` to
  1.4.3, including the fixes published after its original alert.
- Keep `gray-matter` on the compatible `js-yaml` 3.x API with a patched minimum
  of 3.15.2. Its parent-specific override must also be updated because it takes
  precedence over the general `js-yaml` override.
- Require the patched Zod 4.6.6 range for `abitype`'s optional peer. `abitype`
  already supports Zod 4; no application code uses that peer, so resolving the
  updated constraint removes Zod from the lockfile. This does not claim that
  Zod 4's legacy `zod/v3` entry point is patched.
- Upgrade the two tooling paths using Minimatch 10 to the patched 11.x line.
  API Extractor and `vitepress-plugin-llms` use the retained named `minimatch`
  function, not the removed `AST` or `makeRe` exports. Verify this override with
  the React declaration build and documentation build.

Vite+ now requires Node.js 22.18+, 24.11+, or 26+ for development. Published
packages retain their Node.js 20.19 support: CI builds the Node 20 consumer lane
with Node 22, then switches to Node 20 to run the packed-package compatibility
suite. The other lanes exercise consumers on Node 22 and 24.

## Remaining upstream dependency

[GHSA-848j-6mx2-7j84](https://github.com/advisories/GHSA-848j-6mx2-7j84)
remains open for `elliptic` 6.6.1. There is no public patched release. Its paths
include:

- Crossmark's `@crossmarkio/typings` through the legacy `@transia/xrpl` and
  `xrpl` dependency trees, including `ripple-keypairs` and `tiny-secp256k1`.
  XRPL Connect imports those Crossmark declarations with `import type` and
  bundles the required declarations into published artifacts.
- The browser build tooling through `vite-plugin-node-polyfills` →
  `node-stdlib-browser` → `crypto-browserify` → `browserify-sign` → `elliptic`.
  The vanilla example actively uses this polyfill plugin. This dependency
  graph must not be described as exclusively declarations-only.

Current upstream Crossmark typings and browser crypto polyfills still require
these dependencies. Forcing newer XRPL, keypair, or secp256k1 major versions would
break their declared API contracts. Removing the polyfills or Crossmark support
would change supported functionality. Keep this finding visible until a compatible
upstream fix or a separately validated replacement is available.
