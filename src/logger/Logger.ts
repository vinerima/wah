/**
 * Log severity levels, ordered from most verbose to least verbose.
 * Used to filter which messages are emitted by the logger.
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Interface for custom logger implementations.
 * Provide an object matching this interface to replace the built-in console logger.
 */
export interface LoggerInterface {
  debug(message: string, context?: unknown): void;
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
}

/**
 * Configuration options for the logger.
 */
export interface LoggerOptions {
  /** Whether logging is enabled. Default: `true`. */
  enabled?: boolean;
  /** Minimum log level to emit. Messages below this level are discarded. Default: `LogLevel.INFO`. */
  level?: LogLevel;
  /** Custom logger implementation. When provided, all log calls are delegated to it. */
  custom?: LoggerInterface;
}

/**
 * Internal logger used throughout the library.
 * Each `WebSocketClient` instance creates its own `Logger` so configuration is isolated.
 *
 * @example
 * ```typescript
 * const logger = new Logger({ enabled: true, level: LogLevel.DEBUG });
 * logger.info("Connected", { service: "wss://example.com" });
 * ```
 */
export class Logger implements LoggerInterface {
  private enabled: boolean;
  private level: LogLevel;
  private custom?: LoggerInterface;

  constructor(options: LoggerOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.level = options.level ?? LogLevel.INFO;
    this.custom = options.custom;
  }

  debug(message: string, context?: unknown): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: unknown): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: unknown): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: unknown): void {
    this.log(LogLevel.ERROR, message, context);
  }

  private log(level: LogLevel, message: string, context?: unknown): void {
    if (!this.enabled || level < this.level) {
      return;
    }

    if (this.custom) {
      const method = LogLevel[level].toLowerCase() as keyof LoggerInterface;
      this.custom[method](message, context);
      return;
    }

    const timestamp = new Date().toISOString();
    const tag = LogLevel[level];
    const prefix = `[WAH ${tag}] ${timestamp}`;

    const logFn =
      level === LogLevel.ERROR
        ? console.error
        : level === LogLevel.WARN
          ? console.warn
          : level === LogLevel.DEBUG
            ? console.debug
            : console.log;

    if (context !== undefined) {
      logFn(prefix, message, context);
    } else {
      logFn(prefix, message);
    }
  }
}
