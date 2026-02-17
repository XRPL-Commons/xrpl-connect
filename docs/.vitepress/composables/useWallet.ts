import { ref, computed } from 'vue';

let walletManagerInstance: any = null;
let initializationPromise: Promise<any> | null = null;

export const useWallet = () => {
  const account = ref<any>(null);
  const connected = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const initializeWalletManager = async () => {
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
        } = (await import('xrpl-connect')) as any;

        if (!WalletManager) {
          throw new Error('Failed to import WalletManager from xrpl-connect');
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
          const walletConnect = new WalletConnectAdapter({
            projectId: '32798b46e13dfb0049706a524cf132d6',
          });
          adapters.push(walletConnect);
        } catch (err) {
          console.warn('Failed to create WalletConnectAdapter:', err);
        }

        try {
          const xaman = new XamanAdapter({
            apiKey: '15ba80a8-cba2-4789-a45b-c6a850d9d91b',
          });
          adapters.push(xaman);
        } catch (err) {
          console.warn('Failed to create XamanAdapter:', err);
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

        walletManagerInstance.on('error', (err: any) => {
          error.value = err.message;
        });

        return walletManagerInstance;
      } catch (err) {
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
