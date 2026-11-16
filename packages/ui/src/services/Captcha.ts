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

const CAPTCHA_SCRIPT_LOAD_TIMEOUT = 10_000;
const scriptPromises = new Map<CaptchaProvider, Promise<void>>();

function getCaptchaApi(provider: CaptchaProvider): CaptchaApi | undefined {
  return typeof window === 'undefined' ? undefined : window[provider];
}

function loadCaptchaScript(provider: CaptchaProvider, nonce?: string): Promise<void> {
  if (getCaptchaApi(provider)) return Promise.resolve();

  const existing = scriptPromises.get(provider);
  if (existing) return existing;

  let promise: Promise<void>;
  const attempt = new Promise<void>((resolve, reject) => {
    const selector = `script[data-xrpl-captcha-provider="${provider}"]`;
    const script =
      document.querySelector<HTMLScriptElement>(selector) ?? document.createElement('script');
    const ownedScript = !script.parentNode || script.dataset.xrplCaptchaOwned === 'true';
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const removeListeners = () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };

    const removeOwnedScript = () => {
      if (ownedScript) script.remove();
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      removeListeners();
      removeOwnedScript();
      reject(error);
    };

    const handleLoad = () => {
      if (getCaptchaApi(provider)) {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        removeListeners();
        resolve();
      } else {
        fail(new Error(`The ${provider} CAPTCHA API did not load.`));
      }
    };
    const handleError = () => fail(new Error(`The ${provider} CAPTCHA script could not load.`));

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    if (!script.parentNode) {
      script.async = true;
      script.src = CAPTCHA_SCRIPT_URLS[provider];
      script.dataset.xrplCaptchaProvider = provider;
      script.dataset.xrplCaptchaOwned = 'true';
      if (nonce) script.nonce = nonce;
      (document.head ?? document.documentElement).append(script);
    } else if ((script as HTMLScriptElement & { readyState?: string }).readyState === 'complete') {
      queueMicrotask(handleLoad);
    }
    timeout = setTimeout(
      () => fail(new Error(`The ${provider} CAPTCHA script timed out while loading.`)),
      CAPTCHA_SCRIPT_LOAD_TIMEOUT
    );
  });
  promise = attempt.catch((error) => {
    if (scriptPromises.get(provider) === promise) scriptPromises.delete(provider);
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
      if (typeof api.remove === 'function') api.remove(widgetId);
      else api.reset?.(widgetId);
    } catch {
      // Provider cleanup must never interrupt modal transitions or cancellation.
    } finally {
      while (container.firstChild) container.removeChild(container.firstChild);
    }
  };
}
