import './style.css';
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';
import { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';

// Configuration - ADD YOUR API KEYS HERE
const XAMAN_API_KEY = '15ba80a8-cba2-4789-a45b-c6a850d9d91b'; // Get from https://apps.xumm.dev/
const WALLETCONNECT_PROJECT_ID = '32798b46e13dfb0049706a524cf132d6'; // Get from https://cloud.walletconnect.com

// Initialize Wallet Manager
const walletManager = new WalletManager({
  adapters: [
    new XamanAdapter({ apiKey: XAMAN_API_KEY }),
    new WalletConnectAdapter({ projectId: WALLETCONNECT_PROJECT_ID }),
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

// DOM Elements
const elements = {
  connectXaman: document.getElementById('connect-xaman'),
  connectWalletConnect: document.getElementById('connect-walletconnect'),
  connectCrossmark: document.getElementById('connect-crossmark'),
  connectGemWallet: document.getElementById('connect-gemwallet'),
  disconnect: document.getElementById('disconnect'),
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
};

// Connect to Xaman
elements.connectXaman.addEventListener('click', async () => {
  try {
    showStatus('Connecting to Xaman...', 'info');
    await walletManager.connect('xaman', {
      apiKey: XAMAN_API_KEY,
    });
    showStatus('Connected successfully!', 'success');
  } catch (error) {
    showStatus(`Connection failed: ${error.message}`, 'error');
  }
});

// Connect to WalletConnect
elements.connectWalletConnect.addEventListener('click', async () => {
  try {
    showStatus('Opening WalletConnect modal...', 'info');
    await walletManager.connect('walletconnect', {
      projectId: WALLETCONNECT_PROJECT_ID,
    });
    showStatus('Connected successfully!', 'success');
  } catch (error) {
    showStatus(`Connection failed: ${error.message}`, 'error');
  }
});

// Connect to Crossmark
elements.connectCrossmark.addEventListener('click', async () => {
  try {
    showStatus('Connecting to Crossmark...', 'info');
    await walletManager.connect('crossmark');
    showStatus('Connected successfully!', 'success');
  } catch (error) {
    showStatus(`Connection failed: ${error.message}`, 'error');
  }
});

// Connect to GemWallet
elements.connectGemWallet.addEventListener('click', async () => {
  try {
    showStatus('Connecting to GemWallet...', 'info');
    await walletManager.connect('gemwallet');
    showStatus('Connected successfully!', 'success');
  } catch (error) {
    showStatus(`Connection failed: ${error.message}`, 'error');
  }
});

// Disconnect
elements.disconnect.addEventListener('click', async () => {
  try {
    await walletManager.disconnect();
    showStatus('Disconnected', 'info');
  } catch (error) {
    showStatus(`Disconnect failed: ${error.message}`, 'error');
  }
});

// Transaction Form (Sign & Submit)
elements.txForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const destination = document.getElementById('destination').value;
  const amount = document.getElementById('amount').value;

  try {
    elements.txResult.innerHTML = '<div class="loading">Signing and submitting transaction...</div>';

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
        <p class="info">✅ Transaction has been signed and submitted to the ledger</p>
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
