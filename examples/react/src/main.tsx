import './polyfills';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import {
  XamanAdapter,
  WalletConnectAdapter,
  CrossmarkAdapter,
  GemWalletAdapter,
  XyraAdapter,
  OtsuAdapter,
  MetaMaskSnapAdapter,
} from 'xrpl-connect';
import { PrivyAdapter } from '@xrpl-commons/xrpl-connect-privy';
import { XrplConnectProvider, type XrplConnectConfig } from '@xrpl-commons/xrpl-connect-react';
import App from './App';
import { DemoProvider } from './context/DemoContext';
import './index.css';

// Configuration - ADD YOUR API KEYS HERE
const XAMAN_API_KEY = '15ba80a8-cba2-4789-a45b-c6a850d9d91b';
const WALLETCONNECT_PROJECT_ID = '32798b46e13dfb0049706a524cf132d6';
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID?.trim();
const PRIVY_REDIRECT_URI =
  import.meta.env.VITE_PRIVY_REDIRECT_URI?.trim() || `${window.location.origin}/wallet/privy`;

// Privy is optional so the existing external-wallet demo remains unchanged when
// no public app ID is configured. The adapter discovers login methods from the
// Privy dashboard; the React modal does not need a duplicated provider list.
const privy = PRIVY_APP_ID
  ? new PrivyAdapter({
      appId: PRIVY_APP_ID,
      clientId: import.meta.env.VITE_PRIVY_CLIENT_ID?.trim() || undefined,
      redirectUri: PRIVY_REDIRECT_URI,
    })
  : undefined;

// Defined once, here — the provider builds a single WalletManager from it.
const config: XrplConnectConfig = {
  adapters: [
    new XamanAdapter({ apiKey: XAMAN_API_KEY }),
    new WalletConnectAdapter({ projectId: WALLETCONNECT_PROJECT_ID }),
    new CrossmarkAdapter(),
    new GemWalletAdapter(),
    new XyraAdapter(),
    new OtsuAdapter(),
    new MetaMaskSnapAdapter(),
    ...(privy ? [privy] : []),
  ],
  network: 'testnet',
  autoConnect: true,
  logger: { level: 'info' },
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <XrplConnectProvider config={config}>
      <DemoProvider>
        <App privyRedirectUri={PRIVY_REDIRECT_URI} />
      </DemoProvider>
    </XrplConnectProvider>
  </StrictMode>
);
