import React from 'react';
import ReactDOM from 'react-dom/client';
import 'xrpl-connect'; // Register the <xrpl-wallet-connector> web component
import {
  XamanAdapter,
  WalletConnectAdapter,
  CrossmarkAdapter,
  GemWalletAdapter,
  XyraAdapter,
  OtsuAdapter,
} from 'xrpl-connect';
import { XrplConnectProvider, type XrplConnectConfig } from '@xrpl-connect/react';
import App from './App';
import { DemoProvider } from './context/DemoContext';
import './index.css';

// Configuration - ADD YOUR API KEYS HERE
const XAMAN_API_KEY = '15ba80a8-cba2-4789-a45b-c6a850d9d91b';
const WALLETCONNECT_PROJECT_ID = '32798b46e13dfb0049706a524cf132d6';

// Defined once, here — the provider builds a single WalletManager from it.
const config: XrplConnectConfig = {
  adapters: [
    new XamanAdapter({ apiKey: XAMAN_API_KEY }),
    new WalletConnectAdapter({ projectId: WALLETCONNECT_PROJECT_ID }),
    new CrossmarkAdapter(),
    new GemWalletAdapter(),
    new XyraAdapter(),
    new OtsuAdapter(),
  ],
  network: 'testnet',
  autoConnect: true,
  logger: { level: 'info' },
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <XrplConnectProvider config={config}>
      <DemoProvider>
        <App />
      </DemoProvider>
    </XrplConnectProvider>
  </React.StrictMode>
);
