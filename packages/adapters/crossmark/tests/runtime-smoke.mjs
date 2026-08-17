import { createRequire } from 'node:module';

delete globalThis.window;
delete globalThis.document;

await import('../dist/index.mjs');
createRequire(import.meta.url)('../dist/index.js');
process.exit(0);
