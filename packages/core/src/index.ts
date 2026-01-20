export type { Logger, LoggerContext } from "./logger.js";
export { AmqpClient, type AmqpClientOptions, type ConsumeCallback } from "./amqp-client.js";
export { TechnicalError } from "./errors.js";
export { ConnectionManagerSingleton } from "./connection-manager.js";
export { setupAmqpTopology } from "./setup.js";
export {
  type TelemetryProvider,
  MessagingSemanticConventions,
  _resetTelemetryCacheForTesting,
  defaultTelemetryProvider,
  endSpanError,
  endSpanSuccess,
  recordConsumeMetric,
  recordPublishMetric,
  startConsumeSpan,
  startPublishSpan,
} from "./telemetry.js";
