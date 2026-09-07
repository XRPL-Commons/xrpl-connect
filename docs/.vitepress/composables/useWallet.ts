import { computed, shallowRef } from 'vue';

let walletManagerInstance: any = null;
let initializationPromise: Promise<any> | null = null;
const account = shallowRef<any>(null);
const connected = shallowRef(false);
const loading = shallowRef(false);
const error = shallowRef<string | null>(null);

export const useWallet = () => {
  const initializeWalletManager = async () => {
    if (typeof window === 'undefined') {
      throw new Error('WalletManager can only be initialized in the browser');
    }

    // Return cached instance if already initialized
    if (walletManagerInstance) {
      return walletManagerInstance;
    }

    // Return existing promise if initialization is in progress
    if (initializationPromise) {
      return initializationPromise;
    }

    loading.value = true;
    error.value = null;

    initializationPromise = (async () => {
      try {
        const {
          CrossmarkAdapter,
          GemWalletAdapter,
          WalletConnectAdapter,
          XamanAdapter,
          WalletManager,
          LedgerAdapter,
          XyraAdapter,
          OtsuAdapter,
          MetaMaskSnapAdapter,
        } = await import('xrpl-connect');

        if (!WalletManager) {
          throw new Error('Failed to import WalletManager from xrpl-connect');
        }
        if (!MetaMaskSnapAdapter) {
          throw new Error('Failed to import MetaMaskSnapAdapter from xrpl-connect');
        }

        const adapters: any[] = [];

        // Try to initialize each adapter
        try {
          const crossmark = new CrossmarkAdapter();
          adapters.push(crossmark);
        } catch (err) {
          console.warn('Failed to create CrossmarkAdapter:', err);
        }

        try {
          const gem = new GemWalletAdapter();
          adapters.push(gem);
        } catch (err) {
          console.warn('Failed to create GemWalletAdapter:', err);
        }
        try {
          const ledger = new LedgerAdapter();
          adapters.push(ledger);
        } catch (err) {
          console.warn('Failed to create LedgerAdapter:', err);
        }
        try {
          const xyra = new XyraAdapter();
          adapters.push(xyra);
        } catch (err) {
          console.warn('Failed to create XyraAdapter:', err);
        }
        try {
          const otsu = new OtsuAdapter();
          adapters.push(otsu);
        } catch (err) {
          console.warn('Failed to create OtsuAdapter:', err);
        }

        try {
          const metaMaskSnap = new MetaMaskSnapAdapter();
          adapters.push(metaMaskSnap);
        } catch (err) {
          console.warn('Failed to create MetaMaskSnapAdapter:', err);
        }

        const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
        if (walletConnectProjectId) {
          try {
            const walletConnect = new WalletConnectAdapter({
              projectId: walletConnectProjectId,
            });
            adapters.push(walletConnect);
          } catch (err) {
            console.warn('Failed to create WalletConnectAdapter:', err);
          }
        }

        const xamanApiKey = import.meta.env.VITE_XAMAN_API_KEY;
        if (xamanApiKey) {
          try {
            const xaman = new XamanAdapter({ apiKey: xamanApiKey });
            adapters.push(xaman);
          } catch (err) {
            console.warn('Failed to create XamanAdapter:', err);
          }
        }

        if (adapters.length === 0) {
          throw new Error('No wallet adapters could be initialized');
        }

        walletManagerInstance = new WalletManager({
          adapters,
          network: 'testnet',
          autoConnect: false,
        });

        // Set up event listeners
        walletManagerInstance.on('connect', (acc: any) => {
          account.value = acc;
          connected.value = true;
        });

        walletManagerInstance.on('disconnect', () => {
          account.value = null;
          connected.value = false;
        });

        return walletManagerInstance;
      } catch (err) {
        walletManagerInstance = null;
        initializationPromise = null;
        const message = err instanceof Error ? err.message : 'Failed to initialize WalletManager';
        error.value = message;
        console.error('Wallet initialization error:', err);
        throw err;
      } finally {
        loading.value = false;
      }
    })();

    return initializationPromise;
  };

  const getWalletManager = async () => {
    if (!walletManagerInstance) {
      await initializeWalletManager();
    }
    return walletManagerInstance;
  };

  const disconnect = async () => {
    if (walletManagerInstance) {
      await walletManagerInstance.disconnect();
    }
  };

  return {
    account: computed(() => account.value),
    connected: computed(() => connected.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    getWalletManager,
    initializeWalletManager,
    disconnect,
  };
};
