import { copyFileSync, unlinkSync } from 'node:fs';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';

const projectFolder = new URL('..', import.meta.url).pathname;
const config = ExtractorConfig.prepare({
  configObjectFullPath: new URL('../api-extractor.json', import.meta.url).pathname,
  packageJsonFullPath: new URL('../package.json', import.meta.url).pathname,
  configObject: {
    projectFolder,
    mainEntryPointFilePath: '<projectFolder>/dist/index.d.ts',
    bundledPackages: ['@xrpl-connect/core', 'eventemitter3'],
    compiler: { tsconfigFilePath: '<projectFolder>/tsconfig.json' },
    dtsRollup: {
      enabled: true,
      untrimmedFilePath: '<projectFolder>/dist/index.rollup.d.ts',
    },
    apiReport: { enabled: false },
    docModel: { enabled: false },
    tsdocMetadata: { enabled: false },
  },
});

const result = Extractor.invoke(config, { localBuild: true, showVerboseMessages: false });
if (!result.succeeded || result.warningCount > 0) {
  throw new Error(
    `React declaration rollup failed with ${result.errorCount} errors and ${result.warningCount} warnings`
  );
}

const rolledDeclaration = new URL('../dist/index.rollup.d.ts', import.meta.url);
copyFileSync(rolledDeclaration, new URL('../dist/index.d.ts', import.meta.url));
copyFileSync(rolledDeclaration, new URL('../dist/index.d.mts', import.meta.url));
unlinkSync(rolledDeclaration);

console.log('✓ Rolled bundled core types into the React declarations');
