import { WalletConnector as XrplWalletConnector } from '@xrpl-connect/react';
import { useDemo } from '../context/DemoContext';

export function WalletConnector() {
  const { addEvent, showStatus } = useDemo();

  return (
    <XrplWalletConnector
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
