<template>
  <div class="theme-builder">
    <div class="container">
      <div class="builder-layout">
        <!-- Controls Panel -->
        <div class="controls-panel">
          <div class="presets">
            <h3>Presets</h3>
            <div class="preset-buttons">
              <button
                class="preset-btn"
                :class="{ active: currentPreset === 'dark' }"
                @click="loadPreset('dark')"
              >
                Dark
              </button>
              <button
                class="preset-btn"
                :class="{ active: currentPreset === 'light' }"
                @click="loadPreset('light')"
              >
                Light
              </button>
              <button
                class="preset-btn"
                :class="{ active: currentPreset === 'custom' }"
                @click="currentPreset = 'custom'"
              >
                Custom
              </button>
            </div>
          </div>

          <div class="controls-sections">
            <!-- General Section -->
            <section class="control-section">
              <h4>General</h4>
              <div class="control-group">
                <label>Font Family</label>
                <input
                  v-model="variables['--xc-font-family']"
                  type="text"
                  class="input-text"
                  @change="currentPreset = 'custom'"
                />
              </div>
              <div class="control-group">
                <label>Border Radius</label>
                <input
                  v-model="variables['--xc-border-radius']"
                  type="text"
                  class="input-text"
                  placeholder="12px"
                  @change="currentPreset = 'custom'"
                />
              </div>
            </section>

            <!-- Colors Section -->
            <section class="control-section">
              <h4>Colors</h4>
              <div class="color-grid">
                <div v-for="(value, key) in colorVariables" :key="key" class="color-control">
                  <label>{{ formatLabel(key) }}</label>
                  <div class="color-input-group">
                    <input
                      v-model="variables[key]"
                      type="color"
                      class="color-picker"
                      @change="currentPreset = 'custom'"
                    />
                    <input
                      v-model="variables[key]"
                      type="text"
                      class="color-value"
                      @change="currentPreset = 'custom'"
                    />
                  </div>
                </div>
              </div>
            </section>

            <!-- Button Section -->
            <section class="control-section">
              <h4>Connect Button</h4>
              <div class="control-group">
                <label>Border Radius</label>
                <input
                  v-model="variables['--xc-connect-button-border-radius']"
                  type="text"
                  class="input-text"
                  @change="currentPreset = 'custom'"
                />
              </div>
              <div class="control-group">
                <label>Font Size</label>
                <input
                  v-model="variables['--xc-connect-button-font-size']"
                  type="text"
                  class="input-text"
                  @change="currentPreset = 'custom'"
                />
              </div>
              <div class="control-group">
                <label>Font Weight</label>
                <input
                  v-model="variables['--xc-connect-button-font-weight']"
                  type="text"
                  class="input-text"
                  @change="currentPreset = 'custom'"
                />
              </div>
            </section>

            <!-- Primary Button -->
            <section class="control-section">
              <h4>Primary Button</h4>
              <div class="control-group">
                <label>Border Radius</label>
                <input
                  v-model="variables['--xc-primary-button-border-radius']"
                  type="text"
                  class="input-text"
                  @change="currentPreset = 'custom'"
                />
              </div>
              <div class="control-group">
                <label>Font Weight</label>
                <input
                  v-model="variables['--xc-primary-button-font-weight']"
                  type="text"
                  class="input-text"
                  @change="currentPreset = 'custom'"
                />
              </div>
            </section>

            <!-- Secondary Button -->
            <section class="control-section">
              <h4>Secondary Button</h4>
              <div class="control-group">
                <label>Border Radius</label>
                <input
                  v-model="variables['--xc-secondary-button-border-radius']"
                  type="text"
                  class="input-text"
                  @change="currentPreset = 'custom'"
                />
              </div>
              <div class="control-group">
                <label>Font Weight</label>
                <input
                  v-model="variables['--xc-secondary-button-font-weight']"
                  type="text"
                  class="input-text"
                  @change="currentPreset = 'custom'"
                />
              </div>
            </section>

            <!-- Modal Section -->
            <section class="control-section">
              <h4>Modal</h4>
              <div class="control-group">
                <label>Border Radius</label>
                <input
                  v-model="variables['--xc-modal-border-radius']"
                  type="text"
                  class="input-text"
                  @change="currentPreset = 'custom'"
                />
              </div>
              <div class="control-group">
                <label>Box Shadow</label>
                <input
                  v-model="variables['--xc-modal-box-shadow']"
                  type="text"
                  class="input-text"
                  @change="currentPreset = 'custom'"
                />
              </div>
            </section>

            <!-- Loading Section -->
            <section class="control-section">
              <h4>Loading</h4>
              <div class="control-group">
                <label>Border Color</label>
                <div class="color-input-group">
                  <input
                    v-model="variables['--xc-loading-border-color']"
                    type="color"
                    class="color-picker"
                    @change="currentPreset = 'custom'"
                  />
                  <input
                    v-model="variables['--xc-loading-border-color']"
                    type="text"
                    class="color-value"
                    @change="currentPreset = 'custom'"
                  />
                </div>
              </div>
            </section>
          </div>
        </div>

        <!-- Preview Panel -->
        <div class="preview-panel">
          <div class="preview-card">
            <h3>Live Preview</h3>
            <div class="preview-content">
              <xrpl-wallet-connector
                id="theme-preview"
                :style="computedStyles"
                wallets="xaman,crossmark"
                primary-wallet="xaman"
              ></xrpl-wallet-connector>
            </div>
          </div>

          <!-- Output Section -->
          <div class="output-card">
            <div class="output-header">
              <h3>CSS Variables</h3>
              <button class="copy-btn" @click="copyToClipboard">
                {{ copied ? '✓ Copied!' : 'Copy Code' }}
              </button>
            </div>
            <div class="output-code">
              <pre><code>{{ generatedCSS }}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useWallet } from '../.vitepress/composables/useWallet'

const currentPreset = ref('light')
const copied = ref(false)

const { getWalletManager } = useWallet()

const darkPreset = {
  '--xc-font-family': 'Inter, system-ui, sans-serif',
  '--xc-border-radius': '12px',
  '--xc-overlay-background': 'rgba(0, 0, 0, 0.7)',
  '--xc-overlay-backdrop-filter': 'blur(0px)',
  '--xc-primary-color': '#0EA5E9',
  '--xc-background-color': '#000637',
  '--xc-background-secondary': '#1a1a3e',
  '--xc-background-tertiary': '#242452',
  '--xc-text-color': '#F5F4E7',
  '--xc-text-muted-color': 'rgba(245, 244, 231, 0.6)',
  '--xc-danger-color': '#ef4444',
  '--xc-success-color': '#10b981',
  '--xc-warning-color': '#f59e0b',
  '--xc-focus-color': '#0EA5E9',
  '--xc-connect-button-border-radius': '8px',
  '--xc-connect-button-font-size': '16px',
  '--xc-connect-button-font-weight': '600',
  '--xc-connect-button-color': '#F5F4E7',
  '--xc-connect-button-background': '#000637',
  '--xc-connect-button-border': '1px solid rgba(255, 255, 255, 0.1)',
  '--xc-connect-button-hover-background': '#1a1a3e',
  '--xc-primary-button-border-radius': '8px',
  '--xc-primary-button-font-weight': '600',
  '--xc-primary-button-color': '#ffffff',
  '--xc-primary-button-background': '#0EA5E9',
  '--xc-primary-button-hover-background': '#0284C7',
  '--xc-secondary-button-border-radius': '8px',
  '--xc-secondary-button-font-weight': '500',
  '--xc-secondary-button-color': '#F5F4E7',
  '--xc-secondary-button-background': '#1a1a3e',
  '--xc-secondary-button-hover-background': '#242452',
  '--xc-loading-border-color': '#0EA5E9',
  '--xc-modal-background': '#000637',
  '--xc-modal-border-radius': '12px',
  '--xc-modal-box-shadow': '0 10px 40px rgba(0, 0, 0, 0.2)'
}

const lightPreset = {
  '--xc-font-family': 'Inter, system-ui, sans-serif',
  '--xc-border-radius': '12px',
  '--xc-overlay-background': 'rgba(0, 0, 0, 0.5)',
  '--xc-overlay-backdrop-filter': 'blur(0px)',
  '--xc-primary-color': '#3b82f6',
  '--xc-background-color': '#F6F4EF',
  '--xc-background-secondary': '#EDE9E0',
  '--xc-background-tertiary': '#E5DED5',
  '--xc-text-color': '#111111',
  '--xc-text-muted-color': 'rgba(17, 17, 17, 0.6)',
  '--xc-danger-color': '#ef4444',
  '--xc-success-color': '#10b981',
  '--xc-warning-color': '#f59e0b',
  '--xc-focus-color': '#3b82f6',
  '--xc-connect-button-border-radius': '8px',
  '--xc-connect-button-font-size': '16px',
  '--xc-connect-button-font-weight': '600',
  '--xc-connect-button-color': '#111111',
  '--xc-connect-button-background': '#F6F4EF',
  '--xc-connect-button-border': '1px solid #E5DED5',
  '--xc-connect-button-hover-background': '#EDE9E0',
  '--xc-primary-button-border-radius': '8px',
  '--xc-primary-button-font-weight': '600',
  '--xc-primary-button-color': '#ffffff',
  '--xc-primary-button-background': '#3b82f6',
  '--xc-primary-button-hover-background': '#2563eb',
  '--xc-secondary-button-border-radius': '8px',
  '--xc-secondary-button-font-weight': '500',
  '--xc-secondary-button-color': '#111111',
  '--xc-secondary-button-background': '#EDE9E0',
  '--xc-secondary-button-hover-background': '#E5DED5',
  '--xc-loading-border-color': '#3b82f6',
  '--xc-modal-background': '#F6F4EF',
  '--xc-modal-border-radius': '12px',
  '--xc-modal-box-shadow': '0 10px 40px rgba(0, 0, 0, 0.1)'
}

const variables = reactive({ ...lightPreset })

const colorVariables = computed(() => {
  return Object.fromEntries(
    Object.entries(variables).filter(([key]) =>
      [
        '--xc-primary-color',
        '--xc-background-color',
        '--xc-background-secondary',
        '--xc-background-tertiary',
        '--xc-text-color',
        '--xc-text-muted-color',
        '--xc-danger-color',
        '--xc-success-color',
        '--xc-warning-color',
        '--xc-focus-color',
        '--xc-loading-border-color'
      ].includes(key)
    )
  )
})

const computedStyles = computed(() => {
  return Object.entries(variables)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ')
})

const generatedCSS = computed(() => {
  const lines = Object.entries(variables)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')
  return `xrpl-wallet-connector {\n${lines}\n}`
})

const formatLabel = (key) => {
  return key
    .replace('--xc-', '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const loadPreset = (preset) => {
  currentPreset.value = preset
  const presetData = preset === 'dark' ? darkPreset : lightPreset
  Object.assign(variables, presetData)
}

const copyToClipboard = async () => {
  await navigator.clipboard.writeText(generatedCSS.value)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

onMounted(async () => {
  try {
    const walletManager = await getWalletManager()

    // Set wallet manager on preview connector
    const connector = document.getElementById('theme-preview')
    if (connector && walletManager) {
      connector.setWalletManager(walletManager)
    }
  } catch (err) {
    console.error('Failed to initialize wallet for theme builder:', err)
  }
})
</script>

<style scoped>
.theme-builder {
  padding: 2rem 0;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 1rem;
}

.builder-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.controls-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.presets {
  padding: 1rem;
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
}

.presets h3 {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
  font-weight: 600;
}

.preset-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.5rem;
}

.preset-btn {
  padding: 0.75rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.preset-btn:hover {
  border-color: var(--vp-c-brand);
}

.preset-btn.active {
  border-color: var(--vp-c-brand);
  background: var(--vp-c-brand);
  color: white;
}

.controls-sections {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 1rem;
}

.controls-sections::-webkit-scrollbar {
  width: 6px;
}

.controls-sections::-webkit-scrollbar-track {
  background: transparent;
}

.controls-sections::-webkit-scrollbar-thumb {
  background: var(--vp-c-divider);
  border-radius: 3px;
}

.control-section {
  padding: 1rem;
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
}

.control-section h4 {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
  font-weight: 600;
}

.control-group {
  margin-bottom: 1rem;
}

.control-group:last-child {
  margin-bottom: 0;
}

.control-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--vp-c-text-1);
}

.input-text {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 0.875rem;
  font-family: monospace;
}

.input-text:focus {
  outline: none;
  border-color: var(--vp-c-brand);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.color-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.color-control {
  display: flex;
  flex-direction: column;
}

.color-control label {
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--vp-c-text-1);
}

.color-input-group {
  display: flex;
  gap: 0.5rem;
}

.color-picker {
  width: 50px;
  height: 36px;
  padding: 2px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  cursor: pointer;
}

.color-value {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 0.875rem;
  font-family: monospace;
}

.color-value:focus {
  outline: none;
  border-color: var(--vp-c-brand);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.preview-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.preview-card,
.output-card {
  padding: 1.5rem;
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
}

.preview-card h3,
.output-card h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
}

.preview-content {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  background: var(--vp-c-bg);
  border-radius: 8px;
  padding: 1rem;
  border: 1px dashed var(--vp-c-divider);
}

.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.output-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.copy-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.copy-btn:hover {
  border-color: var(--vp-c-brand);
  background: var(--vp-c-brand-light);
}

.output-code {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  overflow-x: auto;
  padding: 1rem;
  max-height: 400px;
  overflow-y: auto;
}

.output-code pre {
  margin: 0;
  background: transparent;
  padding: 0;
}

.output-code code {
  background: transparent;
  padding: 0;
  font-size: 0.875rem;
  line-height: 1.6;
  font-family: monospace;
  color: var(--vp-c-text-1);
}

@media (max-width: 1024px) {
  .builder-layout {
    grid-template-columns: 1fr;
  }

  .controls-sections {
    max-height: none;
  }
}

@media (max-width: 768px) {
  .preset-buttons {
    grid-template-columns: 1fr;
  }

  .color-input-group {
    flex-direction: column;
  }

  .color-picker {
    width: 100%;
  }
}
</style>
