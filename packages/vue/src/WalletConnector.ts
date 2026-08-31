import { defineComponent, h, onBeforeUnmount, onMounted, ref, type PropType } from 'vue';
import {
  createWalletError,
  getErrorMessage,
  isWalletError,
  type AccountInfo,
  type WalletError,
} from '@xrpl-connect/core';
import { useXrplConnectContext, type WalletConnectorElement } from './context';

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

export type WalletConnectorTheme = 'dark' | 'light' | 'purple';

export const WalletConnector = defineComponent({
  name: 'WalletConnector',
  inheritAttrs: false,
  props: {
    primaryWallet: String,
    wallets: Array as PropType<string[]>,
    theme: String as PropType<WalletConnectorTheme>,
    cssVars: Object as PropType<Record<`--xc-${string}`, string>>,
  },
  emits: {
    connecting: (walletId: string) => typeof walletId === 'string',
    connect: (account: AccountInfo) => Boolean(account),
    error: (error: WalletError) => isWalletError(error),
  },
  setup(props, { attrs, emit }) {
    const context = useXrplConnectContext();
    const element = ref<WalletConnectorElement | null>(null);
    let active = false;
    let registered: WalletConnectorElement | null = null;
    let notifiedAccountKey: string | null = null;

    const onManagerConnect = (account: AccountInfo) => {
      const key = `${account.address}:${account.network.id}`;
      if (notifiedAccountKey === key) return;
      notifiedAccountKey = key;
      emit('connect', account);
    };
    const onManagerDisconnect = () => {
      notifiedAccountKey = null;
    };
    const onConnecting = (event: Event) => {
      const walletId = (event as CustomEvent<{ walletId?: string }>).detail?.walletId;
      if (!walletId) return;
      context.reportModalConnecting();
      emit('connecting', walletId);
    };
    const onError = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          error?: unknown;
          errorType?: 'rejected' | 'unavailable' | 'failed';
          walletId?: string;
        }>
      ).detail;
      const error = normalizeModalError(detail?.error, detail?.errorType, detail?.walletId);
      context.reportModalError(error);
      emit('error', error);
    };

    onMounted(() => {
      active = true;
      context.manager.on('connect', onManagerConnect);
      context.manager.on('disconnect', onManagerDisconnect);
      if (context.manager.connected && context.manager.account)
        onManagerConnect(context.manager.account);

      void customElements.whenDefined('xrpl-wallet-connector').then(() => {
        if (!active || !element.value) return;
        element.value.setWalletManager(context.manager);
        element.value.addEventListener('connecting', onConnecting);
        element.value.addEventListener('error', onError);
        context.registerConnector(element.value);
        registered = element.value;
      });
    });

    onBeforeUnmount(() => {
      active = false;
      context.manager.off('connect', onManagerConnect);
      context.manager.off('disconnect', onManagerDisconnect);
      if (!registered) return;
      registered.removeEventListener('connecting', onConnecting);
      registered.removeEventListener('error', onError);
      context.unregisterConnector(registered);
      registered = null;
    });

    return () =>
      h('xrpl-wallet-connector', {
        ...attrs,
        ref: element,
        'primary-wallet': props.primaryWallet,
        wallets: props.wallets?.join(','),
        style: [props.theme ? THEMES[props.theme] : undefined, props.cssVars, attrs.style],
      });
  },
});

function normalizeModalError(
  value: unknown,
  errorType?: 'rejected' | 'unavailable' | 'failed',
  walletId?: string
): WalletError {
  if (isWalletError(value)) return value;
  const walletName = walletId || 'wallet';
  const originalError = value instanceof Error ? value : new Error(getErrorMessage(value));
  if (errorType === 'rejected') return createWalletError.connectionRejected(walletName);
  if (errorType === 'unavailable') {
    return originalError.message.toLowerCase().includes('not installed')
      ? createWalletError.notInstalled(walletName)
      : createWalletError.notAvailable(walletName);
  }
  return createWalletError.connectionFailed(walletName, originalError);
}
