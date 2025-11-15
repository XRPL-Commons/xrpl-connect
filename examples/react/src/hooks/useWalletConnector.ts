import { useEffect, useRef } from 'react';
import type { WalletManager } from '@xrpl-connect/core';
import { useWallet } from '../context/WalletContext';

export function useWalletConnector(walletManager: WalletManager | null) {
  const walletConnectorRef = useRef<HTMLElement | null>(null);
  const { addEvent, showStatus } = useWallet();

  useEffect(() => {
    if (!walletConnectorRef.current || !walletManager) return;

    const setupConnector = async () => {
      // Wait for custom element to be defined and upgraded
      await customElements.whenDefined('xrpl-wallet-connector');

      // Small delay to ensure the element is fully initialized
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (
        walletConnectorRef.current &&
        typeof (walletConnectorRef.current as any).setWalletManager === 'function'
      ) {
        (walletConnectorRef.current as any).setWalletManager(walletManager);

        // Listen to connector events
        const handleConnecting = (e: any) => {
          showStatus(`Connecting to ${e.detail.walletId}...`, 'info');
        };

        const handleConnected = (e: any) => {
          showStatus('Connected successfully!', 'success');
          addEvent('Connected via Web Component', e.detail);
        };

        const handleError = (e: any) => {
          showStatus(`Connection failed: ${e.detail.error.message}`, 'error');
          addEvent('Connection Error', e.detail);
        };

        walletConnectorRef.current.addEventListener('connecting', handleConnecting);
        walletConnectorRef.current.addEventListener('connected', handleConnected);
        walletConnectorRef.current.addEventListener('error', handleError);

        return () => {
          if (walletConnectorRef.current) {
            walletConnectorRef.current.removeEventListener('connecting', handleConnecting);
            walletConnectorRef.current.removeEventListener('connected', handleConnected);
            walletConnectorRef.current.removeEventListener('error', handleError);
          }
        };
      }
    };

    setupConnector();
  }, [walletManager, addEvent, showStatus]);

  return walletConnectorRef;
}
