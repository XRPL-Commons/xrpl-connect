import {
  CrossmarkSDK,
  ADAPTER_DESCRIPTORS,
  STANDARD_WALLET_IDS,
  WALLET_CONNECTOR_CSS_VARIABLES,
  createAdapters,
  GemWalletAPI,
  MetaMaskSnapAdapter,
  WalletConnectAdapter,
  WalletManager,
  XamanAdapter,
  WalletConnectorElement,
  XamanOAuth2,
  XamanSDK,
  type AccountInfo,
  type ConnectOptions,
  type CrossmarkClient,
  type LedgerConnectOptions,
  type MetaMaskSnapAdapterOptions,
  type WalletId,
  type WalletIdentifier,
  type WalletConnectConnectOptions,
  type WalletConnectorCssVariable,
  type WalletConnectorCssVars,
  type WalletConnectorElementInstance,
  type XamanConnectOptions,
  type XamanReturnUrl,
  type XyraConnectOptions,
} from 'xrpl-connect';

interface TypedCustomWalletOptions {
  credential: string;
}

declare module 'xrpl-connect' {
  interface WalletConnectionOptionsById {
    'typed-custom-wallet': TypedCustomWalletOptions;
  }
}

const standardWalletId: WalletId = STANDARD_WALLET_IDS[0];
const customWalletId: WalletIdentifier = 'custom-wallet';
const cssVariable: WalletConnectorCssVariable = WALLET_CONNECTOR_CSS_VARIABLES[0];
const cssVars: WalletConnectorCssVars = { '--xc-primary-color': '#7c3aed' };
const invalidCssVars: WalletConnectorCssVars = {
  // @ts-expect-error Published customization types reject unsupported variables.
  '--xc-primary-colro': '#7c3aed',
};
// @ts-expect-error WalletId is the literal union of packaged adapter IDs.
const invalidStandardWalletId: WalletId = 'custom-wallet';
const descriptorWalletId: WalletId = ADAPTER_DESCRIPTORS[0].id;
const packagedAdapters = createAdapters({
  xaman: { apiKey: 'api-key' },
  walletconnect: { projectId: 'project-id' },
});
const manager = new WalletManager({ adapters: packagedAdapters });
const configuredXaman = new XamanAdapter({ apiKey: 'api-key' });
const deferredXaman = new XamanAdapter();
const configuredWalletConnect = new WalletConnectAdapter({ projectId: 'project-id' });
const deferredWalletConnect = new WalletConnectAdapter();
// @ts-expect-error Xaman constructor options do not accept a WalletConnect project ID.
new XamanAdapter({ projectId: 'project-id' });
// @ts-expect-error WalletConnect constructor options do not accept a Xaman API key.
new WalletConnectAdapter({ apiKey: 'api-key' });
void manager.connect('xaman', { apiKey: 'api-key' });
void manager.connect('walletconnect', { projectId: 'project-id' });
// @ts-expect-error Xaman deferred options do not accept a WalletConnect project ID.
void manager.connect('xaman', { projectId: 'project-id' });
// @ts-expect-error WalletConnect deferred options do not accept a Xaman API key.
void manager.connect('walletconnect', { apiKey: 'api-key' });
void manager.connect('custom-wallet', { customCredential: 'credential' });
void manager.connect('typed-custom-wallet', { credential: 'credential' });
// @ts-expect-error Interface-shaped custom mappings reject unrelated options.
void manager.connect('typed-custom-wallet', { otherCredential: 'credential' });
// @ts-expect-error WalletConnect constructor options do not accept a Xaman API key.
createAdapters({ walletconnect: { apiKey: 'api-key' } });

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
  cssVariable,
  cssVars,
  invalidCssVars,
  invalidStandardWalletId,
  descriptorWalletId,
  packagedAdapters,
  manager,
  configuredXaman,
  deferredXaman,
  configuredWalletConnect,
  deferredWalletConnect,
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
