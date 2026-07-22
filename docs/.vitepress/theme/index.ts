import { h } from 'vue';
import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import DownloadLLMsFullDoc from './DownloadLLMsFullDoc.vue';
import './custom.css';

let componentImported = false;

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {});
  },
  async enhanceApp({ app }) {
    if (typeof window !== 'undefined') {
      const { default: CopyOrDownloadAsMarkdownButtons } =
        await import('vitepress-plugin-llms/vitepress-components/CopyOrDownloadAsMarkdownButtons.vue');
      app.component('CopyOrDownloadAsMarkdownButtons', CopyOrDownloadAsMarkdownButtons);
    } else {
      app.component('CopyOrDownloadAsMarkdownButtons', { render: () => null });
    }

    // Register DownloadLLMsFullDoc component
    app.component('DownloadLLMsFullDoc', DownloadLLMsFullDoc);

    // Register the web component without loading every wallet adapter.
    if (typeof window !== 'undefined' && !componentImported) {
      try {
        await import('@xrpl-connect/ui');
        componentImported = true;
      } catch (err) {
        console.error('Failed to register XRPL Connect web components:', err);
      }
    }

    // ClientOnly is already registered by DefaultTheme
  },
} satisfies Theme;
