import './polyfills.js';
import './style.css';
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';
import { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';
import { LedgerAdapter } from '@xrpl-connect/adapter-ledger';
import { XyraAdapter } from '@xrpl-connect/adapter-xyra';
import { GhostsigAdapter } from '@xrpl-connect/adapter-ghostsig';
import { OtsuAdapter } from '@xrpl-connect/adapter-otsu';
import { MetaMaskSnapAdapter } from '@xrpl-connect/adapter-metamask-snap';
import { PrivyAdapter } from '@xrpl-commons/xrpl-connect-privy';

import { WalletConnectorElement } from '@xrpl-connect/ui';
import '@xrpl-connect/ui'; // Register the web component

// Configuration - ADD YOUR API KEYS HERE
const XAMAN_API_KEY = '15ba80a8-cba2-4789-a45b-c6a850d9d91b'; // Get from https://apps.xumm.dev/
const WALLETCONNECT_PROJECT_ID = '32798b46e13dfb0049706a524cf132d6'; // Get from https://cloud.walletconnect.com
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID?.trim();
const PRIVY_CLIENT_ID = import.meta.env.VITE_PRIVY_CLIENT_ID?.trim();
const PRIVY_REDIRECT_URI =
  import.meta.env.VITE_PRIVY_REDIRECT_URI?.trim() || `${window.location.origin}/wallet/privy`;

const privyAdapter = PRIVY_APP_ID
  ? new PrivyAdapter({
      appId: PRIVY_APP_ID,
      clientId: PRIVY_CLIENT_ID || undefined,
      redirectUri: PRIVY_REDIRECT_URI,
    })
  : undefined;

// Initialize Wallet Manager
const walletManager = new WalletManager({
  adapters: [
    new XamanAdapter({ apiKey: XAMAN_API_KEY }),
    // WalletConnect with modal enabled for mobile deeplinks
    new WalletConnectAdapter({
      projectId: WALLETCONNECT_PROJECT_ID,
      // Enable modal for mobile devices (automatic deeplinks)
      useModal: true,
      modalMode: 'mobile-only', // 'mobile-only' | 'always' | 'never'
      themeMode: 'dark', // 'dark' | 'light'
      metadata: {
        name: 'XRPL Connect Demo',
        description: 'Framework-agnostic wallet connection toolkit',
        url: window.location.origin,
        icons: ['https://xrpl.org/favicon.ico'],
      },
    }),
    new CrossmarkAdapter(),
    new GemWalletAdapter(),
    new LedgerAdapter(),
    new XyraAdapter(),
    new GhostsigAdapter(),
    new OtsuAdapter(),
    new MetaMaskSnapAdapter(),
    ...(privyAdapter ? [privyAdapter] : []),
  ],
  network: 'testnet',
  // Install the connector and listeners before handling a saved session or
  // the return from a Privy OAuth redirect below.
  autoConnect: false,
  logger: { level: 'info' },
});

let restoring = true;
let reconnectCancelled = false;
let actionBusy = false;
const completingPrivyLogin = privyAdapter?.hasPendingConnection() ?? false;

// Event listeners
walletManager.on('connect', (account) => {
  logEvent('Connected', account);
  showStatus(
    restoring
      ? completingPrivyLogin
        ? 'Privy sign-in completed and wallet restored.'
        : 'Wallet reconnected from a previous session.'
      : 'Connected successfully!',
    'success'
  );
  updateUI();
});

walletManager.on('disconnect', () => {
  logEvent('Disconnected', null);
  showStatus('Wallet disconnected.', 'info');
  updateUI();
});

walletManager.on('accountChanged', (account) => {
  logEvent('Account Changed', account);
  updateUI();
});

walletManager.on('networkChanged', (network) => {
  logEvent('Network Changed', network);
  updateUI();
});

walletManager.on('error', (error) => {
  logEvent('Error', error);
  showStatus(error.message, 'error');
  updateUI();
});

// Initialize the wallet connector web component
const walletConnector = document.getElementById('wallet-connector');
walletConnector.setWalletManager(walletManager);

// Listen to connector events
walletConnector.addEventListener('connecting', (e) => {
  showStatus(`Connecting to ${e.detail.walletId}...`, 'info');
});

walletConnector.addEventListener('connected', (e) => {
  logEvent('Connected via Web Component', e.detail);
});

walletConnector.addEventListener('error', (e) => {
  showStatus(`Connection failed: ${e.detail.error.message}`, 'error');
  logEvent('Connection Error', e.detail);
});

walletConnector.addEventListener('close', (e) => {
  if (e.detail?.connectionAttemptId) {
    showStatus('Connection canceled. You can retry from Connect Wallet.', 'info');
    logEvent('Connection Canceled', e.detail);
  }
});

// Listen for Xaman transaction completion (mobile return flow)
walletConnector.addEventListener('xaman-transaction-complete', (e) => {
  const { signed, txid } = e.detail;
  if (signed) {
    showStatus(`Transaction signed successfully! TX: ${txid}`, 'success');
    logEvent('Xaman Transaction Signed (Mobile Return)', e.detail);
  } else {
    showStatus('Transaction rejected by user', 'error');
    logEvent('Xaman Transaction Rejected (Mobile Return)', e.detail);
  }
});

// DOM Elements
const elements = {
  status: document.getElementById('status'),
  connectSection: document.getElementById('connect-section'),
  accountSection: document.getElementById('account-section'),
  transactionSection: document.getElementById('transaction-section'),
  messageSection: document.getElementById('message-section'),
  address: document.getElementById('address'),
  network: document.getElementById('network'),
  walletName: document.getElementById('wallet-name'),
  txForm: document.getElementById('tx-form'),
  msgForm: document.getElementById('msg-form'),
  txResult: document.getElementById('tx-result'),
  msgResult: document.getElementById('msg-result'),
  fundTestnet: document.getElementById('fund-testnet'),
  signTestTransaction: document.getElementById('sign-test-transaction'),
  cancelReconnect: document.getElementById('cancel-reconnect'),
  eventsLog: document.getElementById('events-log'),
  clearLog: document.getElementById('clear-log'),
  currentTheme: document.getElementById('current-theme'),
  themeButtons: document.querySelectorAll('.theme-btn'),
};

// Note: Connection and disconnection are now handled by the web component button!
// - Click "Connect Wallet" to open the wallet selection modal
// - Click the button showing your address to view account details modal

// Theme switching functionality
// Shows how to dynamically change component styling via CSS variables
const themes = {
  dark: {
    '--xc-background-color': '#1a202c',
    '--xc-background-secondary': '#2d3748',
    '--xc-background-tertiary': '#4a5568',
    '--xc-text-color': '#F5F4E7',
    '--xc-text-muted-color': 'rgba(245, 244, 231, 0.6)',
    '--xc-primary-color': '#3b99fc',
  },
  light: {
    '--xc-background-color': '#ffffff',
    '--xc-background-secondary': '#f5f5f5',
    '--xc-background-tertiary': '#eeeeee',
    '--xc-text-color': '#111111',
    '--xc-text-muted-color': 'rgba(17, 17, 17, 0.6)',
    '--xc-primary-color': '#2563eb',
  },
  purple: {
    '--xc-background-color': '#1e1b4b',
    '--xc-background-secondary': '#2d2659',
    '--xc-background-tertiary': '#3d3261',
    '--xc-text-color': '#f3e8ff',
    '--xc-text-muted-color': 'rgba(243, 232, 255, 0.6)',
    '--xc-primary-color': '#a78bfa',
  },
};

// Map theme names to display names
const themeDisplayNames = {
  dark: 'Dark',
  light: 'Light',
  purple: 'Purple',
};

// Function to apply theme
function applyTheme(themeName) {
  const theme = themes[themeName];
  if (!theme) return;

  // Apply CSS variables to wallet connector component
  Object.entries(theme).forEach(([key, value]) => {
    walletConnector.style.setProperty(key, value);
  });

  // Update button states
  elements.themeButtons.forEach((btn) => {
    if (btn.dataset.theme === themeName) {
      btn.classList.add('theme-btn-active');
    } else {
      btn.classList.remove('theme-btn-active');
    }
  });

  // Update current theme display
  elements.currentTheme.textContent = themeDisplayNames[themeName] || themeName;

  logEvent('Theme Applied', { theme: themeName });
}

// Add event listeners to theme buttons
elements.themeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const themeName = btn.dataset.theme;
    applyTheme(themeName);
  });
});

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function setTransactionResultMessage(message, type = 'error') {
  const result = document.createElement('div');
  result.className = type;
  result.textContent = message;
  elements.txResult.replaceChildren(result);
}

function setTransactionLoading(message) {
  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.textContent = message;
  elements.txResult.replaceChildren(loading);
}

function appendResultValue(container, label, value, code = false) {
  const paragraph = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = `${label}:`;
  paragraph.append(strong, ' ');
  if (code) {
    const codeElement = document.createElement('code');
    codeElement.textContent = value;
    paragraph.append(codeElement);
  } else {
    paragraph.append(document.createTextNode(value));
  }
  container.append(paragraph);
}

async function runWalletAction(action, loadingMessage) {
  if (actionBusy) return;

  actionBusy = true;
  setTransactionLoading(loadingMessage);
  updateUI();
  try {
    return await action();
  } catch (error) {
    setTransactionResultMessage(`Failed: ${errorMessage(error)}`);
    logEvent('Wallet Action Failed', error);
    return undefined;
  } finally {
    actionBusy = false;
    updateUI();
  }
}

// Privy accounts are created on the XRPL testnet without a balance. Funding is
// always explicit so the demo never submits a transaction during login.
elements.fundTestnet.addEventListener('click', () =>
  runWalletAction(async () => {
    const account = walletManager.account;
    if (!account) throw new Error('Connect a wallet before requesting testnet funds.');
    if (account.network.id !== 'testnet') {
      throw new Error('Testnet funding is only available while connected to the XRPL testnet.');
    }
    const response = await fetch('https://faucet.altnet.rippletest.net/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: account.address }),
    });
    if (!response.ok) throw new Error(`Testnet faucet failed (${response.status})`);
    const faucetResult = await response.json();
    const result = document.createElement('div');
    result.className = 'success';
    const heading = document.createElement('h3');
    heading.textContent = 'Testnet funds requested';
    result.append(heading);
    appendResultValue(result, 'Address', account.address);
    const note = document.createElement('p');
    note.textContent = 'Wait for the faucet payment to confirm, then sign or submit a transaction.';
    result.append(note);
    elements.txResult.replaceChildren(result);
    logEvent('Testnet Account Funded', { address: account.address, result: faucetResult });
    return faucetResult;
  }, 'Requesting testnet funds...')
);

elements.signTestTransaction.addEventListener('click', () =>
  runWalletAction(async () => {
    const account = walletManager.account;
    if (!account) throw new Error('Connect a wallet before signing a transaction.');
    if (!walletManager.supports('sign')) {
      throw new Error('The connected wallet does not support transaction signing.');
    }
    const signed = await walletManager.sign({
      TransactionType: 'AccountSet',
      Account: account.address,
    });
    const result = document.createElement('div');
    result.className = 'success';
    const heading = document.createElement('h3');
    heading.textContent = 'Transaction Signed';
    result.append(heading);
    appendResultValue(result, 'Hash', signed.hash || 'Available in the signed blob');
    appendResultValue(result, 'Blob', `${signed.tx_blob?.substring(0, 50) || 'N/A'}...`, true);
    const note = document.createElement('p');
    note.textContent = 'This action only signs the transaction; it does not submit it.';
    result.append(note);
    elements.txResult.replaceChildren(result);
    logEvent('Transaction Signed', signed);
    return signed;
  }, 'Signing transaction (nothing will be submitted)...')
);

// Transaction Form (Sign & Submit)
elements.txForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (actionBusy) return;

  const destination = document.getElementById('destination').value;
  const amount = document.getElementById('amount').value;

  actionBusy = true;
  try {
    const account = walletManager.account;
    if (!account) throw new Error('Connect a wallet before submitting a transaction.');
    if (!walletManager.supports('signAndSubmit')) {
      throw new Error('The connected wallet does not support transaction submission.');
    }
    setTransactionLoading('Signing and submitting transaction...');
    updateUI();

    const transaction = {
      TransactionType: 'Payment',
      Account: account.address,
      Destination: destination,
      Amount: amount,
    };

    // Use signAndSubmit to sign and submit - works across all wallets!
    const result = await walletManager.signAndSubmit(transaction);

    elements.txResult.innerHTML = `
      <div class="success">
        <h3>Transaction Submitted!</h3>
        <p><strong>Hash:</strong> ${result.hash || 'Pending'}</p>
        ${result.id ? `<p><strong>ID:</strong> ${result.id}</p>` : ''}
        ${result.tx_blob ? `<p><strong>Blob:</strong> <code>${result.tx_blob.substring(0, 50)}...</code></p>` : ''}
        <p class="info"> Transaction has been signed and submitted to the ledger</p>
      </div>
    `;

    logEvent('Transaction Submitted', result);
  } catch (error) {
    setTransactionResultMessage(`Failed: ${errorMessage(error)}`);
    logEvent('Transaction Failed', error);
  } finally {
    actionBusy = false;
    updateUI();
  }
});

// Message Form
elements.msgForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const message = document.getElementById('message').value;

  if (!walletManager.supports('signMessage')) {
    elements.msgResult.innerHTML =
      '<div class="error">The connected wallet does not support message signing.</div>';
    return;
  }

  try {
    elements.msgResult.innerHTML = '<div class="loading">Signing message...</div>';

    const signed = await walletManager.signMessage(message);

    elements.msgResult.innerHTML = `
      <div class="success">
        <h3>Message Signed!</h3>
        <p><strong>Message:</strong> ${signed.message}</p>
        <p><strong>Signature:</strong> <code>${signed.signature ? signed.signature.substring(0, 50) + '...' : 'N/A'}</code></p>
      </div>
    `;

    logEvent('Message Signed', signed);
  } catch (error) {
    elements.msgResult.innerHTML = `<div class="error">Failed: ${error.message}</div>`;
    logEvent('Message Sign Failed', error);
  }
});

// Clear Log
elements.clearLog.addEventListener('click', () => {
  elements.eventsLog.innerHTML = '';
});

// Update UI based on connection state
function updateUI() {
  const isConnected = walletManager.connected;

  elements.cancelReconnect.hidden = !restoring || !completingPrivyLogin;
  elements.cancelReconnect.disabled = actionBusy || reconnectCancelled;

  if (isConnected) {
    const account = walletManager.account;
    const wallet = walletManager.wallet;
    const canSign = walletManager.supports('sign');
    const canSignAndSubmit = walletManager.supports('signAndSubmit');
    const isTestnet = account.network.id === 'testnet';

    // Hide connect section
    elements.connectSection.style.display = 'none';

    // Show account section
    elements.accountSection.style.display = 'block';
    elements.transactionSection.style.display = 'block';
    elements.fundTestnet.disabled = restoring || actionBusy || !isTestnet;
    elements.signTestTransaction.disabled = restoring || actionBusy || !canSign;
    elements.txForm.querySelector('button[type="submit"]').disabled =
      restoring || actionBusy || !canSignAndSubmit;
    const canSignMessage = walletManager.supports('signMessage');
    elements.messageSection.style.display = canSignMessage ? 'block' : 'none';
    if (!canSignMessage) elements.msgResult.innerHTML = '';

    // Update account info
    elements.address.textContent = account.address;
    elements.network.textContent = `${account.network.name} (${account.network.id})`;
    elements.walletName.textContent = wallet.name;
  } else {
    // Show connect section
    elements.connectSection.style.display = 'block';

    // Hide account section
    elements.accountSection.style.display = 'none';
    elements.transactionSection.style.display = 'none';
    elements.messageSection.style.display = 'none';
    elements.fundTestnet.disabled = true;
    elements.signTestTransaction.disabled = true;
    elements.txForm.querySelector('button[type="submit"]').disabled = true;

    // Clear results
    elements.txResult.innerHTML = '';
    elements.msgResult.innerHTML = '';
  }
}

// Show status message
let statusTimer;
function showStatus(message, type = 'info', persist = false) {
  if (statusTimer) clearTimeout(statusTimer);
  const status = document.createElement('div');
  status.className = `status-${type}`;
  status.textContent = message;
  elements.status.replaceChildren(status);
  if (!persist) {
    statusTimer = setTimeout(() => {
      elements.status.replaceChildren();
      statusTimer = undefined;
    }, 5000);
  }
}

// Log events
function logEvent(event, data) {
  const timestamp = new Date().toLocaleTimeString();
  const eventDiv = document.createElement('div');
  eventDiv.className = 'event-item';
  const eventTime = document.createElement('span');
  eventTime.className = 'event-time';
  eventTime.textContent = timestamp;
  const eventName = document.createElement('span');
  eventName.className = 'event-name';
  eventName.textContent = event;
  const eventData = document.createElement('span');
  eventData.className = 'event-data';
  eventData.textContent = data ? JSON.stringify(data, null, 2) : '';
  eventDiv.append(eventTime, eventName, eventData);
  elements.eventsLog.prepend(eventDiv);
}

elements.cancelReconnect.addEventListener('click', async () => {
  if (!restoring || !completingPrivyLogin || reconnectCancelled) return;

  reconnectCancelled = true;
  showStatus('Canceling Privy sign-in…', 'info', true);
  elements.cancelReconnect.disabled = true;
  try {
    await walletManager.disconnect();
  } catch (error) {
    logEvent('Privy Sign-in Cancel Failed', error);
    showStatus(`Could not cancel sign-in: ${error.message}`, 'error', true);
  }
});

// Install the UI and all listeners before explicitly restoring a saved wallet
// or completing a Privy OAuth return. This is intentionally not autoConnect.
updateUI();
showStatus(
  completingPrivyLogin
    ? 'Completing Privy sign-in and restoring your wallet…'
    : 'Restoring a previous wallet connection…',
  'info',
  true
);

try {
  const restoredAccount = await walletManager.reconnect();
  if (!restoredAccount && !reconnectCancelled) {
    showStatus(
      completingPrivyLogin
        ? 'Privy sign-in could not be completed. Check the callback configuration and retry.'
        : 'Please connect a wallet to get started.',
      completingPrivyLogin ? 'error' : 'info',
      true
    );
  }
} catch (error) {
  logEvent('Reconnect Failed', error);
  showStatus(`Wallet restoration failed: ${error.message}`, 'error', true);
} finally {
  restoring = false;
  updateUI();
}

console.log('XRPL Connect initialized', walletManager);
