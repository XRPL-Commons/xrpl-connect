import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'XRPL-Connect',
  description: 'A framework-agnostic wallet connection toolkit for the XRP Ledger',

  lang: 'en-US',
  base: '/xrpl-connect/',

  head: [
    ['link', { rel: 'icon', href: '/xrpl-connect/favicon.ico' }],
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
    logo: '/logo.svg',

    nav: [
      { text: 'Home', link: '/' },
      {
        text: 'Documentation',
        items: [
          { text: 'Introduction', link: '/introduction' },
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'API Reference', link: '/guide/api-reference' },
        ],
      },
      {
        text: 'Links',
        items: [
          { text: 'GitHub', link: 'https://github.com/XRPL-Commons/xrpl-connect' },
          {
            text: 'Contributing',
            link: 'https://github.com/XRPL-Commons/xrpl-connect/blob/main/CONTRIBUTING.md',
          },
        ],
      },
    ],

    sidebar: [
      {
        text: 'Start Here',
        items: [
          { text: 'Introduction', link: '/introduction' },
          { text: 'Try It Out', link: '/try-it-out' },
          { text: 'Concepts', link: '/concepts' },
        ],
      },
      {
        text: 'Getting Started',
        items: [{ text: 'Installation & Setup', link: '/guide/getting-started' }],
      },
      {
        text: 'Framework Integration',
        items: [
          { text: 'Vanilla JavaScript', link: '/guide/frameworks/vanilla-js' },
          { text: 'React', link: '/guide/frameworks/react' },
          { text: 'Vue 3', link: '/guide/frameworks/vue' },
          { text: 'Next.js', link: '/guide/frameworks/next' },
          { text: 'Nuxt 3', link: '/guide/frameworks/nuxt' },
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
        items: [{ text: 'API Reference', link: '/guide/api-reference' }],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/XRPL-Commons/xrpl-connect' }],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 XRPL Commons',
    },

    search: {
      provider: 'local',
    },
  },

  markdown: {
    lineNumbers: true,
  },

  srcExclude: ['**/README.md', 'assets/**'],
});
