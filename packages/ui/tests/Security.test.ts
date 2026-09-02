import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { WalletAdapter } from '@xrpl-connect/core';
import { TIMINGS } from '../src/constants';
import { getSafeDeepLinkUrl, getSafeImageUrl } from '../src/security';
import { isXamanQRImage } from '../src/utils';
import { renderAccountModal } from '../src/views/AccountModal';
import { renderAccountSelectionView } from '../src/views/AccountSelectionView';
import { renderErrorView } from '../src/views/ErrorView';
import { renderLoadingView } from '../src/views/LoadingView';
import { renderQRView } from '../src/views/QRView';
import { renderWalletListView } from '../src/views/WalletListView';
import '../src/wallet-connector';

const HOSTILE_TEXT = `"><img data-xss onerror="globalThis.__xssExecuted=true"><script data-xss></script>`;

function mount(fragment: DocumentFragment): HTMLDivElement {
  const host = document.createElement('div');
  host.append(fragment);
  return host;
}

function expectNoInjectedMarkup(root: ParentNode): void {
  expect(root.querySelector('[data-xss]')).toBeNull();
  expect(root.querySelector('[onerror], [onfocus], [onclick]')).toBeNull();
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('safe wallet connector rendering', () => {
  it('renders without the newer ParentNode.replaceChildren API', async () => {
    const prototypes = [Element.prototype, DocumentFragment.prototype];
    const descriptors = prototypes.map((prototype) =>
      Object.getOwnPropertyDescriptor(prototype, 'replaceChildren')
    );

    try {
      for (const prototype of prototypes) {
        Object.defineProperty(prototype, 'replaceChildren', {
          configurable: true,
          value: undefined,
        });
      }

      const connector = document.createElement('xrpl-wallet-connector') as HTMLElement & {
        open(): Promise<void>;
        getOverlayRoot(): ShadowRoot | null;
      };
      document.body.append(connector);

      expect(connector.shadowRoot?.querySelector('#connect-wallet-button')).not.toBeNull();
      await connector.open();
      expect(connector.getOverlayRoot()?.querySelector('[role="dialog"]')).not.toBeNull();
    } finally {
      prototypes.forEach((prototype, index) => {
        const descriptor = descriptors[index];
        if (descriptor) Object.defineProperty(prototype, 'replaceChildren', descriptor);
        else Reflect.deleteProperty(prototype, 'replaceChildren');
      });
    }
  });

  it('renders hostile provider text as text across every view', () => {
    const error = mount(renderErrorView(HOSTILE_TEXT, new Error(HOSTILE_TEXT)));
    expect(error.querySelector('.error-title')?.textContent).toBe(
      `Failed to connect to ${HOSTILE_TEXT}`
    );
    expect(error.querySelector('.error-message')?.textContent).toBe(HOSTILE_TEXT);

    const loading = mount(renderLoadingView(HOSTILE_TEXT));
    expect(loading.querySelector('.loading-wallet-message')?.textContent).toBe(
      `Check your ${HOSTILE_TEXT}`
    );

    const qr = mount(renderQRView(HOSTILE_TEXT));
    expect(qr.querySelector('.title')?.textContent).toBe(HOSTILE_TEXT);

    const selection = mount(
      renderAccountSelectionView(HOSTILE_TEXT, undefined, [
        {
          address: HOSTILE_TEXT,
          publicKey: HOSTILE_TEXT,
          path: HOSTILE_TEXT,
          index: HOSTILE_TEXT as unknown as number,
        },
      ])
    );
    expect(selection.querySelector('.account-selection-description')?.textContent).toBe(
      `Select which account to connect from your ${HOSTILE_TEXT}`
    );
    expect(selection.querySelector('.account-address-value')?.textContent).toBe(HOSTILE_TEXT);
    expect((selection.querySelector('.account-button') as HTMLElement).dataset.accountIndex).toBe(
      HOSTILE_TEXT
    );

    const account = mount(
      renderAccountModal(
        { address: HOSTILE_TEXT },
        HOSTILE_TEXT,
        (address) => address,
        () => ({ color1: '#000000', color2: '#ffffff' })
      )
    );
    expect(account.querySelector('.account-address-text')?.textContent).toBe(HOSTILE_TEXT);
    expect(account.querySelector('.account-balance-value')?.textContent).toBe(HOSTILE_TEXT);

    for (const view of [error, loading, qr, selection, account]) expectNoInjectedMarkup(view);
  });

  it('sets hostile wallet metadata through DOM properties without creating attributes', () => {
    const wallet = {
      id: HOSTILE_TEXT,
      name: HOSTILE_TEXT,
      icon: `javascript:${HOSTILE_TEXT}`,
    } as unknown as WalletAdapter;
    const unavailable = {
      ...wallet,
      id: `unavailable-${HOSTILE_TEXT}`,
      url: `https://example.com/\" autofocus onfocus=\"${HOSTILE_TEXT}`,
    } as unknown as WalletAdapter;
    const host = mount(renderWalletListView(wallet, [unavailable], new Set([unavailable.id])));

    const primary = host.querySelector<HTMLElement>('.primary-button');
    const install = host.querySelector<HTMLElement>('.wallet-button--unavailable');
    expect(primary?.dataset.walletId).toBe(HOSTILE_TEXT);
    expect(primary?.textContent).toContain(HOSTILE_TEXT);
    expect(install?.getAttribute('aria-label')).toBe(`Install ${HOSTILE_TEXT}`);
    expect(host.querySelector('img')).toBeNull();
    expectNoInjectedMarkup(host);
  });

  it('allows supported image URLs and rejects executable or unexpected schemes', () => {
    const bundledSvg =
      'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E';
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    expect(getSafeImageUrl('https://example.com/icon.png')).toBe('https://example.com/icon.png');
    expect(getSafeImageUrl('http://example.com/icon.png')).toBe('http://example.com/icon.png');
    expect(getSafeImageUrl(bundledSvg)).toBe(bundledSvg);
    expect(getSafeImageUrl(png)).toBe(png);

    for (const unsafe of [
      'javascript:alert(1)',
      'vbscript:msgbox(1)',
      'data:text/html,<script>alert(1)</script>',
      'data:image/png;evil=value,AAAA',
      'blob:https://example.com/id',
      'file:///tmp/icon.png',
      '/relative/icon.png',
    ]) {
      expect(getSafeImageUrl(unsafe)).toBeNull();
      expect(mount(renderLoadingView('Wallet', unsafe)).querySelector('img')).toBeNull();
    }

    expect(mount(renderLoadingView('Wallet', bundledSvg)).querySelector('img')?.src).toBe(
      bundledSvg
    );
  });

  it('recognizes only HTTPS Xaman QR image URLs on the expected origin and path', () => {
    expect(isXamanQRImage('https://xumm.app/sign/request.png')).toBe(true);
    expect(isXamanQRImage('https://xumm.app/sign/request.png?cache=1')).toBe(true);
    expect(isXamanQRImage('http://xumm.app/sign/request.png')).toBe(false);
    expect(isXamanQRImage('https://evil.example/xumm.app/sign/request.png')).toBe(false);
    expect(isXamanQRImage('https://xumm.app.evil.example/sign/request.png')).toBe(false);
    expect(isXamanQRImage('javascript://xumm.app/sign/request.png')).toBe(false);
  });

  it('preserves wallet deep-link schemes while rejecting executable URLs', () => {
    expect(getSafeDeepLinkUrl('https://xumm.app/sign/request')).toBe(
      'https://xumm.app/sign/request'
    );
    expect(getSafeDeepLinkUrl('xumm://xumm.app/sign/request')).toBe('xumm://xumm.app/sign/request');
    expect(getSafeDeepLinkUrl('wc:topic@2?relay-protocol=irn')).toBe(
      'wc:topic@2?relay-protocol=irn'
    );
    for (const unsafe of [
      'javascript:alert(1)',
      'java\nscript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'blob:https://example.com/id',
      'file:///tmp/payload',
      '/relative/path',
    ]) {
      expect(getSafeDeepLinkUrl(unsafe)).toBeNull();
    }
  });

  it('renders direct QR images with DOM APIs and refuses origin-confusion payloads', async () => {
    vi.useFakeTimers();
    const connector = document.createElement('xrpl-wallet-connector') as HTMLElement & {
      open(): Promise<void>;
      showQRCodeView(walletId: string, uri?: string): void;
      setQRCode(walletId: string, uri: string): void;
      getOverlayRoot(): ShadowRoot | null;
    };
    document.body.append(connector);
    await connector.open();
    connector.showQRCodeView('xaman');

    const safeImage = 'https://xumm.app/sign/request.png';
    connector.setQRCode('xaman', safeImage);
    await vi.advanceTimersByTimeAsync(TIMINGS.QR_RENDER_DELAY);
    const qrImage = connector
      .getOverlayRoot()
      ?.querySelector<HTMLImageElement>('#qr-container img');
    expect(qrImage?.src).toBe(safeImage);
    expect(qrImage?.getAttribute('onerror')).toBeNull();

    connector.showQRCodeView('xaman');
    connector.setQRCode('xaman', 'https://evil.example/xumm.app/sign/request.png');
    await vi.advanceTimersByTimeAsync(TIMINGS.QR_RENDER_DELAY);
    expect(connector.getOverlayRoot()?.querySelector('#qr-container img')).toBeNull();
  });
});
