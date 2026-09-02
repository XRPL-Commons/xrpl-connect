import {
  defineComponent,
  h,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  type PropType,
} from 'vue';
import {
  createWalletError,
  getErrorMessage,
  isWalletError,
  type AccountInfo,
  type WalletError,
  type WalletIdentifier,
} from '@xrpl-connect/core';
import type { WalletConnectorCssVars } from 'xrpl-connect';
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
    primaryWallet: String as PropType<WalletIdentifier>,
    wallets: Array as PropType<WalletIdentifier[]>,
    showUnavailable: Boolean,
    theme: String as PropType<WalletConnectorTheme>,
    cssVars: Object as PropType<WalletConnectorCssVars>,
  },
  emits: {
    connecting: (walletId: WalletIdentifier) => typeof walletId === 'string',
    connect: (account: AccountInfo) => Boolean(account),
    error: (error: WalletError) => isWalletError(error),
  },
  setup(props, { attrs, emit }) {
    const context = useXrplConnectContext();
    const element = ref<WalletConnectorElement | null>(null);
    let active = false;
    let registered: WalletConnectorElement | null = null;
    let notifiedAccountKey: string | null = null;
    let managerListenersAttached = false;
    const modalAttempts = new Map<number, symbol>();
    let legacyModalAttempt: symbol | null = null;
    let modalOpen = false;
    let highestCancelledAttemptId = 0;

    const cancelModalAttempts = () => {
      const attempts = [...modalAttempts.values()];
      for (const connectionAttemptId of modalAttempts.keys()) {
        highestCancelledAttemptId = Math.max(highestCancelledAttemptId, connectionAttemptId);
      }
      if (legacyModalAttempt) attempts.push(legacyModalAttempt);
      modalAttempts.clear();
      legacyModalAttempt = null;
      if (attempts.length > 0) context.reportModalClosed(attempts);
    };
    const onOpen = () => {
      modalOpen = true;
    };
    const onClose = () => {
      modalOpen = false;
      cancelModalAttempts();
    };

    const onManagerConnect = (account: AccountInfo) => {
      if (!active) return;
      const key = `${account.address}:${account.network.id}`;
      if (notifiedAccountKey === key) return;
      notifiedAccountKey = key;
      emit('connect', account);
    };
    const onManagerDisconnect = () => {
      notifiedAccountKey = null;
    };
    const onConnecting = (event: Event) => {
      const detail = (event as CustomEvent<{ walletId?: string; connectionAttemptId?: number }>)
        .detail;
      const walletId = detail?.walletId;
      if (!walletId) return;
      const attempt = context.reportModalConnecting();
      if (detail?.connectionAttemptId === undefined) {
        if (legacyModalAttempt) context.reportModalClosed([legacyModalAttempt]);
        legacyModalAttempt = attempt;
      } else {
        const previousAttempt = modalAttempts.get(detail.connectionAttemptId);
        if (previousAttempt) context.reportModalClosed([previousAttempt]);
        modalAttempts.set(detail.connectionAttemptId, attempt);
      }
      emit('connecting', walletId);
    };
    const onError = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          error?: unknown;
          errorType?: 'rejected' | 'unavailable' | 'failed';
          walletId?: string;
          connectionAttemptId?: number;
        }>
      ).detail;
      const error = normalizeModalError(detail?.error, detail?.errorType, detail?.walletId);
      let attempt: symbol | null;
      if (detail?.connectionAttemptId === undefined) {
        attempt = legacyModalAttempt;
        legacyModalAttempt = null;
        if (attempt === null) return;
      } else {
        attempt = modalAttempts.get(detail.connectionAttemptId) ?? null;
        if (attempt === null) {
          if (!modalOpen || detail.connectionAttemptId <= highestCancelledAttemptId) return;
        } else {
          modalAttempts.delete(detail.connectionAttemptId);
        }
      }
      if (context.reportModalError(attempt, error)) emit('error', error);
    };

    const attachManagerListeners = () => {
      if (managerListenersAttached) return;
      context.manager.on('connect', onManagerConnect);
      context.manager.on('disconnect', onManagerDisconnect);
      managerListenersAttached = true;
    };

    const detachManagerListeners = () => {
      if (!managerListenersAttached) return;
      context.manager.off('connect', onManagerConnect);
      context.manager.off('disconnect', onManagerDisconnect);
      managerListenersAttached = false;
    };

    const activateConnector = () => {
      if (active) return;
      active = true;
      attachManagerListeners();
      if (context.manager.connected && context.manager.account) {
        onManagerConnect(context.manager.account);
      }
      void customElements.whenDefined('xrpl-wallet-connector').then(() => {
        if (!active || registered || !element.value) return;
        element.value.setWalletManager(context.manager);
        element.value.addEventListener('connecting', onConnecting);
        element.value.addEventListener('error', onError);
        element.value.addEventListener('open', onOpen);
        element.value.addEventListener('close', onClose);
        context.registerConnector(element.value);
        registered = element.value;
      });
    };

    const deactivateConnector = () => {
      active = false;
      modalOpen = false;
      detachManagerListeners();
      cancelModalAttempts();
      if (!registered) return;
      registered.removeEventListener('connecting', onConnecting);
      registered.removeEventListener('error', onError);
      registered.removeEventListener('open', onOpen);
      registered.removeEventListener('close', onClose);
      context.unregisterConnector(registered);
      registered = null;
    };

    onMounted(() => {
      activateConnector();
    });

    onActivated(activateConnector);
    onDeactivated(deactivateConnector);

    onBeforeUnmount(() => {
      deactivateConnector();
    });

    return () =>
      h('xrpl-wallet-connector', {
        ...attrs,
        ref: element,
        'primary-wallet': props.primaryWallet,
        wallets: props.wallets?.join(','),
        'show-unavailable': props.showUnavailable ? '' : undefined,
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
