import type { WalletAdapter } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';
import { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';
import { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';
import { LedgerAdapter } from '@xrpl-connect/adapter-ledger';
import { XyraAdapter } from '@xrpl-connect/adapter-xyra';
import { OtsuAdapter } from '@xrpl-connect/adapter-otsu';
import { MetaMaskSnapAdapter } from '@xrpl-connect/adapter-metamask-snap';

/** Constructors for every adapter included in the umbrella package. */
export const Adapters = {
  Xaman: XamanAdapter,
  Crossmark: CrossmarkAdapter,
  GemWallet: GemWalletAdapter,
  WalletConnect: WalletConnectAdapter,
  Ledger: LedgerAdapter,
  Xyra: XyraAdapter,
  Otsu: OtsuAdapter,
  MetaMaskSnap: MetaMaskSnapAdapter,
} as const;

export type AdapterExportKey = keyof typeof Adapters;
export type AdapterAvailability = 'remote' | 'extension' | 'browser' | 'device';

type AdapterConstructor<TKey extends AdapterExportKey> = (typeof Adapters)[TKey];
type AdapterInstance<TKey extends AdapterExportKey> = InstanceType<AdapterConstructor<TKey>>;
type AdapterOptions<TKey extends AdapterExportKey> =
  ConstructorParameters<AdapterConstructor<TKey>> extends []
    ? never
    : NonNullable<ConstructorParameters<AdapterConstructor<TKey>>[0]>;
type AdapterOptionKey<TKey extends AdapterExportKey> = Extract<keyof AdapterOptions<TKey>, string>;

type DescriptorFor<TKey extends AdapterExportKey> = {
  readonly exportKey: TKey;
  readonly id: AdapterInstance<TKey>['id'];
  readonly name: string;
  readonly Adapter: AdapterConstructor<TKey>;
  readonly availability: AdapterAvailability;
  readonly configuration: {
    readonly requiredOptions: readonly AdapterOptionKey<TKey>[];
    readonly supportsDeferredConnection: boolean;
  };
};

/** Metadata for one packaged adapter, tied to its exact constructor and runtime ID. */
export type AdapterDescriptor = {
  [TKey in AdapterExportKey]: DescriptorFor<TKey>;
}[AdapterExportKey];

/**
 * Packaged adapters in their recommended display order.
 *
 * `remote` wallets open a hosted/QR flow, `extension` wallets require an
 * injected browser provider, `browser` wallets need browser primitives such as
 * popups, and `device` wallets require browser hardware APIs.
 */
export const ADAPTER_DESCRIPTORS = [
  {
    exportKey: 'Xaman',
    id: 'xaman',
    name: 'Xaman',
    Adapter: Adapters.Xaman,
    availability: 'remote',
    configuration: { requiredOptions: ['apiKey'], supportsDeferredConnection: true },
  },
  {
    exportKey: 'Crossmark',
    id: 'crossmark',
    name: 'Crossmark',
    Adapter: Adapters.Crossmark,
    availability: 'extension',
    configuration: { requiredOptions: [], supportsDeferredConnection: false },
  },
  {
    exportKey: 'GemWallet',
    id: 'gemwallet',
    name: 'GemWallet',
    Adapter: Adapters.GemWallet,
    availability: 'extension',
    configuration: { requiredOptions: [], supportsDeferredConnection: false },
  },
  {
    exportKey: 'WalletConnect',
    id: 'walletconnect',
    name: 'WalletConnect',
    Adapter: Adapters.WalletConnect,
    availability: 'remote',
    configuration: { requiredOptions: ['projectId'], supportsDeferredConnection: true },
  },
  {
    exportKey: 'Ledger',
    id: 'ledger',
    name: 'Ledger',
    Adapter: Adapters.Ledger,
    availability: 'device',
    configuration: { requiredOptions: [], supportsDeferredConnection: false },
  },
  {
    exportKey: 'Xyra',
    id: 'xyra',
    name: 'Xyra',
    Adapter: Adapters.Xyra,
    availability: 'browser',
    configuration: { requiredOptions: [], supportsDeferredConnection: false },
  },
  {
    exportKey: 'Otsu',
    id: 'otsu',
    name: 'Otsu',
    Adapter: Adapters.Otsu,
    availability: 'extension',
    configuration: { requiredOptions: [], supportsDeferredConnection: false },
  },
  {
    exportKey: 'MetaMaskSnap',
    id: 'metamask-snap',
    name: 'MetaMask Snap',
    Adapter: Adapters.MetaMaskSnap,
    availability: 'extension',
    configuration: { requiredOptions: [], supportsDeferredConnection: false },
  },
] as const satisfies readonly AdapterDescriptor[];

/** Constructor options keyed by canonical runtime wallet ID. */
export type PackagedAdapterOptions = {
  [TKey in AdapterExportKey as AdapterInstance<TKey>['id']]?: AdapterOptions<TKey>;
};

/** Instantiate every packaged adapter in canonical display order. */
export function createAdapters(configuration: PackagedAdapterOptions = {}): WalletAdapter[] {
  return ADAPTER_DESCRIPTORS.map((descriptor) => {
    const options = configuration[descriptor.id];
    const args = options === undefined ? [] : [options];
    return Reflect.construct(descriptor.Adapter, args) as WalletAdapter;
  });
}
