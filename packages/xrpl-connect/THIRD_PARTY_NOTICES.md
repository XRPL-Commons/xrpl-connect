# Third-party notices

The published `xrpl-connect` JavaScript bundles and type declarations include software from the following projects.

## WalletConnect Sign Client

The bundle includes `@walletconnect/sign-client@2.23.10` and its reachable WalletConnect runtime
dependencies, including `@walletconnect/core`, `@walletconnect/types`, and `@walletconnect/utils`.

Portions © 2025 Reown, Inc. All Rights Reserved.

These components are distributed under the WalletConnect Community License Agreement. A copy is
provided in `licenses/WALLETCONNECT-COMMUNITY-LICENSE.md`. The upstream source and license are
available at <https://github.com/WalletConnect/walletconnect-monorepo>.

## WalletConnect Modal

The bundle includes `@walletconnect/modal@2.7.0`, distributed under the Apache License 2.0. A copy
is provided in `licenses/WALLETCONNECT-MODAL-APACHE-2.0.txt`. The archived upstream source is
available at <https://github.com/WalletConnect/modal>.

## Crossmark

The JavaScript bundle includes `@crossmarkio/sdk@0.4.0`. The packaged declarations include
`@crossmarkio/typings@0.0.6`, preserving its public SDK namespace.

Both upstream npm manifests declare `MIT`, but both published tarballs contain the same
GNU General Public License version 3 text in `LICENSE`. That shipped text is preserved in
`licenses/CROSSMARK-LICENSE.txt`; this notice records the discrepancy without resolving the
publisher's intended license. The upstream artifacts are available from the npm registry:
<https://registry.npmjs.org/@crossmarkio/sdk/-/sdk-0.4.0.tgz> and
<https://registry.npmjs.org/@crossmarkio/typings/-/typings-0.0.6.tgz>.

## XRPL transaction declarations

The rolled Crossmark declarations include reachable transaction types from `xrpl@2.14.1`
and `@transia/xrpl@2.7.3-alpha.28`. Their shared ISC license text is preserved in
`licenses/XRPL-ISC-LICENSE.txt`. Upstream sources are available at
<https://github.com/XRPLF/xrpl.js> and <https://github.com/Transia-RnD/xrpl.js>.
These declarations are bundled independently of the consumer's `xrpl` peer dependency.

## Forge cipher algorithm declaration

The cipher algorithm literal union is generated from `@types/node-forge@1.3.14`, distributed
under the MIT license. A copy is provided in `licenses/NODE-FORGE-TYPES-MIT-LICENSE.txt`.
The upstream source is available at <https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node-forge>.
No `node-forge` runtime is included by this declaration bundling step.
