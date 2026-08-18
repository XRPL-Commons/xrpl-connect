import { defineConfig } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';
import { copyOrDownloadAsMarkdownButtons } from 'vitepress-plugin-llms';

const repository = 'https://github.com/XRPL-Commons/xrpl-connect';

const currentNav = [
  {
    text: 'Documentation',
    items: [
      { text: 'Introduction', link: '/' },
      { text: 'Getting Started', link: '/guide/getting-started' },
      { text: 'API Reference', link: '/guide/api-reference' },
      { text: 'Migrate from 0.8.2', link: '/guide/migration-v1' },
    ],
  },
  {
    text: 'Links',
    items: [
      { text: 'GitHub', link: repository },
      { text: 'Releases', link: `${repository}/releases` },
      { text: 'Contributing', link: `${repository}/blob/develop/CONTRIBUTING.md` },
      { text: 'XRPL Commons', link: 'https://www.xrpl-commons.org' },
    ],
  },
  {
    text: 'v1.0.0',
    items: [{ text: 'v0.8.2', link: '/0.8.2/' }],
  },
];

const currentSidebar = [
  {
    text: 'Start Here',
    items: [
      { text: 'Introduction', link: '/' },
      { text: 'Installation & Quick Start', link: '/guide/getting-started' },
      { text: 'Core Concepts', link: '/concepts' },
      { text: 'Try It Out', link: '/try-it-out' },
    ],
  },
  {
    text: 'Build',
    items: [
      { text: 'Wallets & Capabilities', link: '/guide/wallets' },
      { text: 'Transactions & Signing', link: '/guide/transactions' },
      { text: 'Production & Security', link: '/guide/production' },
    ],
  },
  {
    text: 'Framework Integration',
    items: [
      { text: 'Vanilla JavaScript', link: '/guide/frameworks/vanilla-js' },
      { text: 'React', link: '/guide/frameworks/react' },
      { text: 'Vue 3', link: '/guide/frameworks/vue' },
      { text: 'Nuxt', link: '/guide/frameworks/nuxt' },
    ],
  },
  {
    text: 'Advanced',
    items: [
      { text: 'Creating Wallet Adapters', link: '/guide/adapter-integration' },
      { text: 'Examples', link: '/guide/examples' },
    ],
  },
  {
    text: 'Customization',
    items: [
      { text: 'Customization Guide', link: '/guide/customization' },
      { text: 'Interactive Builder', link: '/customization-builder' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'API Reference', link: '/guide/api-reference' },
      { text: 'Migrating from 0.8.2', link: '/guide/migration-v1' },
    ],
  },
];

const archivedNav = [
  {
    text: 'Documentation',
    items: [
      { text: 'Introduction', link: '/0.8.2/' },
      { text: 'Getting Started', link: '/0.8.2/guide/getting-started' },
      { text: 'API Reference', link: '/0.8.2/guide/api-reference' },
      { text: 'Migrate to 1.0.0', link: '/guide/migration-v1' },
    ],
  },
  {
    text: 'Links',
    items: [
      { text: 'GitHub', link: repository },
      { text: '0.8.2 release', link: `${repository}/releases/tag/v0.8.2` },
    ],
  },
  {
    text: 'v0.8.2',
    items: [{ text: 'v1.0.0', link: '/' }],
  },
];

const archivedSidebar = [
  {
    text: '0.8.2 Documentation',
    items: [
      { text: 'Introduction', link: '/0.8.2/' },
      { text: 'Core Concepts', link: '/0.8.2/concepts' },
      { text: 'Try It Out', link: '/0.8.2/try-it-out' },
    ],
  },
  {
    text: 'Getting Started',
    items: [{ text: 'Installation & Quick Start', link: '/0.8.2/guide/getting-started' }],
  },
  {
    text: 'Framework Integration',
    items: [
      { text: 'Vanilla JavaScript', link: '/0.8.2/guide/frameworks/vanilla-js' },
      { text: 'React', link: '/0.8.2/guide/frameworks/react' },
      { text: 'Vue 3', link: '/0.8.2/guide/frameworks/vue' },
      { text: 'Nuxt', link: '/0.8.2/guide/frameworks/nuxt' },
    ],
  },
  {
    text: 'Advanced',
    items: [
      { text: 'Creating Wallet Adapters', link: '/0.8.2/guide/adapter-integration' },
      { text: 'Examples', link: '/0.8.2/guide/examples' },
    ],
  },
  {
    text: 'Customization',
    items: [
      { text: 'Customization Guide', link: '/0.8.2/guide/customization' },
      { text: 'Interactive Builder', link: '/0.8.2/customization-builder' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'API Reference', link: '/0.8.2/guide/api-reference' },
      { text: 'Migrate to 1.0.0', link: '/guide/migration-v1' },
    ],
  },
];

export default defineConfig({
  title: 'XRPL Connect',
  description: 'A framework-agnostic wallet connection toolkit for the XRP Ledger',
  base: '/xrpl-connect/',

  locales: {
    root: {
      label: '1.0.0',
      lang: 'en-US',
      themeConfig: { nav: currentNav, sidebar: currentSidebar },
    },
    '0.8.2': {
      label: '0.8.2',
      lang: 'en-US',
      link: '/0.8.2/',
      themeConfig: { nav: archivedNav, sidebar: archivedSidebar },
    },
  },

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/xrpl-connect/favicon.png' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        href: 'https://fonts.googleapis.com/css2?family=Unbounded:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
        rel: 'stylesheet',
      },
    ],
  ],

  themeConfig: {
    logo: '/commons_ligth_logo.png',
    i18nRouting: false,
    socialLinks: [{ icon: 'github', link: repository }],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 XRPL Commons',
    },
    search: { provider: 'local' },
  },

  markdown: {
    lineNumbers: true,
    config(md) {
      md.use(copyOrDownloadAsMarkdownButtons);
    },
  },

  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag === 'xrpl-wallet-connector',
      },
    },
  },

  vite: {
    plugins: [
      llmstxt({
        excludeIndexPage: false,
        generateLLMsFullTxt: true,
        ignoreFiles: ['0.8.2/**'],
      }),
    ],
  },

  srcExclude: ['**/README.md', 'assets/**'],
});
