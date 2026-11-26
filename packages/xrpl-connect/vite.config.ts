import { build as viteBuild, defineConfig, transformWithEsbuild } from 'vite-plus';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import inject from '@rollup/plugin-inject';
import { createPackConfig } from '../../vite.pack.config';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const adapterAliases = {
  '@xrpl-connect/adapter-xaman': resolve(__dirname, '../adapters/xaman/src/index.ts'),
  '@xrpl-connect/adapter-crossmark': resolve(__dirname, '../adapters/crossmark/src/index.ts'),
  '@xrpl-connect/adapter-gemwallet': resolve(__dirname, '../adapters/gemwallet/src/index.ts'),
  '@xrpl-connect/adapter-walletconnect': resolve(
    __dirname,
    '../adapters/walletconnect/src/index.ts'
  ),
  '@xrpl-connect/adapter-ledger': resolve(__dirname, '../adapters/ledger/src/index.ts'),
  '@xrpl-connect/adapter-xyra': resolve(__dirname, '../adapters/xyra/src/index.ts'),
  '@xrpl-connect/adapter-ghostsig': resolve(__dirname, '../adapters/ghostsig/src/index.ts'),
  '@xrpl-connect/adapter-otsu': resolve(__dirname, '../adapters/otsu/src/index.ts'),
  '@xrpl-connect/adapter-metamask-snap': resolve(
    __dirname,
    '../adapters/metamask-snap/src/index.ts'
  ),
};

const subpathEntries = {
  core: resolve(__dirname, 'src/core.ts'),
  ui: resolve(__dirname, 'src/ui.ts'),
  register: resolve(__dirname, 'src/register.ts'),
  xaman: resolve(__dirname, 'src/xaman.ts'),
  crossmark: resolve(__dirname, 'src/crossmark.ts'),
  gemwallet: resolve(__dirname, 'src/gemwallet.ts'),
  walletconnect: resolve(__dirname, 'src/walletconnect.ts'),
  ledger: resolve(__dirname, 'src/ledger.ts'),
  xyra: resolve(__dirname, 'src/xyra.ts'),
  ghostsig: resolve(__dirname, 'src/ghostsig.ts'),
  otsu: resolve(__dirname, 'src/otsu.ts'),
  'metamask-snap': resolve(__dirname, 'src/metamask-snap.ts'),
};

const sharedEntries = {
  'xrpl-connect': resolve(__dirname, 'src/index.ts'),
  ...subpathEntries,
};

function normalizeMockedWebSocketConstructor(code: string): string {
  // Rolldown rewrites xumm-sdk's guarded constructor to `new
  // (globalThis?.MockedWebSocket)`, which Nuxt's production parser rejects.
  // The preceding type guard guarantees the property exists here.
  return code.replace(
    /new\s*\(\s*globalThis\?\.MockedWebSocket\s*\)/g,
    'new globalThis.MockedWebSocket'
  );
}

function findEsmFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return findEsmFiles(entryPath);
    return entry.name.endsWith('.mjs') ? [entryPath] : [];
  });
}

/**
 * Rolldown currently panics when preserving named exports for a multi-entry
 * CommonJS build. The ESM graph is the source of truth; transpiling its files
 * keeps the same chunk topology (and therefore constructor identity) for
 * CommonJS consumers without running a second bundling graph.
 */
async function emitCommonJsGraph() {
  const publishDir = resolve(__dirname, 'dist-publish');
  const esmFiles = findEsmFiles(publishDir);
  await Promise.all(
    esmFiles.map(async (esmPath) => {
      const { code } = await transformWithEsbuild(
        readFileSync(esmPath, 'utf8'),
        esmPath,
        { format: 'cjs', target: 'node20', sourcemap: false }
      );
      writeFileSync(
        esmPath.replace(/\.mjs$/, '.js'),
        code.replace(/\.mjs(?=["'])/g, '.js')
      );
    })
  );
}

async function buildSharedEntries() {
  await viteBuild({
    configFile: false,
    root: __dirname,
    resolve: {
      alias: {
        '@xrpl-connect/core': resolve(__dirname, '../core/src/index.ts'),
        '@xrpl-connect/ui': resolve(__dirname, '../ui/src/index.ts'),
        ...adapterAliases,
      },
    },
    define: { define: 'undefined' },
    plugins: [
      inject({ Buffer: ['buffer', 'Buffer'] }),
      {
        name: 'normalize-shared-xumm-mocked-websocket-constructor',
        generateBundle(_options, bundle) {
          for (const output of Object.values(bundle)) {
            if (output.type === 'chunk') {
              output.code = normalizeMockedWebSocketConstructor(output.code);
            }
          }
        },
      },
      {
        name: 'shared-entry-svg-as-text',
        enforce: 'pre',
        load(id) {
          const path = id.split('?')[0];
          if (path.endsWith('.svg')) {
            return `export default ${JSON.stringify(readFileSync(path, 'utf-8'))};`;
          }
        },
      },
    ],
    build: {
      outDir: resolve(__dirname, 'dist-publish'),
      emptyOutDir: false,
      rollupOptions: {
        input: sharedEntries,
        external: ['xrpl'],
        preserveEntrySignatures: 'strict',
        output: {
          format: 'es',
          entryFileNames: '[name].mjs',
          chunkFileNames: 'chunks/[name]-[hash].mjs',
        },
      },
    },
  });
  await emitCommonJsGraph();
}

/**
 * Vite config for publishing a fully-bundled version of xrpl-connect
 * This bundles all dependencies (including Buffer polyfill) into a single file suitable for npm
 *
 * Usage: vp build -c vite.config.ts
 */
export default defineConfig({
  pack: createPackConfig({
    entry: ['src/index.ts', ...Object.keys(subpathEntries).map((name) => `src/${name}.ts`)],
    deps: {
      neverBundle: [
        'xrpl',
        '@xrpl-connect/core',
        '@xrpl-connect/ui',
        '@xrpl-connect/adapter-xaman',
        '@xrpl-connect/adapter-crossmark',
        '@xrpl-connect/adapter-gemwallet',
        '@xrpl-connect/adapter-walletconnect',
        '@xrpl-connect/adapter-xyra',
        '@xrpl-connect/adapter-ghostsig',
        '@xrpl-connect/adapter-otsu',
        '@xrpl-connect/adapter-ledger',
      ],
    },
  }),
  resolve: {
    alias: {
      '@xrpl-connect/core': resolve(__dirname, '../core/src/index.ts'),
      '@xrpl-connect/ui': resolve(__dirname, '../ui/src/index.ts'),
      ...adapterAliases,
    },
  },
  // Bundled CommonJS dependencies keep UMD fallbacks for an AMD loader (crypto-js, fetch-ponyfill,
  // qr-code-styling). Consumer bundlers such as Turbopack try to resolve their dependencies
  // (`define(["./core"], ...)`), and fetch-ponyfill would hand its export to a page's AMD loader.
  // With no AMD loader in scope these branches are dropped; the UMD build keeps its own wrapper.
  define: {
    define: 'undefined',
  },
  plugins: [
    {
      name: 'normalize-xumm-mocked-websocket-constructor',
      generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type !== 'chunk') continue;
          output.code = normalizeMockedWebSocketConstructor(output.code);
        }
      },
    },
    // Match the per-adapter pack config (`loader: { '.svg': 'text' }`). Without
    // this, Vite's default asset handler resolves `.svg` imports to a
    // `data:image/svg+xml,...` URL, and each adapter's
    // `data:image/svg+xml,${encodeURIComponent(iconSvg)}` wrapper then
    // double-encodes it into an unrenderable URI.
    {
      name: 'svg-as-text',
      enforce: 'pre',
      load(id) {
        const path = id.split('?')[0];
        if (path.endsWith('.svg')) {
          const source = readFileSync(path, 'utf-8');
          return `export default ${JSON.stringify(source)};`;
        }
      },
    },
    {
      name: 'copy-readme',
      async closeBundle() {
        await buildSharedEntries();
        const rootReadmePath = resolve(__dirname, '../../README.md');
        const distReadmePath = resolve(__dirname, 'dist-publish/README.md');

        if (existsSync(rootReadmePath)) {
          copyFileSync(rootReadmePath, distReadmePath);
          console.log('✓ Copied README.md to dist-publish/');
        }
      },
    },
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'XRPLConnect',
      formats: ['umd'],
      fileName: (format) => {
        if (format === 'es') return 'xrpl-connect.mjs';
        return 'xrpl-connect.umd.js';
      },
    },
    rollupOptions: {
      external: ['xrpl'],
      output: {
        // Provide global variables to use in the UMD build for externalized deps
        globals: {
          xrpl: 'xrpl',
        },
      },
      plugins: [
        inject({
          Buffer: ['buffer', 'Buffer'],
        }),
      ],
    },
    outDir: 'dist-publish',
    emptyOutDir: true,
  },
});
