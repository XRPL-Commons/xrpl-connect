import type { ConnectOptions, WalletAdapter, WalletManager } from '@xrpl-connect/core';
import {
  createLogger,
  isAdapterConfigured,
  TIME,
  WalletErrorCode,
  withTimeout,
} from '@xrpl-connect/core';
import { isSafari, isMobile, delay } from '../utils';
import { TIMINGS, ERROR_CODES } from '../constants';
import {
  isModalConfigurableAdapter,
  isMultiAccountAdapter,
  type LedgerConnectOptions,
  type WalletConnectConnectOptions,
  type WalletConnectorContext,
} from '../types';

const logger = createLogger('[WalletService]');
const AVAILABILITY_TIMED_OUT = Symbol('availability-timed-out');

async function checkWalletAvailability(wallet: WalletAdapter): Promise<boolean> {
  if (!isAdapterConfigured(wallet)) return false;

  const result = await withTimeout<
    | { available: boolean; error?: never }
    | { available?: never; error: unknown }
    | typeof AVAILABILITY_TIMED_OUT
  >(
    async () => {
      try {
        return { available: await wallet.isAvailable() };
      } catch (error) {
        return { error };
      }
    },
    TIME.AVAILABILITY_TIMEOUT,
    AVAILABILITY_TIMED_OUT
  );

  if (result === AVAILABILITY_TIMED_OUT) {
    logger.warn(
      `Timed out checking availability for ${wallet.name} after ${TIME.AVAILABILITY_TIMEOUT}ms`
    );
    throw new Error(`${wallet.name} did not respond. Please try again.`);
  }
  if ('error' in result) {
    throw result.error;
  }
  return result.available;
}

/**
 * Narrow `unknown` thrown values to the bits we read for error display.
 */
interface ErrorLike {
  code?: string | number;
  message?: string;
}

function asErrorLike(value: unknown): ErrorLike {
  if (value && typeof value === 'object') {
    return value as ErrorLike;
  }
  return {};
}

export class WalletService {
  private nextConnectionAttemptId = 0;

  constructor(
    private walletManager: WalletManager,
    private component: WalletConnectorContext
  ) {}

  private dispatchConnecting(walletId: string, detail: Record<string, unknown> = {}): number {
    const connectionAttemptId = ++this.nextConnectionAttemptId;
    this.component.dispatchEvent(
      new CustomEvent('connecting', {
        detail: { walletId, ...detail, connectionAttemptId },
      })
    );
    return connectionAttemptId;
  }

  async connectWallet(walletId: string, options?: ConnectOptions) {
    if (!this.walletManager) {
      logger.error('WalletManager not set');
      return;
    }

    let connectionAttemptId: number | undefined;
    try {
      // Get wallet info
      const wallet = this.walletManager.wallets.find((w) => w.id === walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      logger.debug('Connecting to wallet:', walletId);

      if (walletId === 'xaman') {
        logger.info('Xaman UI connection phase: selected', {
          managerConnected: this.walletManager.connected,
          activeWalletId: this.walletManager.wallet?.id ?? null,
          browserUserActivation:
            typeof navigator !== 'undefined' && 'userActivation' in navigator
              ? navigator.userActivation.isActive
              : undefined,
        });
      }

      if (walletId === 'walletconnect') {
        // Check if wallet adapter supports modal
        const useModal = isModalConfigurableAdapter(wallet)
          ? (wallet.options?.useModal ?? false)
          : false;
        const modalMode = isModalConfigurableAdapter(wallet)
          ? (wallet.options?.modalMode ?? 'mobile-only')
          : 'mobile-only';

        const shouldUseModal =
          useModal && (modalMode === 'always' || (modalMode === 'mobile-only' && isMobile()));

        if (shouldUseModal) {
          // ===== USE MODAL (Mobile deeplink mode) =====
          logger.debug('Using WalletConnect modal (mobile deeplink mode)');

          // IMPORTANT: Keep our custom modal open in the background
          // The WalletConnect modal will appear on top, creating a layered effect
          // This gives users the impression they're still in the connection flow

          // Show loading state first (with spinning animation like Xaman)
          this.component.showLoadingView(walletId, wallet.name, wallet.icon);

          connectionAttemptId = this.dispatchConnecting(walletId);

          // Small delay to show the loading animation before WC modal appears
          await delay(TIMINGS.NON_SAFARI_CONNECT_DELAY);

          // Connect - WalletConnect modal will open on top of our loading view
          await this.walletManager.connect(walletId, options);
          this.component.dispatchEvent(
            new CustomEvent('connected', { detail: { walletId, connectionAttemptId } })
          );

          // Close our modal after successful connection
          this.component.close();
        } else {
          // ===== USE CUSTOM QR (Desktop mode) =====
          logger.debug('Using custom QR code (desktop mode)');

          // Show QR code view first for WalletConnect
          this.component.showQRCodeView(walletId);

          // Set up QR code callback
          const connectOptions: ConnectOptions<WalletConnectConnectOptions> = {
            ...options,
            onQRCode: (uri: string) => {
              logger.debug('QR code callback received:', uri.substring(0, 50) + '...');
              this.component.setQRCode(walletId, uri);
            },
          };

          connectionAttemptId = this.dispatchConnecting(walletId);
          await this.walletManager.connect(walletId, connectOptions);
          this.component.dispatchEvent(
            new CustomEvent('connected', { detail: { walletId, connectionAttemptId } })
          );
        }
      } else if (walletId === 'ledger') {
        // For Ledger, show account selection first
        const isAvailable = await checkWalletAvailability(wallet);

        if (!isAvailable) {
          throw new Error(
            `${wallet.name} is not supported in this browser. Please use Chrome, Edge, or Opera.`
          );
        }

        if (!isMultiAccountAdapter(wallet)) {
          throw new Error(`${wallet.name} does not support account enumeration`);
        }

        // Show loading while fetching accounts
        this.component.showLoadingView(walletId, wallet.name, wallet.icon);

        // Small delay for UI
        if (!isSafari()) {
          await delay(TIMINGS.NON_SAFARI_CONNECT_DELAY);
        }

        // Fetch accounts from Ledger
        logger.debug('Fetching Ledger accounts...');
        const accounts = await wallet.getAccounts(5, 0);
        logger.debug('Fetched accounts:', accounts);

        // Show account selection view
        this.component.showAccountSelectionView(walletId, wallet.name, wallet.icon, accounts);
      } else {
        // Show loading state
        this.component.showLoadingView(walletId, wallet.name, wallet.icon);

        connectionAttemptId = this.dispatchConnecting(walletId);

        // Browser-specific delay (Safari needs immediate connection for user gesture)
        if (!isSafari() && walletId !== 'xaman') {
          // Small delay for UI animation on non-Safari browsers
          await delay(TIMINGS.NON_SAFARI_CONNECT_DELAY);
        }

        if (walletId === 'xaman') {
          logger.info('Xaman UI connection phase: handing off to WalletManager', {
            browserUserActivation:
              typeof navigator !== 'undefined' && 'userActivation' in navigator
                ? navigator.userActivation.isActive
                : undefined,
          });
        }

        await this.walletManager.connect(walletId, options);

        if (walletId === 'xaman') {
          logger.info('Xaman UI connection phase: WalletManager connected');
        }
        this.component.dispatchEvent(
          new CustomEvent('connected', { detail: { walletId, connectionAttemptId } })
        );
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const wallet = this.walletManager?.wallets.find((w) => w.id === walletId);

      // Detect error type based on error code (ConnectKit pattern)
      let errorMessage = err.message || 'An unexpected error occurred';
      let errorType: 'rejected' | 'unavailable' | 'failed' = 'failed';

      // Check for specific error codes
      if (
        err.code === ERROR_CODES.USER_REJECTED ||
        errorMessage.toLowerCase().includes('user rejected')
      ) {
        errorType = 'rejected';
        errorMessage = 'Connection request was cancelled';
      } else if (
        err.code === ERROR_CODES.POPUP_CLOSED ||
        errorMessage.toLowerCase().includes('already pending')
      ) {
        errorType = 'unavailable';
        errorMessage = 'Wallet popup was closed or did not respond. Please try again.';
      } else if (
        err.code === WalletErrorCode.WALLET_NOT_AVAILABLE ||
        errorMessage.toLowerCase().includes('not installed') ||
        errorMessage.toLowerCase().includes('did not respond')
      ) {
        errorType = 'unavailable';
      }

      logger.debug('Connection error type:', errorType, 'Code:', err.code);

      this.component.showErrorView(walletId, wallet?.name || 'Wallet', new Error(errorMessage));
      this.component.dispatchEvent(
        new CustomEvent('error', {
          detail: { error, walletId, errorType, connectionAttemptId },
        })
      );
      logger.error('Failed to connect:', error);
    }
  }

  async connectWithLedgerAccount(accountIndex: number) {
    if (!this.walletManager || !this.component.accountSelectionData) return;

    const { walletId, walletName, walletIcon } = this.component.accountSelectionData;
    let connectionAttemptId: number | undefined;

    try {
      // Show loading state
      this.component.showLoadingView(walletId, walletName, walletIcon);

      // Small delay for UI
      if (!isSafari()) {
        await delay(TIMINGS.NON_SAFARI_CONNECT_DELAY);
      }

      logger.debug('Connecting to Ledger with account index:', accountIndex);
      connectionAttemptId = this.dispatchConnecting(walletId, { accountIndex });

      const ledgerOptions: ConnectOptions<LedgerConnectOptions> = { accountIndex };
      await this.walletManager.connect(walletId, ledgerOptions);

      this.component.dispatchEvent(
        new CustomEvent('connected', {
          detail: { walletId, accountIndex, connectionAttemptId },
        })
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      // Handle error - show error view
      let errorMessage = err.message || 'An unexpected error occurred';
      let errorType: 'rejected' | 'unavailable' | 'failed' = 'failed';

      if (
        err.code === ERROR_CODES.USER_REJECTED ||
        errorMessage.toLowerCase().includes('user rejected')
      ) {
        errorType = 'rejected';
        errorMessage = 'Connection request was cancelled';
      }

      logger.debug('Connection error type:', errorType, 'Code:', err.code);
      this.component.showErrorView(walletId, walletName, new Error(errorMessage));
      this.component.dispatchEvent(
        new CustomEvent('error', {
          detail: { error, walletId, errorType, connectionAttemptId },
        })
      );
      logger.error('Failed to connect:', error);
    }
  }

  async connectWithCustomDerivationPath(derivationPath: string) {
    if (!this.walletManager || !this.component.accountSelectionData) return;

    const { walletId, walletName, walletIcon } = this.component.accountSelectionData;
    let connectionAttemptId: number | undefined;

    try {
      // Validate derivation path format
      const pathRegex = /^44'\/144'\/\d+'\/\d+\/\d+$/;
      if (!pathRegex.test(derivationPath)) {
        throw new Error("Invalid derivation path format. Expected format: 44'/144'/0'/0/0");
      }

      // Show loading state
      this.component.showLoadingView(walletId, walletName, walletIcon);

      // Small delay for UI
      if (!isSafari()) {
        await delay(TIMINGS.NON_SAFARI_CONNECT_DELAY);
      }

      logger.debug('Connecting to Ledger with custom derivation path:', derivationPath);
      connectionAttemptId = this.dispatchConnecting(walletId, { derivationPath });

      const ledgerOptions: ConnectOptions<LedgerConnectOptions> = { derivationPath };
      await this.walletManager.connect(walletId, ledgerOptions);

      this.component.dispatchEvent(
        new CustomEvent('connected', {
          detail: { walletId, derivationPath, connectionAttemptId },
        })
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      // Handle error - show error view
      let errorMessage = err.message || 'An unexpected error occurred';
      let errorType: 'rejected' | 'unavailable' | 'failed' = 'failed';

      if (
        err.code === ERROR_CODES.USER_REJECTED ||
        errorMessage.toLowerCase().includes('user rejected')
      ) {
        errorType = 'rejected';
        errorMessage = 'Connection request was cancelled';
      }

      logger.debug('Connection error type:', errorType, 'Code:', err.code);
      this.component.showErrorView(walletId, walletName, new Error(errorMessage));
      this.component.dispatchEvent(
        new CustomEvent('error', {
          detail: { error, walletId, errorType, connectionAttemptId },
        })
      );
      logger.error('Failed to connect:', error);
    }
  }
}
