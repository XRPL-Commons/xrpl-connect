import { useState, useRef, useEffect } from 'react';
import type { WalletConnectorElement } from '@xrpl-connect/ui';
import type { Theme, ThemeColors } from '../types';
import { useWallet } from '../context/WalletContext';

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

const THEME_LABELS: Record<Theme, string> = {
  dark: '🌙 Dark Theme',
  light: '☀️ Light Theme',
  purple: '🟣 Purple Theme',
};

export function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState<Theme>('dark');
  const { addEvent } = useWallet();
  const walletConnectorRef = useRef<WalletConnectorElement | null>(null);

  // Get reference to the wallet connector element
  useEffect(() => {
    walletConnectorRef.current = document.getElementById(
      'wallet-connector'
    ) as WalletConnectorElement | null;
  }, []);

  const handleThemeChange = (theme: Theme) => {
    setCurrentTheme(theme);

    const selectedTheme = THEMES[theme];
    const walletConnector = walletConnectorRef.current;

    if (walletConnector && selectedTheme) {
      Object.entries(selectedTheme).forEach(([key, value]) => {
        walletConnector.style.setProperty(key, value);
      });
    }

    addEvent('Theme Applied', { theme });
  };

  return (
    <section id="theme-section">
      <h2>Component Theming</h2>
      <p className="section-description">
        Customize the wallet connector component theme in real-time
      </p>
      <div className="theme-buttons">
        {(Object.keys(THEMES) as Theme[]).map((theme) => (
          <button
            key={theme}
            className={`theme-btn ${currentTheme === theme ? 'theme-btn-active' : ''}`}
            onClick={() => handleThemeChange(theme)}
          >
            {THEME_LABELS[theme]}
          </button>
        ))}
      </div>
      <div className="theme-info">
        <p>
          <strong>Current Theme:</strong>{' '}
          <span id="current-theme">
            {currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1)}
          </span>
        </p>
        <p className="theme-description">
          CSS variables are applied dynamically to the{' '}
          <code>&lt;xrpl-wallet-connector&gt;</code> component. Try switching themes while
          the modal is open!
        </p>
      </div>
    </section>
  );
}
