import {
  WalletManager,
  type AccountInfo,
  type ConnectOptions,
  type NetworkInfo,
  type WalletAdapter,
} from '@xrpl-connect/core';
import '../../src/wallet-connector';

const network: NetworkInfo = {
  id: 'testnet',
  name: 'Testnet',
  wss: 'wss://example.test',
};

interface DeferredSocialCall {
  options?: ConnectOptions;
  resolve(account: AccountInfo): void;
  reject(error: Error): void;
}

function createDeferred<T>() {
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

let socialCallCount = 0;
let socialDisconnectCount = 0;
let pendingLogout: ReturnType<typeof createDeferred<void>> | undefined;
const socialCalls: DeferredSocialCall[] = [];

const externalWallet = createAdapter('external-wallet', 'External Wallet', async () => ({
  address: 'rExternal',
  network,
}));

const socialWallet = createAdapter('social-adapter', 'Social Adapter', (options) => {
  const deferred = createDeferred<AccountInfo>();
  socialCallCount += 1;
  socialCalls.push({ options, resolve: deferred.resolve, reject: deferred.reject });
  return deferred.promise;
});
const originalSocialDisconnect = socialWallet.disconnect;
socialWallet.disconnect = async () => {
  socialDisconnectCount += 1;
  await pendingLogout?.promise;
  await originalSocialDisconnect();
};

const manager = new WalletManager({ adapters: [externalWallet, socialWallet], network });
const connector = document.querySelector('#wallet-connector') as HTMLElement & {
  socialLogins: readonly {
    id: string;
    label: string;
    adapterId: string;
    connectOptions?: ConnectOptions;
  }[];
  setWalletManager(walletManager: WalletManager): void;
  open(): Promise<void>;
};

const socialLogins = [
  {
    id: 'google',
    label: 'Continue with Google',
    adapterId: socialWallet.id,
    connectOptions: { loginMethod: 'google' },
  },
  {
    id: 'apple',
    label: 'Continue with Apple',
    adapterId: socialWallet.id,
    connectOptions: { loginMethod: 'apple' },
  },
] as const;

let managerConnectCount = 0;
let connectorConnectedCount = 0;

function setState(value: string): void {
  document.querySelector('#state')!.textContent = value;
}

manager.on('connect', (account) => {
  managerConnectCount += 1;
  document.querySelector('#manager-connect-count')!.textContent = String(managerConnectCount);
  setState(`connected:${account.address}`);
});
manager.on('disconnect', () => setState('idle'));

connector.addEventListener('connecting', () => setState('pending'));
connector.addEventListener('connected', () => {
  connectorConnectedCount += 1;
  document.querySelector('#connector-connected-count')!.textContent =
    String(connectorConnectedCount);
});
connector.addEventListener('error', () => setState('error'));
connector.addEventListener('close', () => {
  if (!manager.connected) setState('idle');
});

connector.setWalletManager(manager);
connector.socialLogins = socialLogins;

document.querySelector('#logout')?.addEventListener('click', () => {
  void manager.disconnect();
});

document.querySelector('#open-wallet-dialog')?.addEventListener('click', () => {
  void connector.open();
});

declare global {
  interface Window {
    delaySocialLogout(): void;
    finishSocialLogout(): void;
    clearSocialLogins(): void;
    getManagerConnectCount(): number;
    getConnectorConnectedCount(): number;
    getSocialCallCount(): number;
    getSocialDisconnectCount(): number;
    getSocialLoginMethods(): Array<string | undefined>;
    rejectSocial(message?: string): void;
    resolveSocial(): void;
  }
}

window.delaySocialLogout = () => {
  pendingLogout = createDeferred<void>();
};
window.finishSocialLogout = () => {
  pendingLogout?.resolve();
  pendingLogout = undefined;
};
window.clearSocialLogins = () => {
  connector.socialLogins = [];
};
window.getManagerConnectCount = () => managerConnectCount;
window.getConnectorConnectedCount = () => connectorConnectedCount;
window.getSocialCallCount = () => socialCallCount;
window.getSocialDisconnectCount = () => socialDisconnectCount;
window.getSocialLoginMethods = () =>
  socialCalls.map((call) => {
    const options = call.options as (ConnectOptions & { loginMethod?: string }) | undefined;
    return options?.loginMethod;
  });
window.rejectSocial = (message = 'Social authorization rejected') => {
  socialCalls.at(-1)?.reject(new Error(message));
};
window.resolveSocial = () => {
  socialCalls.at(-1)?.resolve({ address: 'rSocial', network });
};

document.body.dataset.ready = 'true';
