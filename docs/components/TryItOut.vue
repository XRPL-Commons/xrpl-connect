<template>
  <div class="container">
    <div class="demo-card">
      <div class="preview-content" :class="`theme-${theme}`">
        <xrpl-wallet-connector
          id="demo-connector"
          :style="computedStyles"
          wallets="xaman,crossmark"
          primary-wallet="xaman"
        ></xrpl-wallet-connector>
      </div>

      <div class="demo-footer">
        <div class="theme-select">
          <label>Theme</label>
          <select v-model="theme">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useWallet } from '../.vitepress/composables/useWallet';

const theme = ref('light');
const { getWalletManager } = useWallet();

const darkTheme = {
  '--xc-primary-color': '#0EA5E9',
  '--xc-background-color': '#000637',
  '--xc-background-secondary': '#1a1a3e',
  '--xc-background-tertiary': '#242452',
  '--xc-text-color': '#F5F4E7',
  '--xc-text-muted-color': 'rgba(245, 244, 231, 0.6)',
  '--xc-overlay-background': 'rgba(0, 0, 0, 0.7)',
};

const lightTheme = {
  '--xc-primary-color': '#2563eb',
  '--xc-background-color': '#F6F4EF',
  '--xc-background-secondary': '#EDE9E0',
  '--xc-background-tertiary': '#E5DED5',
  '--xc-text-color': '#111111',
  '--xc-text-muted-color': 'rgba(17, 17, 17, 0.6)',
  '--xc-overlay-background': 'rgba(0, 0, 0, 0.5)',
};

const themeStyles = computed(() => (theme.value === 'dark' ? darkTheme : lightTheme));

const computedStyles = computed(() => {
  return Object.entries(themeStyles.value)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
});

onMounted(async () => {
  try {
    const walletManager = await getWalletManager();
    const connector = document.getElementById('demo-connector');
    if (connector && walletManager) connector.setWalletManager(walletManager);
  } catch (err) {
    console.error('Failed to initialize wallet:', err);
  }
});
</script>

<style scoped>
.container {
  max-width: 1000px;
  width: 100%;
  padding: 0 1rem;
}

.demo-card {
  position: relative;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg, #fff);
  overflow: hidden;
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
}

.theme-toggle {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  gap: 0.5rem;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft, #f5f5f5);
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn.active {
  background: var(--vp-c-brand, #2563eb);
  border-color: var(--vp-c-brand, #2563eb);
  color: white;
}

.preview-content {
  padding: 4rem 2rem;
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.demo-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft, #fafafa);
}

.demo-footer label {
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  margin-right: 0.5rem;
}

.demo-footer input,
.demo-footer select {
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.nav-buttons {
  display: flex;
  justify-content: space-between;
}

.nav-btn {
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn.primary {
  background: var(--vp-c-brand, #2563eb);
  color: #fff;
  border-color: var(--vp-c-brand, #2563eb);
}

.nav-btn.primary:hover {
  background: #1e40af;
}

.nav-btn.secondary:hover {
  background: var(--vp-c-bg-soft);
}

@media (max-width: 640px) {
  .preview-content {
    padding: 2rem 1rem;
    min-height: 280px;
  }

  .demo-footer {
    flex-direction: column;
    gap: 0.75rem;
  }
}
</style>
