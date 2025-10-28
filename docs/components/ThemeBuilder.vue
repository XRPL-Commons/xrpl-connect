<template>
  <div class="theme-builder">
    <div class="builder-layout">
      <!-- Preview Panel (Left) -->
      <div class="preview-section">
        <div class="preview-card">
          <xrpl-wallet-connector
            id="theme-preview"
            :style="computedStyles"
            primary-wallet="xaman"
          ></xrpl-wallet-connector>

          <!-- CSS Code Button at Bottom Left -->
          <button class="code-btn-preview" @click="showCodeModal = true" title="View CSS code">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            <span>CSS</span>
          </button>
        </div>
      </div>

      <!-- Controls Sidebar (Right - VitePress style) -->
      <aside class="controls-sidebar">
        <div class="sidebar-container">
          <!-- General Section -->
          <section class="control-section">
            <h4>General</h4>
            <div class="control-group">
              <label>Font Family</label>
              <input v-model="variables['--xc-font-family']" type="text" class="input-text" />
            </div>
            <div class="control-group">
              <label>Border Radius</label>
              <input
                v-model="variables['--xc-border-radius']"
                type="text"
                class="input-text"
                placeholder="12px"
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
                  <input v-model="variables[key]" type="color" class="color-picker" />
                  <input v-model="variables[key]" type="text" class="color-value" />
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
              />
            </div>
            <div class="control-group">
              <label>Font Size</label>
              <input
                v-model="variables['--xc-connect-button-font-size']"
                type="text"
                class="input-text"
              />
            </div>
            <div class="control-group">
              <label>Font Weight</label>
              <input
                v-model="variables['--xc-connect-button-font-weight']"
                type="text"
                class="input-text"
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
              />
            </div>
            <div class="control-group">
              <label>Font Weight</label>
              <input
                v-model="variables['--xc-primary-button-font-weight']"
                type="text"
                class="input-text"
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
              />
            </div>
            <div class="control-group">
              <label>Font Weight</label>
              <input
                v-model="variables['--xc-secondary-button-font-weight']"
                type="text"
                class="input-text"
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
              />
            </div>
            <div class="control-group">
              <label>Box Shadow</label>
              <input v-model="variables['--xc-modal-box-shadow']" type="text" class="input-text" />
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
                />
                <input
                  v-model="variables['--xc-loading-border-color']"
                  type="text"
                  class="color-value"
                />
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>

    <!-- Code Modal -->
    <div v-if="showCodeModal" class="modal-overlay" @click="showCodeModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>CSS Variables</h3>
          <button class="close-btn" @click="showCodeModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="code-output">
            <pre><code>{{ generatedCSS }}</code></pre>
          </div>
        </div>
        <div class="modal-footer">
          <button class="copy-btn" @click="copyToClipboard">
            <svg
              v-if="!copied"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
              ></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
            <span v-if="!copied">Copy Code</span>
            <span v-else class="copied-text">✓ Copied!</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue';
import { useWallet } from '../.vitepress/composables/useWallet';

const copied = ref(false);
const showCodeModal = ref(false);

const { getWalletManager } = useWallet();

const defaultVariables = {
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
  '--xc-primary-button-border-radius': '8px',
  '--xc-primary-button-font-weight': '600',
  '--xc-secondary-button-border-radius': '8px',
  '--xc-secondary-button-font-weight': '500',
  '--xc-loading-border-color': '#3b82f6',
  '--xc-modal-background': '#F6F4EF',
  '--xc-modal-border-radius': '12px',
  '--xc-modal-box-shadow': '0 10px 40px rgba(0, 0, 0, 0.1)',
};

const variables = reactive({ ...defaultVariables });

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
        '--xc-loading-border-color',
      ].includes(key)
    )
  );
});

const computedStyles = computed(() => {
  return Object.entries(variables)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
});

const generatedCSS = computed(() => {
  const lines = Object.entries(variables)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');
  return `xrpl-wallet-connector {\n${lines}\n}`;
});

const formatLabel = (key) => {
  return key
    .replace('--xc-', '')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const copyToClipboard = async () => {
  await navigator.clipboard.writeText(generatedCSS.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
};

onMounted(async () => {
  try {
    const walletManager = await getWalletManager();

    // Set wallet manager on preview connector
    const connector = document.getElementById('theme-preview');
    if (connector && walletManager) {
      connector.setWalletManager(walletManager);
    }
  } catch (err) {
    console.error('Failed to initialize wallet for theme builder:', err);
  }
});
</script>

<style scoped>
.theme-builder {
  margin: 0;
  padding: 32px;
}

.builder-layout {
  display: flex;
  gap: 32px;
  max-width: 100%;
}

.preview-section {
  flex: 1;
  min-width: 400px;
  display: flex;
}

.preview-card {
  position: relative;
  padding: 2rem;
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  width: 100%;
  min-height: 500px;
  text-align: center;
}

#theme-preview {
  width: 100%;
  max-width: 320px;
  display: flex;
  justify-content: center;
}

.code-btn-preview {
  position: absolute;
  bottom: 1.5rem;
  left: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.code-btn-preview:hover {
  border-color: var(--vp-c-brand);
  background: var(--vp-c-brand);
  color: white;
}

.code-btn-preview svg {
  width: 16px;
  height: 16px;
}

/* VitePress-style Sidebar */
.controls-sidebar {
  width: 280px;
  flex-shrink: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.5rem;
  max-height: calc(100vh - 200px);
}

.controls-sidebar::-webkit-scrollbar {
  width: 6px;
}

.controls-sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.controls-sidebar::-webkit-scrollbar-thumb {
  background: var(--vp-c-divider);
  border-radius: 3px;
}

.controls-sidebar::-webkit-scrollbar-thumb:hover {
  background: var(--vp-c-text-2);
}

.sidebar-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-right: 0.5rem;
}

.control-section {
  padding: 0;
}

.control-section h4 {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
  font-weight: 600;
  letter-spacing: 0.05em;
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
  transition: all 0.2s;
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
  flex-shrink: 0;
}

.color-picker:hover {
  border-color: var(--vp-c-brand);
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
  transition: all 0.2s;
}

.color-value:focus {
  outline: none;
  border-color: var(--vp-c-brand);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--vp-c-bg);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vp-c-divider);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--vp-c-text-2);
  cursor: pointer;
  font-size: 1.5rem;
  transition: color 0.2s;
}

.close-btn:hover {
  color: var(--vp-c-text-1);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.code-output {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow-x: auto;
  padding: 1rem;
}

.code-output pre {
  margin: 0;
  background: transparent;
  padding: 0;
}

.code-output code {
  background: transparent;
  padding: 0;
  font-size: 0.875rem;
  line-height: 1.6;
  font-family: monospace;
  color: var(--vp-c-text-1);
  word-break: break-word;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid var(--vp-c-divider);
  display: flex;
  justify-content: flex-end;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.copy-btn:hover {
  border-color: var(--vp-c-brand);
  background: var(--vp-c-brand);
  color: white;
}

.copy-btn svg {
  width: 16px;
  height: 16px;
}

.copied-text {
  color: #10b981;
}

@media (max-width: 1440px) {
  .builder-layout {
    gap: 16px;
    padding: 24px;
  }

  .controls-sidebar {
    width: 240px;
  }
}

@media (max-width: 1024px) {
  .theme-builder {
    margin: 0;
  }

  .builder-layout {
    flex-direction: column;
    gap: 24px;
  }

  .preview-section {
    min-width: auto;
  }

  .controls-sidebar {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .color-input-group {
    flex-direction: column;
  }

  .color-picker {
    width: 100%;
  }

  .modal-content {
    max-width: 95vw;
    max-height: 90vh;
  }
}
</style>
