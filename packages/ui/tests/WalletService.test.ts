import { afterEach, describe, it, expect, vi } from 'vitest';
import { TIME } from '@xrpl-connect/core';
import { WalletService } from '../src/services/WalletService';

afterEach(() => {
  vi.useRealTimers();
});

describe('WalletService', () => {
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
        detail: expect.objectContaining({ walletId: 'ledger', errorType: 'unavailable' }),
      })
    );
  });
});
