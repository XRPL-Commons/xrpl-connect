import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../dist/index.js');
await import('../dist/index.mjs');
