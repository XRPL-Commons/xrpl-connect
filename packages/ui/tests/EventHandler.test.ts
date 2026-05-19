import { describe, it, expect, vi } from 'vitest';
import { EventHandler } from '../src/services/EventHandler';

/**
 * Build a minimal mock component whose shadow / overlay / account roots return
 * the same `host` element for every selector. Counting listeners on a single
 * real DOM node is enough to detect both the original leak (attach without
 * detach) and the regression we are guarding against (re-attach without
 * dropping the previous bindings).
 */
function makeComponentBackedBy(host: HTMLElement) {
  const root = {
    querySelector: vi.fn(() => host),
    querySelectorAll: vi.fn(() => [] as Element[]),
  };
  return {
    shadow: root,
    getOverlayRoot: vi.fn(() => root),
    getAccountModalRoot: vi.fn(() => root),
    open: vi.fn(),
  };
}

describe('EventHandler', () => {
  it('attaches event listeners', () => {
    const mockPortalRoot = {
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
    };
    const mockComponent = {
      shadow: {
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(() => []),
      },
      getOverlayRoot: vi.fn(() => mockPortalRoot),
      getAccountModalRoot: vi.fn(() => mockPortalRoot),
      open: vi.fn(),
    };
    const eventHandler = new EventHandler(mockComponent as any, {} as any);

    const mockButton = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    mockComponent.shadow.querySelector.mockReturnValue(mockButton);

    eventHandler.attachEventListeners();

    expect(mockComponent.shadow.querySelector).toHaveBeenCalledWith('#connect-wallet-button');
    expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('removes every attached listener on detach', () => {
    const host = document.createElement('div');
    let net = 0;
    const origAdd = host.addEventListener.bind(host);
    const origRemove = host.removeEventListener.bind(host);
    host.addEventListener = ((type: string, handler: any, opts?: any) => {
      net++;
      return origAdd(type, handler, opts);
    }) as typeof host.addEventListener;
    host.removeEventListener = ((type: string, handler: any, opts?: any) => {
      net--;
      return origRemove(type, handler, opts);
    }) as typeof host.removeEventListener;

    const eventHandler = new EventHandler(makeComponentBackedBy(host) as any, {} as any);

    eventHandler.attachEventListeners();
    expect(net).toBeGreaterThan(0);

    eventHandler.detachEventListeners();
    expect(net).toBe(0);
  });

  it('does not accumulate listeners across repeated attach calls', () => {
    const host = document.createElement('div');
    let net = 0;
    const origAdd = host.addEventListener.bind(host);
    const origRemove = host.removeEventListener.bind(host);
    host.addEventListener = ((type: string, handler: any, opts?: any) => {
      net++;
      return origAdd(type, handler, opts);
    }) as typeof host.addEventListener;
    host.removeEventListener = ((type: string, handler: any, opts?: any) => {
      net--;
      return origRemove(type, handler, opts);
    }) as typeof host.removeEventListener;

    const eventHandler = new EventHandler(makeComponentBackedBy(host) as any, {} as any);

    eventHandler.attachEventListeners();
    const afterFirst = net;

    // Re-attach simulates what render() does on every view change. Without the
    // detach-before-attach guard, listeners would stack on the same element.
    eventHandler.attachEventListeners();
    eventHandler.attachEventListeners();

    expect(net).toBe(afterFirst);

    eventHandler.detachEventListeners();
    expect(net).toBe(0);
  });
});
