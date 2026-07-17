import { useEffect, useRef, type CSSProperties } from 'react';
import { isWalletError } from 'xrpl-connect';
import { useXrplConnectContext } from './provider';
import type { WalletConnectorElement, WalletConnectorProps, WalletConnectorTheme } from './types';

/** Built-in theme presets, expressed as `--xc-*` custom properties. */
const THEMES: Record<WalletConnectorTheme, Record<string, string>> = {
  dark: {
    '--xc-background-color': '#1a202c',
    '--xc-background-secondary': '#2d3748',
    '--xc-text-color': '#F5F4E7',
    '--xc-primary-color': '#3b99fc',
  },
  light: {
    '--xc-background-color': '#ffffff',
    '--xc-background-secondary': '#f5f5f5',
    '--xc-text-color': '#111111',
    '--xc-primary-color': '#2563eb',
  },
  purple: {
    '--xc-background-color': '#1e1b4b',
    '--xc-background-secondary': '#2d2659',
    '--xc-text-color': '#f3e8ff',
    '--xc-primary-color': '#a78bfa',
  },
};

/**
 * React wrapper around the `<xrpl-wallet-connector>` web component. Binds the
 * provider's `WalletManager`, maps the component's events to typed props, and
 * applies theme / `--xc-*` overrides. Open it with `useWalletModal().open()`.
 *
 * The web component registers itself when `xrpl-connect` is imported; ensure your
 * app imports it once (e.g. at the entry point). (#33)
 */
export function WalletConnector({
  primaryWallet,
  wallets,
  theme,
  cssVars,
  style,
  className,
  onConnecting,
  onConnect,
  onError,
}: WalletConnectorProps) {
  const { manager, registerConnector, reportModalConnecting, reportModalError } =
    useXrplConnectContext();
  const elRef = useRef<WalletConnectorElement | null>(null);

  // Keep the latest callbacks in a ref so the binding effect can stay stable
  // (subscribe once) without going stale.
  const callbacksRef = useRef({ onConnecting, onConnect, onError });
  callbacksRef.current = { onConnecting, onConnect, onError };

  useEffect(() => {
    let active = true;
    let detach: (() => void) | undefined;

    void customElements.whenDefined('xrpl-wallet-connector').then(() => {
      const el = elRef.current;
      if (!active || !el || typeof el.setWalletManager !== 'function') return;

      el.setWalletManager(manager);
      registerConnector(el);

      const onWcConnecting = (e: Event) => {
        const walletId = (e as CustomEvent<{ walletId: string }>).detail?.walletId;
        if (walletId) {
          reportModalConnecting();
          callbacksRef.current.onConnecting?.(walletId);
        }
      };
      const onWcError = (e: Event) => {
        const error = (e as CustomEvent<{ error?: unknown }>).detail?.error;
        if (!isWalletError(error)) return;
        reportModalError(error);
        callbacksRef.current.onError?.(error);
      };
      // Source connect from the manager because it carries the authoritative account.
      const onMgrConnect = () => {
        if (manager.account) callbacksRef.current.onConnect?.(manager.account);
      };

      el.addEventListener('connecting', onWcConnecting);
      el.addEventListener('error', onWcError);
      manager.on('connect', onMgrConnect);

      detach = () => {
        el.removeEventListener('connecting', onWcConnecting);
        el.removeEventListener('error', onWcError);
        manager.off('connect', onMgrConnect);
      };
    });

    return () => {
      active = false;
      registerConnector(null);
      detach?.();
    };
  }, [manager, registerConnector, reportModalConnecting, reportModalError]);

  const mergedStyle = {
    ...(theme ? THEMES[theme] : {}),
    ...(cssVars ?? {}),
    ...(style ?? {}),
  } as CSSProperties;

  return (
    <xrpl-wallet-connector
      ref={elRef}
      primary-wallet={primaryWallet}
      wallets={wallets?.join(',')}
      class={className}
      style={mergedStyle}
    />
  );
}
