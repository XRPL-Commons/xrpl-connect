import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { configureLogger, Logger, resetGlobalLogger } from './logger';

afterEach(() => {
  resetGlobalLogger();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function createCustomLogger(level?: 'debug' | 'info' | 'warn' | 'error' | 'silent') {
  return {
    level,
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function logEveryLevel(logger: Logger): void {
  logger.debug('debug');
  logger.info('info');
  logger.warn('warn');
  logger.error('error');
}

describe('custom logger routing', () => {
  it('applies the default production threshold to a custom logger without a level', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const custom = createCustomLogger();
    configureLogger(custom);

    logEveryLevel(new Logger({ prefix: '[test]' }));

    expect(custom.debug).not.toHaveBeenCalled();
    expect(custom.info).not.toHaveBeenCalled();
    expect(custom.warn).toHaveBeenCalledWith('[test] warn');
    expect(custom.error).toHaveBeenCalledWith('[test] error');
  });

  it('delivers every level to a custom logger that opts into debug', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const custom = createCustomLogger('debug');
    configureLogger(custom);

    logEveryLevel(new Logger({ prefix: '[test]' }));

    expect(custom.debug).toHaveBeenCalledWith('[test] debug');
    expect(custom.info).toHaveBeenCalledWith('[test] info');
    expect(custom.warn).toHaveBeenCalledWith('[test] warn');
    expect(custom.error).toHaveBeenCalledWith('[test] error');
  });

  it('honours a silent level on a custom logger', () => {
    const custom = createCustomLogger('silent');
    configureLogger(custom);

    logEveryLevel(new Logger({ prefix: '[test]' }));

    expect(custom.debug).not.toHaveBeenCalled();
    expect(custom.info).not.toHaveBeenCalled();
    expect(custom.warn).not.toHaveBeenCalled();
    expect(custom.error).not.toHaveBeenCalled();
  });
});

describe('default log level', () => {
  it('uses debug only when NODE_ENV is development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(new Logger().getLevel()).toBe('debug');
  });

  it.each(['my-app.pages.dev', 'wallet.dev', 'devnet.example.com', 'localhost', '127.0.0.1'])(
    'does not infer development mode from the %s hostname',
    (hostname) => {
      vi.stubEnv('NODE_ENV', '');
      vi.stubGlobal('window', { location: { hostname } });

      expect(new Logger().getLevel()).toBe('warn');
    }
  );
});
