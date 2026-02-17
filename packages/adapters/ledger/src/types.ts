/**
 * Ledger adapter types and interfaces
 */

/**
 * Options for configuring the Ledger adapter
 */
export interface LedgerAdapterOptions {
  /**
   * BIP44 derivation path for the XRP account
   * If not specified, accountIndex will be used to generate the path
   * @default "44'/144'/0'/0/0"
   */
  derivationPath?: string;

  /**
   * Account index for automatic path generation (44'/144'/N'/0/0)
   * Only used if derivationPath is not provided
   * @default 0
   */
  accountIndex?: number;

  /**
   * Timeout for operations (in milliseconds)
   * @default 60000 (60 seconds)
   */
  timeout?: number;

  /**
   * Prefer WebHID over WebUSB when both are available
   * @default true
   */
  preferWebHID?: boolean;
}

export type LedgerConnectOptions = {
  derivationPath?: string;
  accountIndex?: number;
};

/**
 * Ledger device connection states
 */
export enum LedgerDeviceState {
  /** Device is not connected via USB */
  NOT_CONNECTED = 'NOT_CONNECTED',

  /** Device is connected but locked (PIN required) */
  LOCKED = 'LOCKED',

  /** Device is unlocked but XRP app is not open */
  APP_NOT_OPEN = 'APP_NOT_OPEN',

  /** Device is ready (unlocked and XRP app open) */
  READY = 'READY',

  /** Unknown state or error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * User-friendly messages for each device state
 */
export const LEDGER_STATE_MESSAGES: Record<LedgerDeviceState, string> = {
  [LedgerDeviceState.NOT_CONNECTED]: 'Please connect your Ledger device via USB',
  [LedgerDeviceState.LOCKED]: 'Please unlock your Ledger device by entering your PIN',
  [LedgerDeviceState.APP_NOT_OPEN]: 'Please open the XRP application on your Ledger device',
  [LedgerDeviceState.READY]: 'Ledger device connected and ready',
  [LedgerDeviceState.UNKNOWN]: 'Unable to determine Ledger device state',
};

/**
 * Ledger error codes
 * Reference: https://github.com/LedgerHQ/ledger-live/blob/develop/libs/ledgerjs/packages/errors/src/index.ts
 */
export enum LedgerErrorCode {
  /** Device is locked - user needs to enter PIN */
  DEVICE_LOCKED = 0x6804,

  /** App is not open or CLA not supported */
  APP_NOT_OPEN = 0x6e00,

  /** App is not open (alternative code) */
  APP_NOT_OPEN_ALT = 0x6511,

  /** App is not open (another alternative code) */
  APP_NOT_OPEN_ALT2 = 0x650f,

  /** User rejected the operation on device */
  USER_REJECTED = 0x6985,

  /** Invalid data provided */
  INVALID_DATA = 0x6a80,

  /** Wrong parameters */
  WRONG_PARAMETERS = 0x6b00,

  /** Technical problem on device */
  TECHNICAL_PROBLEM = 0x6f00,
}
