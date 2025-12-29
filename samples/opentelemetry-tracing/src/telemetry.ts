/* eslint-disable sort-imports */
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
/* eslint-enable sort-imports */

/**
 * Initialize OpenTelemetry SDK with OTLP exporters
 *
 * This configures the SDK to send traces and metrics to an OTLP-compatible backend
 * (like Jaeger, which supports OTLP natively).
 *
 * Environment variables:
 * - OTEL_EXPORTER_OTLP_ENDPOINT: Base URL for OTLP collector (default: http://localhost:4318)
 * - SERVICE_NAME: Name of the service for telemetry data
 */
export function initializeTelemetry(serviceName: string): NodeSDK {
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({
      url: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"]
        ? `${process.env["OTEL_EXPORTER_OTLP_ENDPOINT"]}/v1/traces`
        : "http://localhost:4318/v1/traces",
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"]
          ? `${process.env["OTEL_EXPORTER_OTLP_ENDPOINT"]}/v1/metrics`
          : "http://localhost:4318/v1/metrics",
      }),
      exportIntervalMillis: 10000, // Export metrics every 10 seconds
    }),
  });

  sdk.start();

  // Graceful shutdown
  process.on("SIGTERM", () => {
    sdk
      .shutdown()
      .then(() => console.log("Telemetry terminated"))
      .catch((error) => console.log("Error terminating telemetry", error))
      .finally(() => process.exit(0));
  });

  return sdk;
}
