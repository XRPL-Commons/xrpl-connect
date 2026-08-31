import {
  CrossmarkSDK,
  ADAPTER_DESCRIPTORS,
  STANDARD_WALLET_IDS,
  createAdapters,
  GemWalletAPI,
  MetaMaskSnapAdapter,
  WalletConnectorElement,
  XamanOAuth2,
  XamanSDK,
  type AccountInfo,
  type ConnectOptions,
  type CrossmarkClient,
  type LedgerConnectOptions,
  type MetaMaskSnapAdapterOptions,
  type NetworkConfig,
  type NetworkInfo,
  type StandardNetworkId,
  type WalletId,
  type WalletIdentifier,
  type WalletConnectConnectOptions,
  type WalletConnectorElementInstance,
  type XamanConnectOptions,
  type XamanReturnUrl,
  type XyraConnectOptions,
} from 'xrpl-connect';

const standardNetworkId: StandardNetworkId = 'mainnet';
const standardWalletId: WalletId = STANDARD_WALLET_IDS[0];
const customWalletId: WalletIdentifier = 'custom-wallet';
// @ts-expect-error WalletId is the literal union of packaged adapter IDs.
const invalidStandardWalletId: WalletId = 'custom-wallet';
const descriptorWalletId: WalletId = ADAPTER_DESCRIPTORS[0].id;
const packagedAdapters = createAdapters({
  xaman: { apiKey: 'api-key' },
  walletconnect: { projectId: 'project-id' },
  ledger: { accountIndex: 1 },
});
// @ts-expect-error Xaman constructor options do not accept a WalletConnect project ID.
createAdapters({ xaman: { projectId: 'project-id' } });
const standardNetworkConfig: NetworkConfig = standardNetworkId;
const customNetwork: NetworkInfo = {
  id: 'sidechain',
  name: 'Sidechain',
  wss: 'wss://sidechain.example.com',
};
const customNetworkConfig: NetworkConfig = customNetwork;
// @ts-expect-error Arbitrary string IDs must not survive the published declaration rollup.
const invalidNetworkConfig: NetworkConfig = 'sidechain';

const connectOptions: [
  ConnectOptions<LedgerConnectOptions>,
  ConnectOptions<WalletConnectConnectOptions>,
  ConnectOptions<XamanConnectOptions>,
  ConnectOptions<XyraConnectOptions>,
] = [
  { accountIndex: 0 },
  { projectId: 'project-id' },
  { apiKey: 'api-key' },
  { walletUrl: 'https://wallet.xyra.now' },
];

const xamanConstructor: typeof XamanSDK.Xumm = XamanSDK.Xumm;
const xamanReturnUrl: XamanReturnUrl = {
  app: 'myapp://wallet',
  web: 'https://example.com/wallet',
};
const oauthConstructor: typeof XamanOAuth2.XummPkce = XamanOAuth2.XummPkce;
const crossmarkSignIn: typeof CrossmarkSDK.default.methods.signInAndWait =
  CrossmarkSDK.default.methods.signInAndWait;
const crossmarkTransaction = {} as typeof CrossmarkSDK.typings.Models.AllTransactionRequest;
const crossmarkSignResponse: Promise<typeof CrossmarkSDK.typings.Models.SignFullResponse> =
  CrossmarkSDK.default.methods.signAndWait(crossmarkTransaction);
const crossmarkResponseEvent: typeof CrossmarkSDK.typings.EVENTS.RESPONSE =
  CrossmarkSDK.typings.EVENTS.RESPONSE;
CrossmarkSDK.default.on(crossmarkResponseEvent, (response) => {
  const typedResponse: typeof CrossmarkSDK.typings.Models.Response = response;
  void typedResponse;
});
const crossmarkNetworkListener = (network: typeof CrossmarkSDK.typings.BasicNetwork) =>
  void network;
CrossmarkSDK.default.on(CrossmarkSDK.typings.EVENTS.NETWORK_CHANGE, crossmarkNetworkListener);
CrossmarkSDK.default.off(CrossmarkSDK.typings.EVENTS.NETWORK_CHANGE, crossmarkNetworkListener);
CrossmarkSDK.default.addListener('custom', crossmarkNetworkListener);
CrossmarkSDK.default.api.on('response', crossmarkNetworkListener);
CrossmarkSDK.default.mount.addListener('detected', () => {});
CrossmarkSDK.default.api.active.get('request-id')?.resolve(undefined);
CrossmarkSDK.default.listeners('custom')[0]?.({ network: 'xrpl' });
const gemWalletGetAddress: typeof GemWalletAPI.getAddress = GemWalletAPI.getAddress;
const crossmarkClient: CrossmarkClient = CrossmarkSDK.default;
const xamanEvent = {} as XamanSDK.UniversalSdkEvent;
const oauthFlow = {} as XamanOAuth2.ResolvedFlow;
const gemWalletRequest = {} as GemWalletAPI.SendPaymentRequest;
const walletConnector: WalletConnectorElementInstance =
  document.createElement('xrpl-wallet-connector');
const pendingAccount: Promise<AccountInfo> = walletConnector.openAndWait();
const walletConnectorConstructor: {
  new (): WalletConnectorElementInstance;
  readonly prototype: WalletConnectorElementInstance;
} | null = WalletConnectorElement;
const metamaskOptions: MetaMaskSnapAdapterOptions = {
  snapId: 'local:http://localhost:8080',
};
const metamaskAdapter = new MetaMaskSnapAdapter(metamaskOptions);

void [
  connectOptions,
  standardWalletId,
  customWalletId,
  invalidStandardWalletId,
  descriptorWalletId,
  packagedAdapters,
  standardNetworkConfig,
  customNetworkConfig,
  invalidNetworkConfig,
  xamanConstructor,
  xamanReturnUrl,
  oauthConstructor,
  crossmarkSignIn,
  crossmarkSignResponse,
  crossmarkResponseEvent,
  gemWalletGetAddress,
  crossmarkClient,
  xamanEvent,
  oauthFlow,
  gemWalletRequest,
  walletConnector,
  pendingAccount,
  walletConnectorConstructor,
  metamaskOptions,
  metamaskAdapter,
];
