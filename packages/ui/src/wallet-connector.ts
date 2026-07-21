/**
 * XRPL Wallet Connector Web Component
 * A framework-agnostic web component for connecting to XRPL wallets
 */

import type { AccountInfo, WalletAdapter, WalletManager } from '@xrpl-connect/core';
import { createLogger, supportsPreInitialize, withTimeout, TIME } from '@xrpl-connect/core';
import QRCodeStyling from 'qr-code-styling';
import { mainStyles } from './styles/main';
import {
  SIZES,
  TIMINGS,
  QR_CONFIG,
  DEFAULT_THEME,
  COLOR_ADJUSTMENT,
  ADDRESS_DISPLAY,
  GRADIENT,
} from './constants';
import {
  renderWalletListView,
  renderQRView,
  renderLoadingView,
  renderErrorView,
  renderAccountSelectionView,
  renderAccountModal,
} from './views';
import { WalletService, EventHandler } from './services';
import {
  isXamanStateAdapter,
  type AccountSelectionData,
  type ErrorData,
  type LedgerAccount,
  type LoadingData,
  type QRCodeData,
  type WalletConnectorContext,
} from './types';
import { isXamanQRImage, adjustColorBrightness, orderWalletsByMru } from './utils';

/**
 * Logger instance for wallet connector
 */
const logger = createLogger('[WalletConnector]');
const AVAILABILITY_TIMED_OUT = Symbol('availability-timed-out');

/** Public API exposed by the `<xrpl-wallet-connector>` custom element. */
export interface WalletConnectorElementInstance extends HTMLElement {
  setWalletManager(manager: WalletManager): void;
  open(): Promise<void>;
  openAndWait(): Promise<AccountInfo>;
  close(): void;
  toggle(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'xrpl-wallet-connector': WalletConnectorElementInstance;
  }
}

interface ConnectionWaiter {
  resolve(account: AccountInfo): void;
  reject(error: Error): void;
}

// Only define the component in browser (guard against SSR)
let WalletConnectorElement: {
  new (): WalletConnectorElementInstance;
  readonly prototype: WalletConnectorElementInstance;
} | null = null;

if (typeof window !== 'undefined' && typeof HTMLElement !== 'undefined') {
  const XC_CSS_VARIABLES = [
    '--xc-font-family',
    '--xc-border-radius',
    '--xc-overlay-background',
    '--xc-overlay-backdrop-filter',
    '--xc-primary-color',
    '--xc-background-color',
    '--xc-text-color',
    '--xc-text-muted-color',
    '--xc-background-secondary',
    '--xc-background-tertiary',
    '--xc-loading-border-color',
    '--xc-connect-button-font-size',
    '--xc-connect-button-border-radius',
    '--xc-connect-button-color',
    '--xc-connect-button-background',
    '--xc-connect-button-border',
    '--xc-connect-button-hover-background',
    '--xc-connect-button-font-weight',
    '--xc-primary-button-color',
    '--xc-primary-button-background',
    '--xc-primary-button-border-radius',
    '--xc-primary-button-font-weight',
    '--xc-primary-button-hover-background',
    '--xc-secondary-button-color',
    '--xc-secondary-button-background',
    '--xc-secondary-button-border-radius',
    '--xc-secondary-button-font-weight',
    '--xc-secondary-button-hover-background',
    '--xc-account-address-button-hover-color',
    '--xc-modal-background',
    '--xc-modal-border-radius',
    '--xc-modal-box-shadow',
    '--xc-focus-color',
    '--xc-danger-color',
    '--xc-success-color',
    '--xc-warning-color',
  ] as const;

  class WalletConnectorElementImpl
    extends HTMLElement
    implements WalletConnectorContext, WalletConnectorElementInstance
  {
    public walletManager: WalletManager | null = null;
    public readonly shadow: ShadowRoot;
    private isOpen = false;
    private openGeneration = 0;
    private isFirstOpen = true;
    private primaryWalletId: string | null = null;
    private viewState: 'list' | 'qr' | 'loading' | 'error' | 'account-selection' = 'list';
    public qrCodeData: QRCodeData | null = null;
    private loadingData: LoadingData | null = null;
    public errorData: ErrorData | null = null;
    public accountSelectionData: AccountSelectionData | null = null;
    private previousModalHeight: number = 0;
    private preGeneratedQRCode: QRCodeStyling | null = null;
    private preGeneratedURI: string | null = null;
    private availableWallets: WalletAdapter[] = [];
    // Specified wallets that are NOT installed/available — shown with an
    // "Install" affordance only when the `show-unavailable` attribute is set.
    private unavailableWallets: WalletAdapter[] = [];
    private walletAvailabilityChecked: boolean = false;
    private walletAvailabilityTimedOut: boolean = false;
    private walletAvailabilityGeneration: number = 0;
    private accountModalOpen: boolean = false;
    private accountBalance: string | null = null;
    private overlayPortal: HTMLDivElement | null = null;
    private accountModalPortal: HTMLDivElement | null = null;
    private styleObserver: MutationObserver | null = null;
    private readonly connectionWaiters = new Set<ConnectionWaiter>();
    private walletManagerHandlers: {
      connect: (account: AccountInfo) => void;
      disconnect: () => void;
      accountChanged: () => void;
    } | null = null;

    // Observed attributes
    static get observedAttributes() {
      return ['primary-wallet', 'wallets', 'show-unavailable'];
    }

    /** Whether unavailable wallets are listed with an "Install" link. */
    private get showUnavailable(): boolean {
      return this.hasAttribute('show-unavailable');
    }

    constructor() {
      super();
      this.shadow = this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.attachWalletManagerHandlers();
      this.render();

      // Update derived colors on initial load
      requestAnimationFrame(() => this.updateDerivedColors());

      // Observe style attribute changes for CSS variable updates
      this.styleObserver?.disconnect();
      this.styleObserver = new MutationObserver(() => {
        this.updateDerivedColors();
      });

      this.styleObserver.observe(this, {
        attributes: true,
        attributeFilter: ['style'],
      });
    }

    disconnectedCallback() {
      this.cancelPendingConnection();
      this.openGeneration += 1;
      this.isOpen = false;
      this.accountModalOpen = false;
      this.rejectConnectionWaiters(
        new Error('Wallet connector was disconnected before a wallet was connected.')
      );
      this.resetWalletAvailability();
      this.eventHandler?.detachEventListeners();
      this.detachWalletManagerHandlers();

      this.styleObserver?.disconnect();
      this.styleObserver = null;

      this.overlayPortal?.remove();
      this.overlayPortal = null;
      this.accountModalPortal?.remove();
      this.accountModalPortal = null;
      document.body.style.overflow = '';
    }

    private forwardCSSVariables(portalHost: HTMLElement): void {
      const computedStyle = window.getComputedStyle(this);
      for (const varName of XC_CSS_VARIABLES) {
        const value = computedStyle.getPropertyValue(varName).trim();
        if (value) portalHost.style.setProperty(varName, value);
      }
    }

    private ensureOverlayPortal(): ShadowRoot {
      if (!this.overlayPortal) {
        this.overlayPortal = document.createElement('div');
        this.overlayPortal.setAttribute('data-xrpl-overlay-portal', '');
        this.overlayPortal.attachShadow({ mode: 'open' });
        document.body.appendChild(this.overlayPortal);
      }
      this.forwardCSSVariables(this.overlayPortal);
      return this.overlayPortal.shadowRoot!;
    }

    private ensureAccountModalPortal(): ShadowRoot {
      if (!this.accountModalPortal) {
        this.accountModalPortal = document.createElement('div');
        this.accountModalPortal.setAttribute('data-xrpl-account-modal-portal', '');
        this.accountModalPortal.attachShadow({ mode: 'open' });
        document.body.appendChild(this.accountModalPortal);
      }
      this.forwardCSSVariables(this.accountModalPortal);
      return this.accountModalPortal.shadowRoot!;
    }

    public getOverlayRoot(): ShadowRoot | null {
      return this.overlayPortal?.shadowRoot ?? null;
    }

    public getAccountModalRoot(): ShadowRoot | null {
      return this.accountModalPortal?.shadowRoot ?? null;
    }

    /**
     * Update derived colors (like hover states) based on color changes
     */
    private updateDerivedColors() {
      const computedStyle = window.getComputedStyle(this);
      const primaryColor =
        computedStyle.getPropertyValue('--xc-primary-color').trim() || DEFAULT_THEME.PRIMARY_COLOR;
      const backgroundColor =
        computedStyle.getPropertyValue('--xc-background-color').trim() ||
        DEFAULT_THEME.BACKGROUND_COLOR;

      // Calculate lighter shades for hover states
      const primaryHoverColor = adjustColorBrightness(
        primaryColor,
        COLOR_ADJUSTMENT.HOVER_BRIGHTNESS
      );
      const backgroundHoverColor = adjustColorBrightness(
        backgroundColor,
        COLOR_ADJUSTMENT.HOVER_BRIGHTNESS
      );

      // Apply hover colors
      this.style.setProperty('--xc-primary-button-hover-background', primaryHoverColor);
      this.style.setProperty('--xc-connect-button-hover-background', backgroundHoverColor);
      this.style.setProperty('--xc-account-address-button-hover-color', primaryHoverColor);

      // Forward updated variables to portals
      if (this.overlayPortal) this.forwardCSSVariables(this.overlayPortal);
      if (this.accountModalPortal) this.forwardCSSVariables(this.accountModalPortal);
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
      if (name === 'wallets' && oldValue !== newValue) {
        this.resetWalletAvailability();
        if (this.isOpen) {
          // Hide stale choices immediately while the new allowlist is checked.
          this.walletAvailabilityChecked = true;
          this.render();
          void this.refreshWalletAvailability();
          return;
        }
      }
      if (this.shadow.children.length > 0) {
        this.render();
      }
    }

    /**
     * Set the WalletManager instance
     */
    setWalletManager(manager: WalletManager) {
      this.detachWalletManagerHandlers();
      this.walletManager = manager;
      this.resetWalletAvailability();
      this.walletService = new WalletService(this.walletManager, this);
      this.eventHandler = new EventHandler(this, this.walletService);
      this.attachWalletManagerHandlers();

      const connectedAccount = manager.connected ? manager.account : null;
      if (connectedAccount && this.connectionWaiters.size > 0) {
        this.resolveConnectionWaiters(connectedAccount);
        if (this.isOpen) this.close();
      }

      if (this.isOpen) {
        // Hide unverified choices until the replacement manager is checked.
        this.walletAvailabilityChecked = true;
        this.render();
        void this.refreshWalletAvailability();
      } else {
        this.render();
      }

      // Check for existing Xaman session after a short delay
      void this.checkXamanStateOnInit();
    }

    private attachWalletManagerHandlers(): void {
      const manager = this.walletManager;
      if (!manager || this.walletManagerHandlers) return;

      this.walletManagerHandlers = {
        connect: (account: AccountInfo) => {
          if (manager !== this.walletManager) return;
          this.resolveConnectionWaiters(account);
          const connectedId = manager.wallet?.id;
          if (connectedId) this.recordMruId(connectedId);
          this.close();
          this.render();
        },
        disconnect: () => {
          if (manager === this.walletManager) this.render();
        },
        accountChanged: () => {
          if (manager === this.walletManager) this.render();
        },
      };

      manager.on('connect', this.walletManagerHandlers.connect);
      manager.on('disconnect', this.walletManagerHandlers.disconnect);
      manager.on('accountChanged', this.walletManagerHandlers.accountChanged);
    }

    private detachWalletManagerHandlers(): void {
      if (!this.walletManager || !this.walletManagerHandlers) return;
      this.walletManager.off('connect', this.walletManagerHandlers.connect);
      this.walletManager.off('disconnect', this.walletManagerHandlers.disconnect);
      this.walletManager.off('accountChanged', this.walletManagerHandlers.accountChanged);
      this.walletManagerHandlers = null;
    }

    private resolveConnectionWaiters(account: AccountInfo): void {
      const waiters = Array.from(this.connectionWaiters);
      this.connectionWaiters.clear();
      for (const waiter of waiters) waiter.resolve(account);
    }

    private rejectConnectionWaiters(error: Error): void {
      const waiters = Array.from(this.connectionWaiters);
      this.connectionWaiters.clear();
      for (const waiter of waiters) waiter.reject(error);
    }

    /**
     * Check for existing Xaman authentication on page load
     */
    private async checkXamanStateOnInit() {
      try {
        const xamanAdapter = this.walletManager?.adapters?.get('xaman');
        if (!xamanAdapter || !isXamanStateAdapter(xamanAdapter)) {
          return;
        }

        const account = await xamanAdapter.checkXamanState();
        if (account && this.walletManager && !this.walletManager.connected) {
          await this.walletManager.connect('xaman');
        }
      } catch (err) {
        console.error('Failed to check Xaman state:', err);
      }
    }

    /**
     * Parse wallet IDs from the 'wallets' attribute
     */
    private parseWalletAttribute(): string[] {
      const walletsAttr = this.getAttribute('wallets') || '';
      if (!walletsAttr) {
        // If no wallets attribute, use all available wallets
        return this.walletManager?.wallets.map((w) => w.id) || [];
      }
      // Parse comma-separated wallet IDs
      return walletsAttr
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
    }

    private resetWalletAvailability() {
      this.walletAvailabilityGeneration += 1;
      this.availableWallets = [];
      this.unavailableWallets = [];
      this.walletAvailabilityChecked = false;
      this.walletAvailabilityTimedOut = false;
    }

    private async refreshWalletAvailability() {
      const openGeneration = this.openGeneration;
      const availabilityApplied = await this.checkWalletAvailability();
      if (availabilityApplied && openGeneration === this.openGeneration && this.isOpen) {
        this.walletAvailabilityChecked = true;
        this.render();
      }
    }

    /**
     * Check which wallets are available
     * Filters wallets based on 'wallets' attribute and checks isAvailable() on each
     */
    private async checkWalletAvailability(): Promise<boolean> {
      const manager = this.walletManager;
      const generation = ++this.walletAvailabilityGeneration;

      if (!manager || !manager.wallets.length) {
        logger.warn('No wallet manager or wallets registered');
        if (generation !== this.walletAvailabilityGeneration || manager !== this.walletManager) {
          return false;
        }
        this.availableWallets = [];
        this.unavailableWallets = [];
        this.walletAvailabilityTimedOut = false;
        return true;
      }

      try {
        // Parse the specified wallet IDs from attribute
        const specifiedWalletIds = this.parseWalletAttribute();

        logger.debug('Checking availability for wallets:', specifiedWalletIds);

        // Get adapters for specified wallet IDs
        const walletsToCheck = manager.wallets.filter((w) => specifiedWalletIds.includes(w.id));

        // Check availability for each wallet in parallel. Each check is capped
        // with a timeout so one slow or hung wallet (e.g. a network probe on a
        // flaky mobile connection) can't block the modal from rendering the
        // rest of the list — Promise.all otherwise waits for the slowest one.
        const availabilityChecks = await Promise.all(
          walletsToCheck.map(async (wallet) => {
            const result = await withTimeout<boolean | typeof AVAILABILITY_TIMED_OUT>(
              async () => {
                try {
                  return await wallet.isAvailable();
                } catch (error) {
                  logger.warn(`Error checking availability for ${wallet.id}:`, error);
                  return false;
                }
              },
              TIME.AVAILABILITY_TIMEOUT,
              AVAILABILITY_TIMED_OUT
            );
            const timedOut = result === AVAILABILITY_TIMED_OUT;
            const available = timedOut ? false : result;
            if (timedOut) {
              logger.warn(
                `Timed out checking availability for ${wallet.id} after ${TIME.AVAILABILITY_TIMEOUT}ms`
              );
            } else {
              logger.debug(`Wallet ${wallet.id} availability: ${available}`);
            }
            return { wallet, available, timedOut };
          })
        );

        if (generation !== this.walletAvailabilityGeneration || manager !== this.walletManager) {
          return false;
        }

        this.walletAvailabilityTimedOut = availabilityChecks.some((check) => check.timedOut);

        // Split into available / unavailable, preserving the specified order.
        const ordered = specifiedWalletIds
          .map((id) => availabilityChecks.find((check) => check.wallet.id === id))
          .filter(
            (check): check is { wallet: WalletAdapter; available: boolean; timedOut: boolean } =>
              !!check
          );

        this.availableWallets = ordered.filter((c) => c.available).map((c) => c.wallet);
        this.unavailableWallets = ordered.filter((c) => !c.available).map((c) => c.wallet);

        logger.debug(
          'Available wallets:',
          this.availableWallets.map((w) => w.id)
        );
        return true;
      } catch (error) {
        if (generation !== this.walletAvailabilityGeneration || manager !== this.walletManager) {
          return false;
        }
        logger.error('Error checking wallet availability:', error);
        this.availableWallets = [];
        this.unavailableWallets = [];
        this.walletAvailabilityTimedOut = true;
        return true;
      }
    }

    /** localStorage key holding the most-recently-used wallet ids (newest first). */
    private static readonly MRU_STORAGE_KEY = 'xrpl-connect:mru-wallets';

    /**
     * Read the most-recently-used wallet ids (newest first). Never throws —
     * storage may be unavailable or hold malformed data.
     */
    private loadMruIds(): string[] {
      try {
        if (typeof localStorage === 'undefined') return [];
        const raw = localStorage.getItem(WalletConnectorElementImpl.MRU_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed)
          ? parsed.filter((id): id is string => typeof id === 'string')
          : [];
      } catch {
        return [];
      }
    }

    /** Move a wallet id to the front of the most-recently-used list. */
    private recordMruId(id: string): void {
      try {
        if (typeof localStorage === 'undefined') return;
        const next = [id, ...this.loadMruIds().filter((existing) => existing !== id)].slice(0, 10);
        localStorage.setItem(WalletConnectorElementImpl.MRU_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage failures — MRU ordering is a non-critical enhancement.
      }
    }

    /**
     * Return wallets ordered by most-recently-used first, keeping the given
     * (availability) order for wallets with no usage history.
     */
    private orderByMru(wallets: WalletAdapter[]): WalletAdapter[] {
      return orderWalletsByMru(wallets, this.loadMruIds());
    }

    /** Reorder available wallets by MRU without moving unavailable-wallet slots. */
    private orderVisibleWallets(
      wallets: WalletAdapter[],
      unavailableWalletIds: ReadonlySet<string>
    ): WalletAdapter[] {
      const orderedAvailable = this.orderByMru(
        wallets.filter((wallet) => !unavailableWalletIds.has(wallet.id))
      );
      let availableIndex = 0;
      return wallets.map((wallet) =>
        unavailableWalletIds.has(wallet.id) ? wallet : orderedAvailable[availableIndex++]
      );
    }

    /**
     * Open the modal
     */
    async open() {
      const openGeneration = ++this.openGeneration;
      this.isOpen = true;
      this.isFirstOpen = true;

      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';

      // Retry a bounded check on later opens when an adapter previously timed out.
      if (!this.walletAvailabilityChecked || this.walletAvailabilityTimedOut) {
        const availabilityApplied = await this.checkWalletAvailability();
        if (openGeneration !== this.openGeneration || !this.isOpen) {
          return;
        }
        if (availabilityApplied) {
          this.walletAvailabilityChecked = true;
        }
      }

      this.render();
      this.dispatchEvent(new CustomEvent('open'));

      // Pre-initialize WalletConnect to reduce loading time
      this.preInitializeWalletConnect();
    }

    /**
     * Open the modal and resolve once a wallet is connected, or reject if the
     * user closes the modal first. Lets callers `await` a connection in one call
     * instead of wiring up `connected` / `close` event listeners themselves.
     */
    openAndWait(): Promise<AccountInfo> {
      const manager = this.walletManager;
      if (!manager) {
        return Promise.reject(new Error('WalletManager must be set before opening the modal.'));
      }
      if (manager.connected && manager.account) {
        return Promise.resolve(manager.account);
      }

      return new Promise<AccountInfo>((resolve, reject) => {
        this.connectionWaiters.add({ resolve, reject });
        if (!this.isOpen) {
          void this.open().catch((error) => {
            this.rejectConnectionWaiters(error instanceof Error ? error : new Error(String(error)));
          });
        }
      });
    }

    /**
     * Close the modal
     */
    close() {
      this.cancelPendingConnection();
      this.openGeneration += 1;
      this.isOpen = false;
      this.rejectConnectionWaiters(new Error('Modal closed before a wallet was connected.'));

      // Restore body scroll when modal is closed
      document.body.style.overflow = '';

      // Reset state to wallet list view when closing
      this.viewState = 'list';
      this.qrCodeData = null;
      this.loadingData = null;
      this.errorData = null;
      this.accountSelectionData = null;
      this.render();
      this.dispatchEvent(new CustomEvent('close'));
    }

    /**
     * Toggle the modal
     */
    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }

    /**
     * Open the account details modal
     */
    public openAccountModal() {
      this.accountModalOpen = true;
      this.render();
    }

    /**
     * Close the account details modal
     */
    public closeAccountModal() {
      this.accountModalOpen = false;
      this.render();
    }

    /**
     * Disconnect wallet from the account modal
     */
    public async disconnectFromAccountModal() {
      try {
        await this.walletManager?.disconnect();
        this.closeAccountModal();
        this.render();
      } catch (error) {
        logger.error('Failed to disconnect:', error);
      }
    }

    /**
     * Set the account balance to display in the account modal
     */
    setAccountBalance(balance: string) {
      this.accountBalance = balance;
      this.render();
    }

    /**
     * Get the current account balance
     */
    getAccountBalance(): string | null {
      return this.accountBalance;
    }

    /**
     * Pre-initialize WalletConnect when modal opens to reduce loading time
     * Based on ConnectKit's eager initialization pattern
     */
    private async preInitializeWalletConnect() {
      if (!this.walletManager) return;

      // Find WalletConnect adapter
      const walletConnectAdapter = this.walletManager.wallets.find((w) => w.id === 'walletconnect');

      if (!walletConnectAdapter || !supportsPreInitialize(walletConnectAdapter)) return;

      try {
        logger.debug('Pre-initializing WalletConnect...');

        const network = this.walletManager.defaultNetwork;

        await walletConnectAdapter.preInitialize(network, (uri) => {
          logger.debug('Pre-generating QR code...');
          this.preGenerateQRCode(uri);
        });
      } catch (error) {
        logger.warn('Failed to pre-initialize WalletConnect:', error);
        // Silent failure - connection will initialize on demand if this fails
      }
    }

    /**
     * Pre-generate QR code to have it ready when user clicks WalletConnect
     */
    private async preGenerateQRCode(uri: string) {
      try {
        this.preGeneratedURI = uri;

        // Get wallet icon for embedding
        const wallet = this.walletManager?.wallets.find((w) => w.id === 'walletconnect');

        // Create QR code instance
        const qrCode = new QRCodeStyling({
          width: QR_CONFIG.SIZE,
          height: QR_CONFIG.SIZE,
          type: 'svg',
          data: uri,
          image: wallet?.icon,
          margin: QR_CONFIG.MARGIN,
          qrOptions: {
            errorCorrectionLevel: QR_CONFIG.ERROR_CORRECTION_LEVEL,
          },
          dotsOptions: {
            type: QR_CONFIG.DOT_TYPE,
            color: QR_CONFIG.DOT_COLOR,
          },
          backgroundOptions: {
            color: QR_CONFIG.BACKGROUND_COLOR,
          },
          imageOptions: {
            crossOrigin: 'anonymous',
            margin: QR_CONFIG.IMAGE_MARGIN,
            imageSize: QR_CONFIG.IMAGE_SIZE,
          },
        });

        // Store the pre-generated QR code
        this.preGeneratedQRCode = qrCode;
        logger.debug('QR code pre-generated successfully');
      } catch (error) {
        logger.warn('Failed to pre-generate QR code:', error);
        // Silent failure - QR will be generated on demand if this fails
      }
    }

    private walletService: WalletService | undefined;
    private eventHandler: EventHandler | undefined;

    /**
     * Show QR code view
     */
    public showQRCodeView(walletId: string, uri?: string) {
      this.viewState = 'qr';
      this.qrCodeData = { walletId, uri: uri || '' };
      this.loadingData = null;
      this.errorData = null;
      this.accountSelectionData = null;
      this.render();
    }

    /**
     * Show loading view
     */
    public showLoadingView(walletId: string, walletName: string, walletIcon?: string) {
      this.viewState = 'loading';
      this.loadingData = { walletId, walletName, walletIcon };
      this.qrCodeData = null;
      this.errorData = null;
      this.accountSelectionData = null;
      this.render();
    }

    /**
     * Show error view
     */
    public showErrorView(walletId: string, walletName: string, error: Error) {
      this.viewState = 'error';
      this.errorData = { walletId, walletName, error };
      this.qrCodeData = null;
      this.loadingData = null;
      this.accountSelectionData = null;
      this.render();
    }

    /**
     * Show wallet list view
     */
    public showWalletList() {
      this.cancelPendingConnection();
      this.viewState = 'list';
      this.qrCodeData = null;
      this.loadingData = null;
      this.errorData = null;
      this.accountSelectionData = null;
      this.render();
    }

    private cancelPendingConnection(): void {
      if (!this.walletManager || this.walletManager.connected) return;

      void this.walletManager.disconnect().catch((error) => {
        logger.warn('Failed to cancel pending wallet connection:', error);
      });
    }

    /**
     * Show account selection view
     */
    public showAccountSelectionView(
      walletId: string,
      walletName: string,
      walletIcon: string | undefined,
      accounts: LedgerAccount[]
    ) {
      this.viewState = 'account-selection';
      this.accountSelectionData = { walletId, walletName, walletIcon, accounts };
      this.qrCodeData = null;
      this.loadingData = null;
      this.errorData = null;
      this.render();
    }

    /**
     * Update QR code with URI
     * Called by wallet adapters when QR code URI is ready
     */
    public setQRCode(walletId: string, uri: string) {
      logger.debug('setQRCode called:', {
        walletId,
        uri: uri.substring(0, 60) + '...',
        viewState: this.viewState,
        qrCodeData: this.qrCodeData,
      });

      if (this.viewState === 'qr' && this.qrCodeData?.walletId === walletId) {
        this.qrCodeData.uri = uri;

        setTimeout(() => {
          logger.debug('Attempting to render QR code...');
          const container = this.overlayPortal?.shadowRoot?.querySelector('#qr-container');
          logger.debug('QR container found:', !!container);
          this.renderQRCode(uri);
        }, TIMINGS.QR_RENDER_DELAY);
      } else {
        logger.warn('QR code view not active or wallet mismatch', {
          viewState: this.viewState,
          expectedWallet: walletId,
          currentDataWallet: this.qrCodeData?.walletId,
        });
      }
    }

    /**
     * Render QR code using QRCodeStyling library
     * Supports both URI strings and direct image URLs (for Xaman)
     */
    private async renderQRCode(uri: string) {
      logger.debug('renderQRCode called with URI:', uri.substring(0, 60) + '...');
      const container = this.overlayPortal?.shadowRoot?.querySelector('#qr-container');
      if (!container || !uri) {
        logger.warn('No container or URI for QR code rendering');
        return;
      }

      try {
        // Check if URI is already a QR code image URL (Xaman provides PNG directly)
        if (isXamanQRImage(uri)) {
          logger.debug('Using direct QR code image from Xaman');
          container.innerHTML = `
          <img
            src="${uri}"
            alt="QR Code"
            style="width: ${SIZES.QR_CODE}px; height: ${SIZES.QR_CODE}px; border-radius: ${SIZES.QR_IMAGE_BORDER_RADIUS}px; display: block;"
          />
        `;
          return;
        }

        // Check if we have a pre-generated QR code with matching URI
        if (this.preGeneratedQRCode && this.preGeneratedURI === uri) {
          logger.debug('Using pre-generated QR code - instant render!');
          container.innerHTML = '';
          this.preGeneratedQRCode.append(container as HTMLElement);
          return;
        }

        // Otherwise, generate modern QR code with qr-code-styling
        logger.debug('Generating modern QR code from URI');
        const wallet = this.walletManager?.wallets.find((w) => w.id === this.qrCodeData?.walletId);

        const qrCode = new QRCodeStyling({
          width: QR_CONFIG.SIZE,
          height: QR_CONFIG.SIZE,
          type: 'svg',
          data: uri,
          image: wallet?.icon,
          margin: QR_CONFIG.MARGIN,
          qrOptions: {
            errorCorrectionLevel: QR_CONFIG.ERROR_CORRECTION_LEVEL,
          },
          dotsOptions: {
            type: QR_CONFIG.DOT_TYPE,
            color: QR_CONFIG.DOT_COLOR,
          },
          backgroundOptions: {
            color: QR_CONFIG.BACKGROUND_COLOR,
          },
          imageOptions: {
            crossOrigin: 'anonymous',
            margin: QR_CONFIG.IMAGE_MARGIN,
            imageSize: QR_CONFIG.IMAGE_SIZE,
          },
        });

        // Clear container and append QR code
        container.innerHTML = '';
        qrCode.append(container as HTMLElement);
        logger.debug('Modern QR code generated successfully');
      } catch (error) {
        logger.error('Failed to generate QR code:', error);
        container.innerHTML = `
        <div class="qr-loading" style="color: ${DEFAULT_THEME.DANGER_COLOR};">
          Failed to generate QR code
        </div>
      `;
      }
    }

    /**
     * Truncate address for display
     */
    private truncateAddress(
      address: string,
      chars: number = ADDRESS_DISPLAY.TRUNCATE_CHARS_DEFAULT
    ): string {
      if (address.length <= chars * 2) return address;
      return `${address.substring(0, chars)}...${address.substring(address.length - chars)}`;
    }

    /**
     * Generate a deterministic gradient from wallet address
     * Creates a unique color pair based on the address hash
     */
    private generateGradientFromAddress(address: string): { color1: string; color2: string } {
      // Simple hash function to convert address to number
      let hash = 0;
      for (let i = 0; i < address.length; i++) {
        const char = address.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
      }

      // Generate two colors from the hash
      const hue1 = Math.abs(hash % GRADIENT.HUE_MAX_DEGREES);
      const hue2 = (hue1 + GRADIENT.HUE_OFFSET_DEGREES) % GRADIENT.HUE_MAX_DEGREES;

      const color1 = `hsl(${hue1}, ${GRADIENT.SATURATION_PERCENT}%, ${GRADIENT.LIGHTNESS_PERCENT}%)`;
      const color2 = `hsl(${hue2}, ${GRADIENT.SATURATION_PERCENT}%, ${GRADIENT.LIGHTNESS_PERCENT}%)`;

      return { color1, color2 };
    }

    /**
     * Render the component
     */
    private render() {
      // Capture current modal height before re-rendering
      const existingModal = this.overlayPortal?.shadowRoot?.querySelector(
        '.modal'
      ) as HTMLElement | null;
      if (existingModal) {
        this.previousModalHeight = existingModal.offsetHeight;
      }

      this.primaryWalletId = this.getAttribute('primary-wallet');

      // Check connection state
      const isConnected = this.walletManager?.connected || false;
      const currentAccount = this.walletManager?.account;
      const buttonText =
        isConnected && currentAccount
          ? this.truncateAddress(currentAccount.address, ADDRESS_DISPLAY.TRUNCATE_CHARS_BUTTON)
          : 'Connect Wallet';

      const unavailableWalletIds = new Set(this.unavailableWallets.map((wallet) => wallet.id));
      // When unavailable wallets are visible, rebuild one configured sequence before
      // applying MRU ordering so availability does not create separate ordering buckets.
      const checkedWallets = this.showUnavailable
        ? this.parseWalletAttribute()
            .map((id) =>
              [...this.availableWallets, ...this.unavailableWallets].find(
                (wallet) => wallet.id === id
              )
            )
            .filter((wallet): wallet is WalletAdapter => wallet !== undefined)
        : this.availableWallets;
      // Once checked, an empty list means no wallet is currently available.
      const baseWallets = this.walletAvailabilityChecked
        ? checkedWallets
        : this.walletManager?.wallets || [];
      const wallets = this.showUnavailable
        ? this.orderVisibleWallets(baseWallets, unavailableWalletIds)
        : this.orderByMru(baseWallets);

      const primaryWallet = this.primaryWalletId
        ? (wallets.find(
            (wallet) => wallet.id === this.primaryWalletId && !unavailableWalletIds.has(wallet.id)
          ) ?? null)
        : null;
      const otherWallets = wallets.filter(
        (wallet) => primaryWallet === null || wallet.id !== primaryWallet.id
      );

      // Render based on view state
      let contentHTML = '';
      if (this.viewState === 'qr' && this.qrCodeData) {
        const wallet = this.walletManager?.wallets.find((w) => w.id === this.qrCodeData?.walletId);
        const walletName = wallet?.name || 'Wallet';
        contentHTML = renderQRView(walletName);
      } else if (this.viewState === 'loading' && this.loadingData) {
        contentHTML = renderLoadingView(this.loadingData.walletName, this.loadingData.walletIcon);
      } else if (this.viewState === 'error' && this.errorData) {
        contentHTML = renderErrorView(this.errorData.walletName, this.errorData.error);
      } else if (this.viewState === 'account-selection' && this.accountSelectionData) {
        contentHTML = renderAccountSelectionView(
          this.accountSelectionData.walletName,
          this.accountSelectionData.walletIcon,
          this.accountSelectionData.accounts
        );
      } else {
        contentHTML = renderWalletListView(primaryWallet, otherWallets, unavailableWalletIds);
      }

      const overlayClass = this.isFirstOpen ? 'overlay fade-in' : 'overlay';
      const modalClass = this.isFirstOpen ? 'modal slide-up' : 'modal';

      // Set flag to false after first render
      if (this.isFirstOpen) {
        this.isFirstOpen = false;
      }

      // Connect button stays in the component's own shadow root
      this.shadow.innerHTML = `
    <style>
      ${mainStyles}
    </style>
    <button class="connect-button" id="connect-wallet-button" part="connect-button">${buttonText}</button>
  `;

      // Wallet connection overlay — rendered in a portal on document.body to guarantee
      // position: fixed is always relative to the viewport (not a transformed ancestor)
      if (this.isOpen) {
        const overlayRoot = this.ensureOverlayPortal();
        overlayRoot.innerHTML = `
    <style>${mainStyles}</style>
    <div class="${overlayClass}" part="overlay">
      <div class="${modalClass}" part="modal">
        ${contentHTML}
      </div>
    </div>
  `;
      } else if (this.overlayPortal) {
        this.overlayPortal.shadowRoot!.innerHTML = '';
      }

      // Account modal — same portal approach
      if (this.accountModalOpen) {
        const accountRoot = this.ensureAccountModalPortal();
        accountRoot.innerHTML = `
    <style>${mainStyles}</style>
    ${renderAccountModal(
      this.walletManager?.account ?? null,
      this.accountBalance,
      this.truncateAddress.bind(this),
      this.generateGradientFromAddress.bind(this)
    )}
  `;
      } else if (this.accountModalPortal) {
        this.accountModalPortal.shadowRoot!.innerHTML = '';
      }

      this.eventHandler?.attachEventListeners();

      // Update modal height smoothly after render
      requestAnimationFrame(() => {
        this.updateModalHeight();
      });
    }

    /**
     * Update modal height with smooth transition
     */
    private updateModalHeight() {
      const modal = this.overlayPortal?.shadowRoot?.querySelector('.modal') as HTMLElement | null;
      if (!modal) return;

      // Use the stored previous height
      const oldHeight = this.previousModalHeight;

      // Measure new content height (modal is currently auto)
      const newHeight = modal.offsetHeight;

      // If heights are different and we have a valid old height, animate the transition
      if (oldHeight > 0 && newHeight > 0 && oldHeight !== newHeight) {
        // Set old height explicitly
        modal.style.height = `${oldHeight}px`;

        // Force reflow to apply the old height
        void modal.offsetHeight;

        // Transition to new height
        requestAnimationFrame(() => {
          modal.style.height = `${newHeight}px`;
        });
      }

      // Store current height for next transition
      this.previousModalHeight = newHeight;
    }
  }

  // Assign the class to the export variable
  WalletConnectorElement = WalletConnectorElementImpl;

  // Register the custom element
  if (!customElements.get('xrpl-wallet-connector')) {
    customElements.define('xrpl-wallet-connector', WalletConnectorElementImpl);
  }
}

// Export the class (will be null on server, defined on client)
export { WalletConnectorElement };
