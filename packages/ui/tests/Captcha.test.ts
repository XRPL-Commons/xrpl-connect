import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

type CaptchaApiStub = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove?: (widgetId?: string) => void;
  reset?: (widgetId?: string) => void;
};

function setCaptchaApi(provider: 'turnstile' | 'hcaptcha', api: CaptchaApiStub): void {
  Object.defineProperty(window, provider, {
    configurable: true,
    value: api,
  });
}

afterEach(() => {
  vi.useRealTimers();
  document
    .querySelectorAll('script[data-xrpl-captcha-provider]')
    .forEach((script) => script.remove());
  document.body.replaceChildren();
  delete (window as Window & { turnstile?: unknown }).turnstile;
  delete (window as Window & { hcaptcha?: unknown }).hcaptcha;
});

describe('CAPTCHA lifecycle', () => {
  it('removes a failed owned script and retries with a fresh load', async () => {
    vi.resetModules();
    const { renderCaptchaWidget } = await import('../src/services/Captcha');
    const container = document.createElement('div');
    document.body.append(container);

    const firstAttempt = renderCaptchaWidget(
      container,
      'turnstile',
      'site-key',
      undefined,
      vi.fn(),
      vi.fn(),
      vi.fn()
    );
    const firstScript = document.querySelector<HTMLScriptElement>(
      'script[data-xrpl-captcha-provider="turnstile"]'
    );
    expect(firstScript).not.toBeNull();
    firstScript!.dispatchEvent(new Event('error'));
    await expect(firstAttempt).rejects.toThrow(/could not load/i);
    expect(firstScript?.isConnected).toBe(false);

    const render = vi.fn(() => 'widget-2');
    setCaptchaApi('turnstile', { render });
    const cleanup = await renderCaptchaWidget(
      container,
      'turnstile',
      'site-key',
      undefined,
      vi.fn(),
      vi.fn(),
      vi.fn()
    );
    expect(render).toHaveBeenCalledOnce();
    cleanup();
  });

  it('bounds a stalled script load and removes its owned script', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const { renderCaptchaWidget } = await import('../src/services/Captcha');
    const container = document.createElement('div');
    document.body.append(container);

    const attempt = renderCaptchaWidget(
      container,
      'hcaptcha',
      'site-key',
      undefined,
      vi.fn(),
      vi.fn(),
      vi.fn()
    );
    const script = document.querySelector<HTMLScriptElement>(
      'script[data-xrpl-captcha-provider="hcaptcha"]'
    );
    expect(script).not.toBeNull();
    const rejection = expect(attempt).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(10_001);
    await rejection;
    expect(script?.isConnected).toBe(false);
  });

  it('ignores a completed load after the prompt container is detached', async () => {
    vi.resetModules();
    const { renderCaptchaWidget } = await import('../src/services/Captcha');
    const container = document.createElement('div');
    document.body.append(container);
    const render = vi.fn(() => 'widget');
    const attempt = renderCaptchaWidget(
      container,
      'turnstile',
      'site-key',
      undefined,
      vi.fn(),
      vi.fn(),
      vi.fn()
    );
    const script = document.querySelector<HTMLScriptElement>(
      'script[data-xrpl-captcha-provider="turnstile"]'
    );
    container.remove();
    setCaptchaApi('turnstile', { render });
    script!.dispatchEvent(new Event('load'));

    const cleanup = await attempt;
    expect(render).not.toHaveBeenCalled();
    expect(() => cleanup()).not.toThrow();
  });

  it('isolates provider cleanup failures and uses reset only as a fallback', async () => {
    vi.resetModules();
    const { renderCaptchaWidget } = await import('../src/services/Captcha');
    const container = document.createElement('div');
    document.body.append(container);
    const remove = vi.fn(() => {
      throw new Error('provider cleanup failed');
    });
    const reset = vi.fn();
    setCaptchaApi('turnstile', {
      render: vi.fn(() => 'widget'),
      remove,
      reset,
    });

    const cleanup = await renderCaptchaWidget(
      container,
      'turnstile',
      'site-key',
      undefined,
      vi.fn(),
      vi.fn(),
      vi.fn()
    );
    expect(() => cleanup()).not.toThrow();
    expect(remove).toHaveBeenCalledWith('widget');
    expect(reset).not.toHaveBeenCalled();
    expect(container.childElementCount).toBe(0);

    const fallbackReset = vi.fn();
    setCaptchaApi('hcaptcha', {
      render: vi.fn(() => 'fallback-widget'),
      reset: fallbackReset,
    });
    const fallbackCleanup = await renderCaptchaWidget(
      container,
      'hcaptcha',
      'site-key',
      undefined,
      vi.fn(),
      vi.fn(),
      vi.fn()
    );
    fallbackCleanup();
    expect(fallbackReset).toHaveBeenCalledWith('fallback-widget');
  });
});
