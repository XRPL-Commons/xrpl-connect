import {
  PrivyAdapter,
  type PrivyAdapterOptions,
  type PrivyConnectOptions,
  type PrivyLoginMethod,
  type PrivyOAuthProvider,
} from '@xrpl-commons/xrpl-connect-privy';
import { WalletManager, type ConnectOptions } from 'xrpl-connect';

declare module 'xrpl-connect' {
  interface WalletConnectionOptionsById {
    privy: PrivyConnectOptions;
  }
}

const oauthProvider: PrivyOAuthProvider = 'apple';
const customLoginMethod: PrivyLoginMethod = {
  id: 'company',
  getCustomToken: async (signal) => {
    signal.throwIfAborted();
    return 'publish-smoke-token';
  },
};
const adapterOptions: PrivyAdapterOptions = {
  appId: 'publish-smoke-test',
  redirectUri: 'https://example.test/wallet/privy',
  loginMethods: [{ id: 'apple', oauthProvider }, customLoginMethod],
};
const adapter = new PrivyAdapter(adapterOptions);
const connectOptions: ConnectOptions<PrivyConnectOptions> = {
  loginMethod: 'apple',
};
const manager = new WalletManager({ adapters: [adapter], network: 'testnet' });
void manager.connect('privy', connectOptions);
