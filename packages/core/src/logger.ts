/**
 * Logging system for xrpl-connect
 * Supports dev/prod mode with configurable log levels
 */

import type { LoggerOptions } from './types';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

/**
 * Detect if running in development mode
 */
function isDevelopment(): boolean {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    return process.env.NODE_ENV === 'development';
  }
  // Fallback: check for localhost
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname.includes('dev');
  }
  return false;
}

/**
 * Logger class for structured logging
 * In development: logs debug, info, warn, error
 * In production: logs only warn and error
 */
export class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(options: LoggerOptions = {}) {
    // Auto-detect level based on environment if not explicitly set
    this.level = options.level || (isDevelopment() ? 'debug' : 'warn');
    this.prefix = options.prefix || '[xrpl-connect]';
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  /**
   * Format log message with prefix
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `${this.prefix} [${level.toUpperCase()}] ${timestamp} - ${message}`;
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), ...args);
    }
  }

  /**
   * Log info message
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  /**
   * Log error message
   */
  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  /**
   * Update log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }
}

/**
 * Create a logger instance with a specific prefix
 * Useful for creating loggers in different packages/modules
 */
export function createLogger(prefix: string, level?: LoggerOptions['level']): Logger {
  return new Logger({ prefix, level });
}
