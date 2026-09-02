import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { configureLogger, Logger, resetGlobalLogger } from './logger';

afterEach(() => {
  resetGlobalLogger();
});

describe('custom logger routing', () => {
  it('delivers every level to a custom logger under the default production threshold', () => {
    const custom = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    configureLogger(custom);
    const logger = new Logger({ prefix: '[test]' });

    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');

    expect(custom.debug).toHaveBeenCalledWith('[test] debug');
    expect(custom.info).toHaveBeenCalledWith('[test] info');
    expect(custom.warn).toHaveBeenCalledWith('[test] warn');
    expect(custom.error).toHaveBeenCalledWith('[test] error');
  });
});
