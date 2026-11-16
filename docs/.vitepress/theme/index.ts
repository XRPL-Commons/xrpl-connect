import { h } from 'vue';
import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { createXrplConnect } from '@xrpl-commons/xrpl-connect-vue';
import { Buffer as BufferPolyfill } from 'buffer';
import CopyOrDownloadAsMarkdownButtons from 'vitepress-plugin-llms/vitepress-components/CopyOrDownloadAsMarkdownButtons.vue';
import DownloadLLMsFullDoc from './DownloadLLMsFullDoc.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {});
  },
  async enhanceApp({ app }) {
    // This component only touches browser APIs from onMounted. Registering the
    // same implementation during SSR and hydration keeps their initial markup
    // identical.
    app.component('CopyOrDownloadAsMarkdownButtons', CopyOrDownloadAsMarkdownButtons);

    // Register DownloadLLMsFullDoc component
    app.component('DownloadLLMsFullDoc', DownloadLLMsFullDoc);

    // The Vue plugin owns one manager for the docs app. Install it only on the
    // client because adapter constructors and the custom element use browser APIs.
    if (typeof window !== 'undefined') {
      // Ledger's browser transport references Buffer while the umbrella SDK is
      // evaluated, even when Ledger is not selected. Install the browser
      // implementation before loading that client-only module.
      globalThis.Buffer ??= BufferPolyfill;

      try {
        const {
          CrossmarkAdapter,
          GemWalletAdapter,
          WalletConnectAdapter,
          XamanAdapter,
          LedgerAdapter,
          XyraAdapter,
          GhostsigAdapter,
          OtsuAdapter,
          MetaMaskSnapAdapter,
        } = await import('xrpl-connect');

        const adapters: Parameters<typeof createXrplConnect>[0]['adapters'] = [];
        const addAdapter = (name: string, create: () => (typeof adapters)[number]) => {
          try {
            adapters.push(create());
          } catch (err) {
            console.warn(`Failed to create ${name}:`, err);
          }
        };

        addAdapter('CrossmarkAdapter', () => new CrossmarkAdapter());
        addAdapter('GemWalletAdapter', () => new GemWalletAdapter());
        addAdapter('LedgerAdapter', () => new LedgerAdapter());
        addAdapter('XyraAdapter', () => new XyraAdapter());
        addAdapter('GhostsigAdapter', () => new GhostsigAdapter());
        addAdapter('OtsuAdapter', () => new OtsuAdapter());
        addAdapter('MetaMaskSnapAdapter', () => new MetaMaskSnapAdapter());

        const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
        if (walletConnectProjectId) {
          addAdapter(
            'WalletConnectAdapter',
            () => new WalletConnectAdapter({ projectId: walletConnectProjectId })
          );
        }

        const xamanApiKey = import.meta.env.VITE_XAMAN_API_KEY;
        if (xamanApiKey) {
          addAdapter('XamanAdapter', () => new XamanAdapter({ apiKey: xamanApiKey }));
        }

        if (adapters.length === 0) {
          throw new Error('No wallet adapters could be initialized');
        }

        app.use(
          createXrplConnect({
            adapters,
            network: 'testnet',
            autoConnect: false,
          })
        );
      } catch (err) {
        console.error('Failed to initialize XRPL Connect for the docs demo:', err);
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to initialize XRPL Connect for the docs demo: ${message}`, {
          cause: err,
        });
      }
    }

    // ClientOnly is already registered by DefaultTheme
  },
} satisfies Theme;
