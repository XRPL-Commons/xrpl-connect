import * as crossmarkSDK from '@crossmarkio/sdk';
import type * as CrossmarkTypings from '@crossmarkio/typings/sdk';

/** A response returned by the Crossmark SDK. */
export type CrossmarkResponse = CrossmarkTypings.Models.FullResponse;

type CrossmarkTransaction = typeof CrossmarkTypings.Models.AllTransactionRequest;
type CrossmarkIndexedTransaction = typeof CrossmarkTypings.Models.IndexedTransactionRequest;
type CrossmarkSignOptions = typeof CrossmarkTypings.Models.ExtendedSignOpts;
type CrossmarkCryptOptions = typeof CrossmarkTypings.Models.CryptOpts;

/** Low-level Crossmark request transport. */
export interface CrossmarkRequestAPI {
  readonly sdk: CrossmarkClient;
  readonly active: Map<string, unknown>;
  readonly uuid: string;
  readonly connected: boolean;
  readonly target?: string;
  readonly timestamp?: number;
  awaitRequest(request: Partial<CrossmarkTypings.Models.Request>): Promise<CrossmarkResponse>;
  request(request: Partial<CrossmarkTypings.Models.Request>): string;
}

/** Runtime environment detected by Crossmark. */
export interface CrossmarkEnvironment {
  readonly isAndroid: boolean;
  readonly isIos: boolean;
  readonly isOpera: boolean;
  readonly isWindows: boolean;
  readonly isSSR: boolean;
  readonly isXApp: boolean;
  readonly isMobile: boolean;
  readonly isDesktop: boolean;
}

/** Crossmark extension discovery helper. */
export interface CrossmarkMount {
  readonly sdk: CrossmarkClient;
  readonly isDetected?: boolean;
  loop(timeout?: number): Promise<boolean>;
  on(event: string, listener: (...args: unknown[]) => void): this;
  off(event: string, listener: (...args: unknown[]) => void): this;
}

/** Current Crossmark wallet session. */
export interface CrossmarkSession {
  readonly sdk: CrossmarkClient;
  readonly user?: typeof CrossmarkTypings.BasicUser;
  readonly network?: typeof CrossmarkTypings.BasicNetwork;
  readonly address?: string;
  readonly isOpen: boolean;
  readonly lastPing?: number;
  readonly state: 'active' | 'unactive' | 'error';
  readonly responses: Map<string, CrossmarkResponse>;
  handleDetect(): Promise<void>;
  handlePing(): number;
  handleClose(): boolean;
  handleOpen(): boolean;
  handleSignOut(): void;
  handleNetworkChange(network: { network: typeof CrossmarkTypings.BasicNetwork }): void;
  handleUserChange(user: { user: typeof CrossmarkTypings.BasicUser }): void;
  handleResponse(response: CrossmarkResponse): void;
}

/** Promise-based Crossmark methods. */
export interface CrossmarkAsyncMethods {
  readonly sdk: CrossmarkClient;
  readonly api: CrossmarkRequestAPI;
  readonly session: CrossmarkSession;
  readonly mount: CrossmarkMount;
  signInAndWait(hex?: string): Promise<typeof CrossmarkTypings.Models.SignInFullResponse>;
  signAndWait(
    transaction: CrossmarkTransaction,
    options?: CrossmarkSignOptions
  ): Promise<typeof CrossmarkTypings.Models.SignFullResponse>;
  submitAndWait(
    address: string,
    transactionBlob: string,
    options?: CrossmarkSignOptions
  ): Promise<typeof CrossmarkTypings.Models.SubmitFullResponse>;
  signAndSubmitAndWait(
    transaction: CrossmarkTransaction,
    options?: CrossmarkSignOptions
  ): Promise<typeof CrossmarkTypings.Models.SignAndSubmitFullResponse>;
  bulkSignAndWait(
    transactions: CrossmarkIndexedTransaction[],
    options?: CrossmarkSignOptions
  ): Promise<typeof CrossmarkTypings.Models.BulkSignFullResponse>;
  bulkSubmitAndWait(
    address: string,
    transactionBlobs: string[],
    options?: CrossmarkSignOptions
  ): Promise<typeof CrossmarkTypings.Models.BulkSubmitFullResponse>;
  bulkSignAndSubmitAndWait(
    transactions: CrossmarkIndexedTransaction[],
    options?: CrossmarkSignOptions
  ): Promise<typeof CrossmarkTypings.Models.BulkSignAndSubmitFullResponse>;
  readonly encryptAndWait: {
    aes(
      address: string,
      data: string,
      options?: CrossmarkCryptOptions
    ): Promise<typeof CrossmarkTypings.Models.EncryptFullResponse>;
  };
  readonly decryptAndAwait: {
    aes(
      address: string,
      hex: string,
      options?: CrossmarkCryptOptions
    ): Promise<typeof CrossmarkTypings.Models.DecryptFullResponse>;
  };
  isLockedAndWait(): Promise<typeof CrossmarkTypings.Models.IsLockedFullResponse>;
  versionAndWait(): Promise<typeof CrossmarkTypings.Models.VersionFullResponse>;
  verifyAndWait(hex: string): Promise<typeof CrossmarkTypings.Models.VerifyFullResponse>;
  connect(timeout?: number): Promise<boolean>;
  detect(timeout?: number): Promise<boolean>;
}

/** Synchronous Crossmark request and state methods. */
export interface CrossmarkSyncMethods {
  readonly sdk: CrossmarkClient;
  readonly api: CrossmarkRequestAPI;
  readonly session: CrossmarkSession;
  readonly mount: CrossmarkMount;
  signIn(hex?: string): string;
  sign(transaction: CrossmarkTransaction, options?: CrossmarkSignOptions): string;
  submit(address: string, transactionBlob: string, options?: CrossmarkSignOptions): string;
  signAndSubmit(transaction: CrossmarkTransaction, options?: CrossmarkSignOptions): string;
  bulkSign(transactions: CrossmarkIndexedTransaction[], options?: CrossmarkSignOptions): string;
  bulkSubmit(address: string, transactionBlobs: string[], options?: CrossmarkSignOptions): string;
  bulkSignAndSubmit(
    transactions: CrossmarkIndexedTransaction[],
    options?: CrossmarkSignOptions
  ): string;
  readonly encrypt: {
    aes(address: string, data: string, options?: CrossmarkCryptOptions): string;
  };
  readonly decrypt: {
    aes(address: string, hex: string, options?: CrossmarkCryptOptions): string;
  };
  getResponse(id: string): CrossmarkResponse | undefined;
  isConnected(): boolean | undefined;
  isInstalled(): boolean | undefined;
  isLocked(): string;
  isOpen(): boolean;
  version(): string;
  verify(hex: string): string;
  getAddress(): string | undefined;
  getNetwork(): typeof CrossmarkTypings.BasicNetwork | undefined;
  getUser(): typeof CrossmarkTypings.BasicUser | undefined;
}

/** Complete Crossmark client surface. */
export interface CrossmarkClient {
  readonly mount: CrossmarkMount;
  readonly api: CrossmarkRequestAPI;
  readonly session: CrossmarkSession;
  readonly env: CrossmarkEnvironment;
  readonly async: CrossmarkAsyncMethods;
  readonly sync: CrossmarkSyncMethods;
  readonly methods: CrossmarkAsyncMethods & CrossmarkSyncMethods;
  readonly app: string;
  on(event: typeof CrossmarkTypings.EVENTS.PING, listener: () => void): this;
  on(event: typeof CrossmarkTypings.EVENTS.CLOSE, listener: () => void): this;
  on(event: typeof CrossmarkTypings.EVENTS.OPEN, listener: () => void): this;
  on(event: typeof CrossmarkTypings.EVENTS.SIGNOUT, listener: () => void): this;
  on(
    event: typeof CrossmarkTypings.EVENTS.USER_CHANGE,
    listener: (user: typeof CrossmarkTypings.BasicUser) => void
  ): this;
  on(
    event: typeof CrossmarkTypings.EVENTS.NETWORK_CHANGE,
    listener: (network: typeof CrossmarkTypings.BasicNetwork) => void
  ): this;
  on(
    event: typeof CrossmarkTypings.EVENTS.RESPONSE,
    listener: (response: CrossmarkTypings.Models.Response) => void
  ): this;
  on(
    event: typeof CrossmarkTypings.EVENTS.ALL,
    listener: (event: typeof CrossmarkTypings.CatchAllEvent) => void
  ): this;
  on(event: string, listener: (...args: unknown[]) => void): this;
  once(event: string, listener: (...args: unknown[]) => void): this;
  off(event: string, listener: (...args: unknown[]) => void): this;
  removeListener(event: string, listener: (...args: unknown[]) => void): this;
  emit(event: string, ...args: unknown[]): boolean;
}

/** Constructor exported by the upstream SDK as `vanilla`. */
export interface CrossmarkClientConstructor {
  new (options?: { project: string }): CrossmarkClient;
}

/** Collision-safe namespace mirroring every runtime export from `@crossmarkio/sdk`. */
export interface CrossmarkSDKNamespace {
  readonly default: CrossmarkClient;
  readonly modules: {
    readonly embark: CrossmarkClient;
    readonly xmark: CrossmarkClient;
  };
  readonly typings: typeof CrossmarkTypings;
  readonly vanilla: CrossmarkClientConstructor;
}

/**
 * Complete Crossmark runtime SDK.
 *
 * A local structural type keeps the facade compatible with strict NodeNext
 * consumers; the upstream package's declarations reference private subpaths
 * that TypeScript cannot resolve through its `exports` map.
 */
export const CrossmarkSDK = crossmarkSDK as unknown as CrossmarkSDKNamespace;
