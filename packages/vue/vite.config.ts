import { defineConfig } from 'vite-plus';
import { createPackConfig } from '../../vite.pack.config';

export default defineConfig({
  pack: createPackConfig({
    deps: { neverBundle: ['vue'] },
  }),
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
