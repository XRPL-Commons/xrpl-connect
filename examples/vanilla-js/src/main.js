import './style.css';
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';
import { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';
import '@xrpl-connect/ui'; // Register the web component

// Configuration - ADD YOUR API KEYS HERE
const XAMAN_API_KEY = '15ba80a8-cba2-4789-a45b-c6a850d9d91b'; // Get from https://apps.xumm.dev/
const WALLETCONNECT_PROJECT_ID = '32798b46e13dfb0049706a524cf132d6'; // Get from https://cloud.walletconnect.com

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
  ],
  network: 'testnet',
  autoConnect: true,
  logger: { level: 'info' },
});

// Event listeners
walletManager.on('connect', (account) => {
  logEvent('Connected', account);
  updateUI();
});

walletManager.on('disconnect', () => {
  logEvent('Disconnected', null);
  updateUI();
});

walletManager.on('error', (error) => {
  logEvent('Error', error);
  showStatus(error.message, 'error');
});

// Initialize the wallet connector web component
const walletConnector = document.getElementById('wallet-connector');
walletConnector.setWalletManager(walletManager);

// Listen to connector events
walletConnector.addEventListener('connecting', (e) => {
  showStatus(`Connecting to ${e.detail.walletId}...`, 'info');
});

walletConnector.addEventListener('connected', (e) => {
  showStatus('Connected successfully!', 'success');
  logEvent('Connected via Web Component', e.detail);
});

walletConnector.addEventListener('error', (e) => {
  showStatus(`Connection failed: ${e.detail.error.message}`, 'error');
  logEvent('Connection Error', e.detail);
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

// Transaction Form (Sign & Submit)
elements.txForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const destination = document.getElementById('destination').value;
  const amount = document.getElementById('amount').value;

  try {
    elements.txResult.innerHTML =
      '<div class="loading">Signing and submitting transaction...</div>';

    const transaction = {
      TransactionType: 'Payment',
      Account: walletManager.account.address,
      Destination: destination,
      Amount: amount,
    };

    // Use the unified signAndSubmit method - works across all wallets!
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
    elements.txResult.innerHTML = `<div class="error">Failed: ${error.message}</div>`;
    logEvent('Transaction Failed', error);
  }
});

// Message Form
elements.msgForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const message = document.getElementById('message').value;

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

  if (isConnected) {
    const account = walletManager.account;
    const wallet = walletManager.wallet;

    // Hide connect section
    elements.connectSection.style.display = 'none';

    // Show account section
    elements.accountSection.style.display = 'block';
    elements.transactionSection.style.display = 'block';
    elements.messageSection.style.display = 'block';

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

    // Clear results
    elements.txResult.innerHTML = '';
    elements.msgResult.innerHTML = '';
  }
}

// Show status message
function showStatus(message, type = 'info') {
  elements.status.innerHTML = `<div class="status-${type}">${message}</div>`;
  setTimeout(() => {
    elements.status.innerHTML = '';
  }, 5000);
}

// Log events
function logEvent(event, data) {
  const timestamp = new Date().toLocaleTimeString();
  const eventDiv = document.createElement('div');
  eventDiv.className = 'event-item';
  eventDiv.innerHTML = `
    <span class="event-time">${timestamp}</span>
    <span class="event-name">${event}</span>
    <span class="event-data">${data ? JSON.stringify(data, null, 2) : ''}</span>
  `;
  elements.eventsLog.prepend(eventDiv);
}

// Initialize UI
updateUI();

// Check connection status message
if (!walletManager.connected) {
  showStatus('Please connect a wallet to get started', 'info');
} else {
  showStatus('Wallet reconnected from previous session', 'success');
}

console.log('XRPL Connect initialized', walletManager);
