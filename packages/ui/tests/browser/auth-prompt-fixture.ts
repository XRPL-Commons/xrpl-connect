import {
  WalletManager,
  type AccountInfo,
  type NetworkInfo,
  type WalletAdapter,
} from '@xrpl-connect/core';
import '../../src/wallet-connector';

const network: NetworkInfo = {
  id: 'testnet',
  name: 'Testnet',
  wss: 'wss://example.test',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createAdapter(id: string, name: string, connect: WalletAdapter['connect']): WalletAdapter {
  return {
    id,
    name,
    isAvailable: async () => true,
    getMissingConfiguration: () => [],
    connect,
    disconnect: async () => {},
    getAccount: async () => null,
    getNetwork: async () => network,
    sign: async () => {
      throw new Error('Signing is not used by browser tests.');
    },
    signAndSubmit: async () => {
      throw new Error('Submission is not used by browser tests.');
    },
    signMessage: async () => {
      throw new Error('Message signing is not used by browser tests.');
    },
  };
}

type DiscoveryMode = 'normal' | 'error' | 'delayed';
type WalletLoginMethod = Awaited<ReturnType<NonNullable<WalletAdapter['getLoginMethods']>>>[number];
type WalletAuthPromptCallback = Parameters<NonNullable<WalletAdapter['onAuthPrompt']>>[0];
type WalletAuthPrompt = Exclude<Parameters<WalletAuthPromptCallback>[0], null>;

let discoveryMode: DiscoveryMode = 'normal';
let discoveryCallCount = 0;
let delayedDiscoveryResolve: ((methods: readonly WalletLoginMethod[]) => void) | undefined;
let authPromptCallback: ((prompt: WalletAuthPrompt | null) => void) | undefined;
let connection = deferred<AccountInfo>();
let submittedValues: Record<string, string>[] = [];
let cancelCount = 0;
let resendCount = 0;
let lastConnectOptions: Record<string, unknown> | undefined;
const eventDetailKeys: string[][] = [];
const AUTH_QR_PAYLOAD = 'farcaster://connect?uri=https%3A%2F%2Fexample.test%2Fauth';
const AUTH_ICON =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Ccircle cx="32" cy="32" r="32" fill="%230EA5E9"/%3E%3Cpath d="M20 32h24M32 20v24" stroke="white" stroke-width="6" stroke-linecap="round"/%3E%3C/svg%3E';

function createEmailPrompt(): WalletAuthPrompt {
  return {
    title: 'Sign in with email',
    description: 'Enter your email to receive a verification code.',
    icon: AUTH_ICON,
    fields: [
      {
        name: 'email',
        label: 'Email address',
        type: 'email',
        autocomplete: 'email',
        placeholder: 'you@example.com',
      },
    ],
    submitLabel: 'Send code',
    submit: async (values) => {
      submittedValues.push({ ...values });
      if (values.email !== 'user@example.com') throw new Error('Email is not registered.');
      authPromptCallback?.(createCodePrompt());
    },
    cancel: () => {
      cancelCount += 1;
    },
  };
}

function createCodePrompt(): WalletAuthPrompt {
  return {
    title: 'Enter confirmation code',
    description: 'We sent a six-digit code to user@example.com.',
    icon: AUTH_ICON,
    fields: [
      {
        name: 'code',
        label: 'Verification code',
        type: 'text',
        inputMode: 'numeric',
        autocomplete: 'one-time-code',
        codeLength: 6,
      },
    ],
    submitLabel: 'Verify',
    submit: async (values) => {
      submittedValues.push({ ...values });
      if (values.code !== '123456') throw new Error('Invalid verification code.');
      authPromptCallback?.(null);
      connection.resolve({ address: 'rAuth', network });
    },
    secondaryAction: {
      description: "Didn't get an email?",
      label: 'Resend code',
      run: async () => {
        resendCount += 1;
      },
    },
    cancel: () => {
      cancelCount += 1;
    },
  };
}

function createQrPrompt(): WalletAuthPrompt {
  return {
    title: 'Sign in with Farcaster',
    description: 'Scan this QR code with Farcaster to approve sign-in.',
    url: 'https://example.test/auth',
    qrCode: AUTH_QR_PAYLOAD,
    cancel: () => {
      cancelCount += 1;
    },
  };
}

const socialWallet = createAdapter('dynamic-social', 'Dashboard Social', async (options) => {
  lastConnectOptions = options as Record<string, unknown>;
  queueMicrotask(() => authPromptCallback?.(createEmailPrompt()));
  return connection.promise;
});

socialWallet.getLoginMethods = async () => {
  discoveryCallCount += 1;
  if (discoveryMode === 'error') throw new Error('Dashboard unavailable');
  const methods: readonly WalletLoginMethod[] =
    discoveryCallCount % 2 === 1
      ? [
          { id: 'email', label: 'Email', connectOptions: { loginMethod: 'email' } },
          { id: 'github', label: 'GitHub', connectOptions: { loginMethod: 'github' } },
        ]
      : [{ id: 'github', label: 'GitHub', connectOptions: { loginMethod: 'github' } }];
  if (discoveryMode === 'delayed') {
    return new Promise<readonly WalletLoginMethod[]>((resolve) => {
      delayedDiscoveryResolve = resolve;
    });
  }
  return methods;
};
socialWallet.onAuthPrompt = (callback) => {
  authPromptCallback = callback;
  return () => {
    if (authPromptCallback === callback) authPromptCallback = undefined;
  };
};

const externalWallet = createAdapter('external-wallet', 'External Wallet', async () => ({
  address: 'rExternal',
  network,
}));

const manager = new WalletManager({ adapters: [externalWallet, socialWallet], network });
const connector = document.querySelector('#wallet-connector') as HTMLElement & {
  setWalletManager(walletManager: WalletManager): void;
  open(): Promise<void>;
};
connector.setWalletManager(manager);

manager.on('connect', (account) => {
  document.querySelector('#status')!.textContent = `connected:${account.address}`;
});
manager.on('disconnect', () => {
  document.querySelector('#status')!.textContent = 'idle';
});

function recordEvent(event: Event): void {
  const detail = (event as CustomEvent<unknown>).detail;
  if (detail && typeof detail === 'object') eventDetailKeys.push(Object.keys(detail));
}

connector.addEventListener('connecting', recordEvent);
connector.addEventListener('connected', recordEvent);
connector.addEventListener('error', recordEvent);

document.querySelector('#open-wallet-dialog')?.addEventListener('click', () => {
  void connector.open();
});

declare global {
  interface Window {
    clearAuthState(): void;
    disconnectAuth(): Promise<void>;
    getAuthCancelCount(): number;
    getAuthEventDetailKeys(): string[][];
    getDiscoveryCallCount(): number;
    getLastConnectOptions(): Record<string, unknown> | undefined;
    resolveDelayedDiscovery(): void;
    setDiscoveryMode(mode: DiscoveryMode): void;
    getResendCount(): number;
    getSubmittedValues(): Record<string, string>[];
    resolveAuthConnection(): void;
    showAuthQrPrompt(): void;
  }
}

window.clearAuthState = () => {
  discoveryMode = 'normal';
  discoveryCallCount = 0;
  delayedDiscoveryResolve = undefined;
  authPromptCallback = undefined;
  submittedValues = [];
  cancelCount = 0;
  resendCount = 0;
  lastConnectOptions = undefined;
  eventDetailKeys.length = 0;
  connection = deferred<AccountInfo>();
};
window.disconnectAuth = () => manager.disconnect();
window.getAuthCancelCount = () => cancelCount;
window.getAuthEventDetailKeys = () => eventDetailKeys.map((keys) => [...keys]);
window.getDiscoveryCallCount = () => discoveryCallCount;
window.getLastConnectOptions = () => (lastConnectOptions ? { ...lastConnectOptions } : undefined);
window.resolveDelayedDiscovery = () => {
  const resolve = delayedDiscoveryResolve;
  delayedDiscoveryResolve = undefined;
  resolve?.([{ id: 'delayed', label: 'Delayed provider' }]);
};
window.setDiscoveryMode = (mode) => {
  discoveryMode = mode;
};
window.getResendCount = () => resendCount;
window.getSubmittedValues = () => submittedValues.map((values) => ({ ...values }));
window.resolveAuthConnection = () => connection.resolve({ address: 'rLate', network });
window.showAuthQrPrompt = () => authPromptCallback?.(createQrPrompt());

document.body.dataset.ready = 'true';
