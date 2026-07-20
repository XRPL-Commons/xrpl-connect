import { MetaMaskSnapAdapter, type MetaMaskSnapAdapterOptions } from '../src/index.js';

interface ExistingInjectedProvider {
  request(args: { method: string }): Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: ExistingInjectedProvider;
  }
}

const options: MetaMaskSnapAdapterOptions = { snapId: 'local:http://localhost:8080' };
const adapter = new MetaMaskSnapAdapter(options);

void adapter;
