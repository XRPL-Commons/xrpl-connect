/**
 * Logging system for xrpl-connect
 * Supports dev/prod mode with configurable log levels and custom logger instances
 */

import type { LoggerOptions, LoggerInstance, LogLevel } from './types';

type InternalLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<InternalLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function normalizeLevel(level: LogLevel | undefined): InternalLogLevel | undefined {
  if (!level) return undefined;
  return level === 'none' ? 'silent' : level;
}

/**
 * Detect if running in development mode
 */
function isDevelopment(): boolean {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    return process.env.NODE_ENV === 'development';
  }
  // Fallback: check for localhost
  if (typeof window !== 'undefined') {
    return (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('dev')
    );
  }
  return false;
}

/**
 * Type guard for a user-supplied LoggerInstance.
 */
export function isLoggerInstance(value: unknown): value is LoggerInstance {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.debug === 'function' &&
    typeof candidate.info === 'function' &&
    typeof candidate.warn === 'function' &&
    typeof candidate.error === 'function'
  );
}

interface GlobalLoggerConfig {
  instance?: LoggerInstance;
  level?: InternalLogLevel;
}

const GLOBAL_LOGGER_CONFIG = Symbol.for('xrpl-connect.logger.config');
const globalScope = globalThis as typeof globalThis & {
  [GLOBAL_LOGGER_CONFIG]?: GlobalLoggerConfig;
};

function getGlobalConfig(): GlobalLoggerConfig {
  return (globalScope[GLOBAL_LOGGER_CONFIG] ??= {});
}

function setGlobalConfig(config: GlobalLoggerConfig): void {
  globalScope[GLOBAL_LOGGER_CONFIG] = config;
}

/**
 * Configure the global logger used by every `Logger` instance — including the
 * per-adapter loggers created via `createLogger`. Called by `WalletManager`
 * when a consumer passes `logger` in `WalletManagerOptions`.
 *
 * - A `LoggerInstance` routes every subsequent log call (from the manager and
 *   all adapters) into the supplied object.
 * - A `LoggerOptions` value sets a global default level. Per-logger overrides
 *   still win when explicitly set.
 * - `undefined` resets the global configuration.
 */
export function configureLogger(option: LoggerOptions | LoggerInstance | undefined): void {
  if (option === undefined) {
    setGlobalConfig({});
    return;
  }
  if (isLoggerInstance(option)) {
    setGlobalConfig({ instance: option, level: 'debug' });
    return;
  }
  setGlobalConfig({ level: normalizeLevel(option.level) });
}

/**
 * Reset the global logger configuration. Exposed primarily for tests.
 */
export function resetGlobalLogger(): void {
  setGlobalConfig({});
}

/**
 * Logger class for structured logging.
 *
 * Resolution order for the effective level:
 *   1. Explicit level passed to the constructor / `setLevel`.
 *   2. Global level set via `configureLogger`.
 *   3. `'debug'` in development, `'warn'` in production.
 *
 * When a custom `LoggerInstance` is configured globally, all log calls are
 * routed to that instance instead of `console.*`.
 */
export class Logger {
  private localLevel?: InternalLogLevel;
  private prefix: string;

  constructor(options: LoggerOptions = {}) {
    this.localLevel = normalizeLevel(options.level);
    this.prefix = options.prefix || '[xrpl-connect]';
  }

  /**
   * Compute the level that should apply to this logger right now.
   */
  private effectiveLevel(): InternalLogLevel {
    if (this.localLevel) return this.localLevel;
    const { level } = getGlobalConfig();
    if (level) return level;
    return isDevelopment() ? 'debug' : 'warn';
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: Exclude<InternalLogLevel, 'silent'>): boolean {
    const effective = this.effectiveLevel();
    if (effective === 'silent') return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[effective];
  }

  /**
   * Format log message with prefix
   */
  private formatMessage(level: InternalLogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `${this.prefix} [${level.toUpperCase()}] ${timestamp} - ${message}`;
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('debug')) return;
    const { instance } = getGlobalConfig();
    if (instance) {
      instance.debug(`${this.prefix} ${message}`, ...args);
      return;
    }
    console.debug(this.formatMessage('debug', message), ...args);
  }

  /**
   * Log info message
   */
  info(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('info')) return;
    const { instance } = getGlobalConfig();
    if (instance) {
      instance.info(`${this.prefix} ${message}`, ...args);
      return;
    }
    console.info(this.formatMessage('info', message), ...args);
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('warn')) return;
    const { instance } = getGlobalConfig();
    if (instance) {
      instance.warn(`${this.prefix} ${message}`, ...args);
      return;
    }
    console.warn(this.formatMessage('warn', message), ...args);
  }

  /**
   * Log error message
   */
  error(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('error')) return;
    const { instance } = getGlobalConfig();
    if (instance) {
      instance.error(`${this.prefix} ${message}`, ...args);
      return;
    }
    console.error(this.formatMessage('error', message), ...args);
  }

  /**
   * Update log level
   */
  setLevel(level: LogLevel): void {
    this.localLevel = normalizeLevel(level);
  }

  /**
   * Get current effective log level
   */
  getLevel(): InternalLogLevel {
    return this.effectiveLevel();
  }
}

/**
 * Create a logger instance with a specific prefix
 * Useful for creating loggers in different packages/modules
 */
export function createLogger(prefix: string, level?: LoggerOptions['level']): Logger {
  return new Logger({ prefix, level });
}
