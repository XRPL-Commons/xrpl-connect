import { defineConfig } from 'vite-plus';
import { createPackConfig } from '../../vite.pack.config';

export default defineConfig({
  pack: createPackConfig({
    deps: { neverBundle: ['react', 'react-dom', 'react/jsx-runtime'] },
  }),
});
