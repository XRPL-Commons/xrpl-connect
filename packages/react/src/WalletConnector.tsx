import { useEffect, useRef, type CSSProperties } from 'react';
import {
  createWalletError,
  getErrorMessage,
  isWalletError,
  type AccountInfo,
  type WalletError,
} from '@xrpl-connect/core';
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
  const {
    manager,
    registerConnector,
    unregisterConnector,
    reportModalConnecting,
    reportModalError,
  } = useXrplConnectContext();
  const elRef = useRef<WalletConnectorElement | null>(null);

  // Keep the latest callbacks in a ref so the binding effect can stay stable
  // (subscribe once) without going stale.
  const callbacksRef = useRef({ onConnecting, onConnect, onError });
  callbacksRef.current = { onConnecting, onConnect, onError };

  useEffect(() => {
    let active = true;
    let detach: (() => void) | undefined;
    let registeredElement: WalletConnectorElement | null = null;
    let notifiedAccountKey: string | null = null;

    const onMgrConnect = (account: AccountInfo) => {
      const accountKey = `${account.address}:${account.network.id}`;
      if (notifiedAccountKey === accountKey) return;
      notifiedAccountKey = accountKey;
      callbacksRef.current.onConnect?.(account);
    };
    const onMgrDisconnect = () => {
      notifiedAccountKey = null;
    };
    manager.on('connect', onMgrConnect);
    manager.on('disconnect', onMgrDisconnect);

    // Reconcile a connection that completed before this component's effect.
    if (manager.connected && manager.account) onMgrConnect(manager.account);

    void customElements.whenDefined('xrpl-wallet-connector').then(() => {
      const el = elRef.current;
      if (!active || !el || typeof el.setWalletManager !== 'function') return;

      el.setWalletManager(manager);
      registerConnector(el);
      registeredElement = el;

      const onWcConnecting = (e: Event) => {
        const walletId = (e as CustomEvent<{ walletId: string }>).detail?.walletId;
        if (walletId) {
          reportModalConnecting();
          callbacksRef.current.onConnecting?.(walletId);
        }
      };
      const onWcError = (e: Event) => {
        const detail = (
          e as CustomEvent<{
            error?: unknown;
            errorType?: 'rejected' | 'unavailable' | 'failed';
            walletId?: string;
          }>
        ).detail;
        const error = normalizeModalError(detail?.error, detail?.errorType, detail?.walletId);
        reportModalError(error);
        callbacksRef.current.onError?.(error);
      };

      el.addEventListener('connecting', onWcConnecting);
      el.addEventListener('error', onWcError);

      detach = () => {
        el.removeEventListener('connecting', onWcConnecting);
        el.removeEventListener('error', onWcError);
      };
    });

    return () => {
      active = false;
      manager.off('connect', onMgrConnect);
      manager.off('disconnect', onMgrDisconnect);
      if (registeredElement) unregisterConnector(registeredElement);
      detach?.();
    };
  }, [manager, registerConnector, unregisterConnector, reportModalConnecting, reportModalError]);

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

function normalizeModalError(
  error: unknown,
  errorType?: 'rejected' | 'unavailable' | 'failed',
  walletId?: string
): WalletError {
  if (isWalletError(error)) return error;

  const walletName = walletId || 'wallet';
  const originalError = error instanceof Error ? error : new Error(getErrorMessage(error));
  if (errorType === 'rejected') return createWalletError.connectionRejected(walletName);
  if (errorType === 'unavailable') {
    return originalError.message.toLowerCase().includes('not installed')
      ? createWalletError.notInstalled(walletName)
      : createWalletError.notAvailable(walletName);
  }
  return createWalletError.connectionFailed(walletName, originalError);
}
