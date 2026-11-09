export type CaptchaProvider = 'turnstile' | 'hcaptcha';

interface CaptchaApi {
  render(container: HTMLElement, options: Record<string, unknown>): string | number;
  reset?(widgetId?: string | number): void;
  remove?(widgetId?: string | number): void;
}

declare global {
  interface Window {
    turnstile?: CaptchaApi;
    hcaptcha?: CaptchaApi;
  }
}

const CAPTCHA_SCRIPT_URLS: Record<CaptchaProvider, string> = {
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
  hcaptcha: 'https://js.hcaptcha.com/1/api.js?render=explicit',
};

const scriptPromises = new Map<CaptchaProvider, Promise<void>>();

function getCaptchaApi(provider: CaptchaProvider): CaptchaApi | undefined {
  return typeof window === 'undefined' ? undefined : window[provider];
}

function loadCaptchaScript(provider: CaptchaProvider, nonce?: string): Promise<void> {
  if (getCaptchaApi(provider)) return Promise.resolve();

  const existing = scriptPromises.get(provider);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const selector = `script[data-xrpl-captcha-provider="${provider}"]`;
    const script =
      document.querySelector<HTMLScriptElement>(selector) ?? document.createElement('script');
    const finish = () => {
      if (getCaptchaApi(provider)) resolve();
      else reject(new Error(`The ${provider} CAPTCHA API did not load.`));
    };

    script.addEventListener('load', finish, { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error(`The ${provider} CAPTCHA script could not load.`)),
      { once: true }
    );
    if (!script.parentNode) {
      script.async = true;
      script.src = CAPTCHA_SCRIPT_URLS[provider];
      script.dataset.xrplCaptchaProvider = provider;
      if (nonce) script.nonce = nonce;
      (document.head ?? document.documentElement).append(script);
    }
  }).catch((error) => {
    scriptPromises.delete(provider);
    throw error;
  });

  scriptPromises.set(provider, promise);
  return promise;
}

export async function renderCaptchaWidget(
  container: HTMLElement,
  provider: CaptchaProvider,
  siteKey: string,
  nonce: string | undefined,
  onToken: (token: string) => void,
  onExpired: () => void,
  onError: () => void
): Promise<() => void> {
  await loadCaptchaScript(provider, nonce);
  const api = getCaptchaApi(provider);
  if (!api || !container.isConnected) return () => undefined;

  const widgetId = api.render(container, {
    sitekey: siteKey,
    callback: onToken,
    'expired-callback': onExpired,
    'error-callback': onError,
  });

  return () => {
    try {
      api.remove?.(widgetId);
      api.reset?.(widgetId);
    } finally {
      while (container.firstChild) container.removeChild(container.firstChild);
    }
  };
}
