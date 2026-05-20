import { defineConfig } from 'tsup';
import { createTsupConfig } from '../../../tsup.base.config';

export default defineConfig(
  createTsupConfig({
    external: ['xrpl'],
  })
);
