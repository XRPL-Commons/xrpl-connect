import { useEffect } from 'react';
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';
import { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';
import { useWallet } from '../context/WalletContext';

// Configuration - ADD YOUR API KEYS HERE
const XAMAN_API_KEY = '15ba80a8-cba2-4789-a45b-c6a850d9d91b';
const WALLETCONNECT_PROJECT_ID = '32798b46e13dfb0049706a524cf132d6';

export function useWalletManager() {
  const {
    walletManager,
    setWalletManager,
    setIsConnected,
    setAccountInfo,
    addEvent,
    showStatus,
  } = useWallet();

  useEffect(() => {
    const manager = new WalletManager({
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

    setWalletManager(manager);

    // Event listeners
    manager.on('connect', (account) => {
      addEvent('Connected', account);
      updateConnectionState(manager);
    });

    manager.on('disconnect', () => {
      addEvent('Disconnected', null);
      updateConnectionState(manager);
    });

    manager.on('error', (error) => {
      addEvent('Error', error);
      showStatus(error.message, 'error');
    });

    // Check initial connection status
    if (!manager.connected) {
      showStatus('Please connect a wallet to get started', 'info');
    } else {
      showStatus('Wallet reconnected from previous session', 'success');
      updateConnectionState(manager);
    }

    console.log('XRPL Connect initialized', manager);
  }, []);

  const updateConnectionState = (manager: WalletManager) => {
    const connected = manager.connected;
    setIsConnected(connected);

    if (connected) {
      const account = manager.account;
      const wallet = manager.wallet;

      if (account && wallet) {
        setAccountInfo({
          address: account.address,
          network: `${account.network.name} (${account.network.id})`,
          walletName: wallet.name,
        });
      }
    } else {
      setAccountInfo(null);
    }
  };

  return { walletManager };
}
