import { describe, it, expect, vi } from 'vitest';
import { EventHandler } from '../src/services/EventHandler';

describe('EventHandler', () => {
  it('should attach event listeners', () => {
    const mockComponent = {
      shadow: {
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(() => []),
      },
      open: vi.fn(),
    };
    const eventHandler = new EventHandler(mockComponent as any, {} as any);

    const mockButton = {
      addEventListener: vi.fn(),
    };
    mockComponent.shadow.querySelector.mockReturnValue(mockButton);

    eventHandler.attachEventListeners();

    expect(mockComponent.shadow.querySelector).toHaveBeenCalledWith('#connect-wallet-button');
    expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });
});
