import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { build } from 'vite';

const temporaryRoot = mkdtempSync(path.join(process.cwd(), '.xrpl-connect-register-consumer-'));
const appRoot = path.join(temporaryRoot, 'app');
const outputRoot = path.join(temporaryRoot, 'dist');

try {
  mkdirSync(appRoot, { recursive: true });
  mkdirSync(path.join(appRoot, 'src'), { recursive: true });
  writeFileSync(
    path.join(appRoot, 'index.html'),
    '<!doctype html><html><body><script type="module" src="/src/main.js"></script></body></html>\n'
  );
  writeFileSync(
    path.join(appRoot, 'src/main.js'),
    "import 'xrpl-connect/register';\n"
  );

  await build({
    root: appRoot,
    build: {
      outDir: outputRoot,
      emptyOutDir: true,
      target: 'es2022',
      minify: 'esbuild',
    },
  });

  const assetName = readdirSync(path.join(outputRoot, 'assets')).find((name) => name.endsWith('.js'));
  assert(assetName, 'The optimized registration consumer did not emit a JavaScript asset');
  const asset = readFileSync(path.join(outputRoot, 'assets', assetName), 'utf8');
  assert.match(asset, /customElements\.define/);
  for (const adapterRuntimeMarker of [
    'XummSdk',
    'XummPkce',
    '@crossmarkio',
    '@gemwallet',
    '@walletconnect/sign-client',
    '@xyrawallet/sdk',
    'XamanAdapter',
    'CrossmarkAdapter',
    'GemWalletAdapter',
    'WalletConnectAdapter',
    'MetaMaskSnapAdapter',
  ]) {
    assert(!asset.includes(adapterRuntimeMarker), `The registration consumer bundled ${adapterRuntimeMarker}`);
  }

  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    runScripts: 'outside-only',
    url: 'https://register-consumer.test/',
  });
  try {
    dom.window.TextEncoder = TextEncoder;
    dom.window.TextDecoder = TextDecoder;
    dom.window.eval(asset);
    const element = dom.window.document.createElement('xrpl-wallet-connector');
    assert.equal(typeof element.openAndWait, 'function');
  } finally {
    dom.window.close();
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
