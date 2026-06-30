import { defineConfig } from 'tsup';
import { createTsupConfig } from '../../tsup.base.config';

// React bindings are a thin layer over `xrpl-connect`; keep React and the
// meta-package external so consumers resolve them from their own install.
export default defineConfig(
  createTsupConfig({
    external: ['react', 'react-dom', 'react/jsx-runtime', 'xrpl-connect'],
  })
);
