import { useEffect, useRef } from 'react';
import {
  WalletConnector as XrplWalletConnector,
  type WalletConnectorElement,
} from '@xrpl-commons/xrpl-connect-react';
import { useDemo } from '../context/DemoContext';

export function WalletConnector() {
  const { addEvent, showStatus } = useDemo();
  const connectorRef = useRef<WalletConnectorElement | null>(null);

  useEffect(() => {
    const connector = connectorRef.current;
    if (!connector) return;

    const onCancelled = () => {
      showStatus('Connection cancelled. Choose a wallet to retry.', 'info');
      addEvent('Connection Cancelled', { source: 'wallet connector' });
    };
    connector.addEventListener('cancelled', onCancelled);
    return () => connector.removeEventListener('cancelled', onCancelled);
  }, [addEvent, showStatus]);

  return (
    <XrplWalletConnector
      ref={connectorRef}
      primaryWallet="xaman"
      theme="dark"
      cssVars={{
        '--xc-font-family': 'inherit',
        '--xc-border-radius': '12px',
        '--xc-modal-box-shadow': '0 10px 40px rgba(0, 0, 0, 0.3)',
      }}
      onConnecting={(walletId) => showStatus(`Connecting to ${walletId}...`, 'info')}
      onConnect={(account) => {
        showStatus('Connected successfully!', 'success');
        addEvent('Connected', account);
      }}
      onError={(error) => {
        showStatus(`Connection failed: ${error.message}`, 'error');
        addEvent('Connection Error', { code: error.code, message: error.message });
      }}
    />
  );
}
