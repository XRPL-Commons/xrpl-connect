import { defineConfig } from 'tsup';
import { createTsupConfig } from '../../tsup.base.config';

// Keep React external, but bundle the core runtime so importing this package is
// safe in server environments where wallet SDKs have browser-only side effects.
export default defineConfig(
  createTsupConfig({
    external: ['react', 'react-dom', 'react/jsx-runtime'],
  })
);
