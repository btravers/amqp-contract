/**
 * Logger interface for amqp-contract packages.
 *
 * Provides a simple logging abstraction that can be implemented by users
 * to integrate with their preferred logging framework.
 *
 * @example
 * ```typescript
 * // Simple console logger implementation
 * const logger: Logger = {
 *   debug: (message, meta) => console.debug(message, meta),
 *   info: (message, meta) => console.info(message, meta),
 *   warn: (message, meta) => console.warn(message, meta),
 *   error: (message, meta) => console.error(message, meta),
 * };
 * ```
 */
export interface Logger {
  /**
   * Log debug level messages
   * @param message - The log message
   * @param meta - Optional metadata to include with the log
   */
  debug(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log info level messages
   * @param message - The log message
   * @param meta - Optional metadata to include with the log
   */
  info(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log warning level messages
   * @param message - The log message
   * @param meta - Optional metadata to include with the log
   */
  warn(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log error level messages
   * @param message - The log message
   * @param meta - Optional metadata to include with the log
   */
  error(message: string, meta?: Record<string, unknown>): void;
}
