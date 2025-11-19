import { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { useWalletConnector } from '../hooks/useWalletConnector';
import type { Theme, ThemeColors } from '../types';

const THEMES: Record<Theme, ThemeColors> = {
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

export function WalletConnector() {
  const { walletManager } = useWallet();
  const walletConnectorRef = useWalletConnector(walletManager);
  const [currentTheme] = useState<Theme>('dark');

  return (
    <xrpl-wallet-connector
      ref={walletConnectorRef}
      id="wallet-connector"
      style={
        {
          ...THEMES[currentTheme],
          '--xc-font-family': 'inherit',
          '--xc-border-radius': '12px',
          '--xc-modal-box-shadow': '0 10px 40px rgba(0, 0, 0, 0.3)',
        } as any
      }
      primary-wallet="xaman"
    />
  );
}
