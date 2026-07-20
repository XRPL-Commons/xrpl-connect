import {
  CrossmarkSDK,
  GemWalletAPI,
  WalletConnectorElement,
  XamanOAuth2,
  XamanSDK,
  type AccountInfo,
  type ConnectOptions,
  type CrossmarkClient,
  type LedgerConnectOptions,
  type WalletConnectConnectOptions,
  type WalletConnectorElementInstance,
  type XamanConnectOptions,
  type XyraConnectOptions,
} from 'xrpl-connect';

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

void [
  connectOptions,
  xamanConstructor,
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
];
