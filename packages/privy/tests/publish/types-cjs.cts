import {
  PrivyAdapter,
  type PrivyAdapterOptions,
  type PrivyConnectOptions,
  type PrivyLoginMethod,
  type PrivyOAuthProvider,
  type PrivyTransactionReviewOption,
} from '@xrpl-commons/xrpl-connect-privy';
import {
  WalletManager,
  type ConnectOptions,
  type WalletAdapter,
  type WalletAuthPrompt,
  type WalletLoginMethod,
  type WalletTransactionReview,
} from 'xrpl-connect';

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
const reviewTransaction: PrivyTransactionReviewOption = async (
  review: WalletTransactionReview,
  signal: AbortSignal
) => {
  signal.throwIfAborted();
  return review.action === 'sign' && review.details.every(({ label, value }) => label && value);
};
const adapterOptions: PrivyAdapterOptions = {
  appId: 'publish-smoke-test',
  redirectUri: 'https://example.test/wallet/privy',
  loginMethods: [{ id: 'apple', oauthProvider }, customLoginMethod],
  transactionReview: reviewTransaction,
};
const adapter = new PrivyAdapter(adapterOptions);
const connectOptions: ConnectOptions<PrivyConnectOptions> = {
  loginMethod: 'apple',
};
const manager = new WalletManager({ adapters: [adapter], network: 'testnet' });
void manager.connect('privy', connectOptions);

const dashboardAdapter: WalletAdapter = new PrivyAdapter({
  appId: 'publish-smoke-test',
  redirectUri: 'https://example.test/wallet/privy',
});
const discoveredMethods: Promise<readonly WalletLoginMethod[]> | undefined =
  dashboardAdapter.getLoginMethods?.();
const unsubscribe = dashboardAdapter.onAuthPrompt?.((prompt: WalletAuthPrompt | null) => {
  if (prompt?.captcha) void prompt.captcha.siteKey;
  if (prompt?.fields) void prompt.fields[0]?.inputMode;
  if (prompt?.review) void prompt.review.network.id;
});
void discoveredMethods;
unsubscribe?.();
