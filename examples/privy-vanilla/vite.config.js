import { defineConfig } from 'vite-plus';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({ plugins: [nodePolyfills({ include: ['buffer'] })] });
