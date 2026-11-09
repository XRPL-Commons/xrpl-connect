# Social login with Privy

XRPL Connect can display social login alongside existing wallet choices. The
optional `@xrpl-commons/xrpl-connect-privy` package authenticates users and creates
or restores their user-owned embedded XRPL wallet. A successful login becomes a
wallet connection only when the real XRPL account and signer are ready.

The integration uses Privy's vanilla JavaScript SDK. Core and the web component
do not load React. No application backend or Privy app secret is needed for the
built-in OAuth flow. Applications using custom JWT authentication supply their
own existing authentication service.

Configure only the social methods you want to offer. The integration does not
render Privy's “connect wallet” or “use your own wallet” options. External wallets
continue to connect through the other XRPL Connect adapters.

When at least one configured method is available, the wallet picker shows a single
`Sign in with socials` entry. Selecting it opens the configured provider choices;
only descriptors whose adapter is registered, configured, and available are shown.
Use the chooser's back button to return to the normal wallet list.

```js
import { WalletManager, CrossmarkAdapter } from 'xrpl-connect';
import { PrivyAdapter } from '@xrpl-commons/xrpl-connect-privy';

const manager = new WalletManager({
  adapters: [
    new CrossmarkAdapter(),
    new PrivyAdapter({
      appId: 'YOUR_PUBLIC_APP_ID',
      redirectUri: `${window.location.origin}/wallet/privy`,
      loginMethods: [{ id: 'google', oauthProvider: 'google' }],
    }),
  ],
  network: 'testnet',
  autoConnect: false,
});
const connector = document.querySelector('xrpl-wallet-connector');
connector.setWalletManager(manager);
connector.socialLogins = [
  {
    id: 'google',
    label: 'Continue with Google',
    adapterId: 'privy',
    connectOptions: { loginMethod: 'google' },
  },
];
await manager.reconnect();
```

Enable Google in the Privy dashboard and allow your application origin and
callback URL. Serve the same application at `/wallet/privy`. Add the public client
ID if your Privy app uses a specific client. Never expose an app secret.

`socialLogins` is a JavaScript property, not an HTML attribute. The React wrapper
accepts `socialLogins={entries}`, and Vue accepts `:social-logins="entries"`.
Descriptors can select any registered adapter, so custom OAuth backends can use
the same UI and manager lifecycle. When social login is not configured, the
existing wallet list behaves as before. Provider labels are used only in the
chooser; connection options stay internal to the component and are passed to the
selected adapter for retries.

After connection, use `manager.sign()` or `manager.signAndSubmit()` with normal
XRPL transactions. Fund a new account before submission. The Privy adapter
supports transaction signing and validated submission; multisigning and arbitrary
message signing are not supported. `manager.disconnect()` logs the user out of
the adapter-owned Privy session.

See the [complete configuration, lifecycle, custom authentication, and framework examples](https://github.com/XRPL-Commons/xrpl-connect/tree/develop/packages/privy)
and the [runnable vanilla testnet example](https://github.com/XRPL-Commons/xrpl-connect/tree/develop/examples/privy-vanilla).
