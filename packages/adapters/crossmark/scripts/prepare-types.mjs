import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const chromeTypesReference = '/// <reference types="chrome" />\n';

for (const fileName of ['index.d.ts', 'index.d.mts']) {
  const declarationUrl = new URL(`../dist/${fileName}`, import.meta.url);
  if (!existsSync(declarationUrl)) {
    throw new Error(`Missing Crossmark declaration output: dist/${fileName}`);
  }

  const declaration = readFileSync(declarationUrl, 'utf8');
  if (!declaration.startsWith(chromeTypesReference)) {
    writeFileSync(declarationUrl, chromeTypesReference + declaration);
  }
}

console.log('✓ Added the Chrome type reference to Crossmark declarations');
