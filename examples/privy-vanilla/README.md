# Privy with vanilla JavaScript

This example uses the normal XRPL Connect web component, an optional Privy adapter,
and no React runtime. It runs entirely in the browser.

1. Enable the login methods you want in the Privy dashboard.
2. Allow `http://localhost:5176` and the callback `http://localhost:5176/wallet/privy`.
3. Copy `.env.example` to `.env.local`, set your public app ID (and client ID when
   using a specific Privy client). Never put a Privy app secret in frontend
   configuration. Login choices are read from the dashboard when the chooser opens.
4. From the repository root, run `pnpm install`, `pnpm build`, then
   `pnpm --filter privy-vanilla-example dev`.
5. Open `http://localhost:5176`, choose **Sign in with socials**, select one of the
   enabled methods, and finish authentication. Toggle a method in the dashboard
   and reopen the chooser to check that the list updates.
   The callback resumes the connection after the embedded XRPL wallet is ready.
6. Use **Fund testnet wallet**, **Sign transaction**, and **Sign and submit** to
   verify signing and a validated XRPL testnet submission.

Reload to test restoration; log out and sign in again to verify the same wallet is
reused. Cancel a connection and retry to check recovery. Without `VITE_PRIVY_APP_ID`,
the example offers only the existing external-wallet adapters.

The local server serves the same app at `/wallet/privy`. Production deployments
must route that path to this app too. See the [Privy integration guide](../../packages/privy/README.md)
for session ownership, custom OAuth, Vue, and React usage.
