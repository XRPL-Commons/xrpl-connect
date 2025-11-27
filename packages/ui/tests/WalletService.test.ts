import { describe, it, expect, vi } from 'vitest';
import { WalletService } from '../src/services/WalletService';

describe('WalletService', () => {
  it('should connect to a wallet', async () => {
    const mockWalletManager = {
      wallets: [{ id: 'mockWallet', name: 'Mock Wallet', isAvailable: async () => true }],
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
  });
});
