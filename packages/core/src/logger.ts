/**
 * Context object for logger methods.
 *
 * This type includes reserved keys that provide consistent naming
 * for common logging context properties.
 *
 * @property error - Error object or error details
 */
export type LoggerContext = Record<string, unknown> & {
  error?: unknown;
};

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
 *   debug: (message, context) => console.debug(message, context),
 *   info: (message, context) => console.info(message, context),
 *   warn: (message, context) => console.warn(message, context),
 *   error: (message, context) => console.error(message, context),
 * };
 * ```
 */
export type Logger = {
  /**
   * Log debug level messages
   * @param message - The log message
   * @param context - Optional context to include with the log
   */
  debug(message: string, context?: LoggerContext): void;

  /**
   * Log info level messages
   * @param message - The log message
   * @param context - Optional context to include with the log
   */
  info(message: string, context?: LoggerContext): void;

  /**
   * Log warning level messages
   * @param message - The log message
   * @param context - Optional context to include with the log
   */
  warn(message: string, context?: LoggerContext): void;

  /**
   * Log error level messages
   * @param message - The log message
   * @param context - Optional context to include with the log
   */
  error(message: string, context?: LoggerContext): void;
}
