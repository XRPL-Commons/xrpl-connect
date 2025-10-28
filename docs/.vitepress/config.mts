import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'XRPL Connect',
  description: 'A framework-agnostic wallet connection toolkit for the XRP Ledger',

  lang: 'en-US',
  base: '/xrpl-connect/',

  head: [
    ['link', { rel: 'icon', href: '/xrpl-connect/favicon.ico' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Try It Out', link: '/try-it-out' },
      { text: 'Customize', link: '/customize' },
      { text: 'Documentation', items: [
        { text: 'Getting Started', link: '/guide/getting-started' },
        { text: 'API Reference', link: '/guide/api-reference' },
        { text: 'Customization Guide', link: '/guide/customization' },
        { text: 'Examples', link: '/guide/examples' },
      ]},
      {
        text: 'Links',
        items: [
          { text: 'GitHub', link: 'https://github.com/XRPL-Commons/xrpl-connect' },
          { text: 'Contributing', link: 'https://github.com/XRPL-Commons/xrpl-connect/blob/main/CONTRIBUTING.md' },
        ]
      },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Try It Out', link: '/try-it-out' },
          { text: 'Getting Started', link: '/guide/getting-started' },
        ]
      },
      {
        text: 'Interactive Tools',
        items: [
          { text: 'Theme Customizer', link: '/customize' },
        ]
      },
      {
        text: 'Documentation',
        items: [
          { text: 'API Reference', link: '/guide/api-reference' },
          { text: 'Customization Guide', link: '/guide/customization' },
          { text: 'Examples', link: '/guide/examples' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/XRPL-Commons/xrpl-connect' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 XRPL Commons'
    },

    search: {
      provider: 'local'
    }
  },

  markdown: {
    lineNumbers: true,
  },

  srcExclude: ['**/README.md', 'assets/**'],
})
