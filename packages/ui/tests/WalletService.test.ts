import { afterEach, describe, it, expect, vi } from 'vite-plus/test';
import { TIME } from '@xrpl-connect/core';
import { WalletService } from '../src/services/WalletService';

afterEach(() => {
  vi.useRealTimers();
});

describe('WalletService', () => {
  it('starts Xaman connection without deferring beyond the user activation task', async () => {
    vi.useFakeTimers();
    const connect = vi.fn(async () => undefined);
    const mockWalletManager = {
      wallets: [{ id: 'xaman', name: 'Xaman' }],
      connect,
    };
    const mockComponent = {
      showLoadingView: vi.fn(),
      showQRCodeView: vi.fn(),
      showAccountSelectionView: vi.fn(),
      showErrorView: vi.fn(),
      dispatchEvent: vi.fn(),
      setQRCode: vi.fn(),
      close: vi.fn(),
    };
    const walletService = new WalletService(mockWalletManager as any, mockComponent as any);

    const connection = walletService.connectWallet('xaman');

    expect(connect).toHaveBeenCalledWith('xaman', undefined);
    await connection;

    const lifecycleEvents = mockComponent.dispatchEvent.mock.calls.map(
      ([event]) => event as CustomEvent<{ connectionAttemptId?: number }>
    );
    const connecting = lifecycleEvents.find((event) => event.type === 'connecting');
    const connected = lifecycleEvents.find((event) => event.type === 'connected');
    expect(connecting?.detail.connectionAttemptId).toEqual(expect.any(Number));
    expect(connected?.detail.connectionAttemptId).toBe(connecting?.detail.connectionAttemptId);
  });

  it('uses the same attempt id for a connection failure', async () => {
    const connectionError = new Error('rejected');
    const mockWalletManager = {
      wallets: [{ id: 'xaman', name: 'Xaman' }],
      connect: vi.fn(async () => {
        throw connectionError;
      }),
    };
    const mockComponent = {
      showLoadingView: vi.fn(),
      showQRCodeView: vi.fn(),
      showAccountSelectionView: vi.fn(),
      showErrorView: vi.fn(),
      dispatchEvent: vi.fn(),
      setQRCode: vi.fn(),
      close: vi.fn(),
    };
    const walletService = new WalletService(mockWalletManager as any, mockComponent as any);

    await walletService.connectWallet('xaman');

    const lifecycleEvents = mockComponent.dispatchEvent.mock.calls.map(
      ([event]) => event as CustomEvent<{ connectionAttemptId?: number }>
    );
    const connecting = lifecycleEvents.find((event) => event.type === 'connecting');
    const error = lifecycleEvents.find((event) => event.type === 'error');
    expect(error?.detail.connectionAttemptId).toBe(connecting?.detail.connectionAttemptId);
  });

  it('should connect to a wallet', async () => {
    const isAvailable = vi.fn(async () => true);
    const mockWalletManager = {
      wallets: [{ id: 'mockWallet', name: 'Mock Wallet', isAvailable }],
      connect: vi.fn(),
    };
    const mockComponent = {
      showLoadingView: vi.fn(),
      showQRCodeView: vi.fn(),
      showAccountSelectionView: vi.fn(),
      showErrorView: vi.fn(),
      dispatchEvent: vi.fn(),
      setQRCode: vi.fn(),
      close: vi.fn(),
    };
    const walletService = new WalletService(mockWalletManager as any, mockComponent as any);

    await walletService.connectWallet('mockWallet');

    expect(mockWalletManager.connect).toHaveBeenCalledWith('mockWallet', undefined);
    expect(isAvailable).not.toHaveBeenCalled();
  });

  it('shows an unavailable error when the Ledger availability check times out', async () => {
    vi.useFakeTimers();
    const getAccounts = vi.fn();
    const mockWalletManager = {
      wallets: [
        {
          id: 'ledger',
          name: 'Ledger',
          isAvailable: vi.fn(() => new Promise<boolean>(() => {})),
          getAccounts,
        },
      ],
      connect: vi.fn(),
    };
    const mockComponent = {
      showLoadingView: vi.fn(),
      showQRCodeView: vi.fn(),
      showAccountSelectionView: vi.fn(),
      showErrorView: vi.fn(),
      dispatchEvent: vi.fn(),
      setQRCode: vi.fn(),
      close: vi.fn(),
    };
    const walletService = new WalletService(mockWalletManager as any, mockComponent as any);

    const connection = walletService.connectWallet('ledger');
    await vi.advanceTimersByTimeAsync(TIME.AVAILABILITY_TIMEOUT);
    await connection;

    expect(mockWalletManager.connect).not.toHaveBeenCalled();
    expect(getAccounts).not.toHaveBeenCalled();
    expect(mockComponent.showErrorView).toHaveBeenCalledWith(
      'ledger',
      'Ledger',
      expect.objectContaining({ message: 'Ledger did not respond. Please try again.' })
    );
    expect(mockComponent.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          walletId: 'ledger',
          errorType: 'unavailable',
          connectionAttemptId: expect.any(Number),
        }),
      })
    );
  });

  it('does not start a delayed connection after pending work is cancelled', async () => {
    vi.useFakeTimers();
    const connect = vi.fn();
    const mockWalletManager = {
      wallets: [{ id: 'mockWallet', name: 'Mock Wallet' }],
      connect,
    };
    const mockComponent = {
      showLoadingView: vi.fn(),
      showQRCodeView: vi.fn(),
      showAccountSelectionView: vi.fn(),
      showErrorView: vi.fn(),
      dispatchEvent: vi.fn(),
      setQRCode: vi.fn(),
      close: vi.fn(),
    };
    const walletService = new WalletService(mockWalletManager as any, mockComponent as any);

    const connection = walletService.connectWallet('mockWallet');
    walletService.cancelPendingWork();
    await vi.runAllTimersAsync();
    await connection;

    expect(connect).not.toHaveBeenCalled();
    expect(mockComponent.showErrorView).not.toHaveBeenCalled();
    expect(
      mockComponent.dispatchEvent.mock.calls.some(([event]) => (event as Event).type === 'error')
    ).toBe(false);
  });

  it('does not show stale Ledger accounts after pending work is cancelled', async () => {
    vi.useFakeTimers();
    let resolveAccounts!: (accounts: { address: string; index: number }[]) => void;
    const getAccounts = vi.fn(
      () =>
        new Promise<{ address: string; index: number }[]>((resolve) => {
          resolveAccounts = resolve;
        })
    );
    const mockWalletManager = {
      wallets: [
        {
          id: 'ledger',
          name: 'Ledger',
          isAvailable: vi.fn(async () => true),
          getAccounts,
        },
      ],
      connect: vi.fn(),
    };
    const mockComponent = {
      showLoadingView: vi.fn(),
      showQRCodeView: vi.fn(),
      showAccountSelectionView: vi.fn(),
      showErrorView: vi.fn(),
      dispatchEvent: vi.fn(),
      setQRCode: vi.fn(),
      close: vi.fn(),
    };
    const walletService = new WalletService(mockWalletManager as any, mockComponent as any);

    const connection = walletService.connectWallet('ledger');
    await vi.runAllTimersAsync();
    expect(getAccounts).toHaveBeenCalledOnce();

    walletService.cancelPendingWork();
    resolveAccounts([{ address: 'rLedger', index: 0 }]);
    await connection;

    expect(mockComponent.showAccountSelectionView).not.toHaveBeenCalled();
    expect(mockComponent.showErrorView).not.toHaveBeenCalled();
  });
});
