import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import './custom.css'

let componentImported = false

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {})
  },
  async enhanceApp({ app }) {
    // Only import web components on client side
    if (typeof window !== 'undefined' && !componentImported) {
      try {
        await import('xrpl-connect')
        componentImported = true
      } catch (err) {
        console.error('Failed to import xrpl-connect:', err)
      }
    }

    // ClientOnly is already registered by DefaultTheme
  }
} satisfies Theme
