export {
  AmqpClient,
  type AmqpClientOptions,
  type ConsumeCallback,
  type ConsumerOptions,
  type PublishOptions,
} from "./amqp-client.js";
export { ConnectionManagerSingleton } from "./connection-manager.js";
export { MessageValidationError, TechnicalError } from "./errors.js";
export type { Logger, LoggerContext } from "./logger.js";
export { setupAmqpTopology } from "./setup.js";
export {
  _resetTelemetryCacheForTesting,
  defaultTelemetryProvider,
  endSpanError,
  endSpanSuccess,
  MessagingSemanticConventions,
  recordConsumeMetric,
  recordPublishMetric,
  startConsumeSpan,
  startPublishSpan,
  type TelemetryProvider,
} from "./telemetry.js";
