---
"@amqp-contract/opentelemetry": minor
"@amqp-contract/client": minor
"@amqp-contract/worker": minor
"@amqp-contract/client-nestjs": minor
"@amqp-contract/worker-nestjs": minor
---

Add OpenTelemetry integration for distributed tracing and metrics

This release adds comprehensive OpenTelemetry support for AMQP message flows, enabling end-to-end observability across microservices.

**New Package: `@amqp-contract/opentelemetry`**

- `ClientInstrumentation` and `WorkerInstrumentation` classes for automatic span creation and lifecycle management
- `ClientMetrics` and `WorkerMetrics` classes for tracking message counts, durations, errors, and batch sizes
- W3C Trace Context propagation via AMQP message headers for distributed tracing
- Semantic conventions following OpenTelemetry messaging standards

**Client Package Updates**

- Added optional `instrumentation` and `metrics` parameters to `CreateClientOptions`
- Automatic span creation around publish operations with validation and error recording
- Trace context injection into message headers for downstream propagation

**Worker Package Updates**

- Added optional `instrumentation` and `metrics` parameters to `CreateWorkerOptions`
- Trace context extraction from message headers with parent span linking
- Separate instrumentation for single-message and batch processing
- Metrics for validation errors, processing errors, and batch sizes

**NestJS Integration Updates**

- Added OpenTelemetry support to `AmqpClientModuleOptions` and `AmqpWorkerModuleOptions`
- Optional peer dependency on `@amqp-contract/opentelemetry` for seamless integration
- Type-safe configuration with TypeScript inference

**Documentation & Examples**

- Comprehensive OpenTelemetry integration guide
- Sample application demonstrating distributed tracing with Jaeger
- Best practices for observability in AMQP applications

All OpenTelemetry dependencies are optional peer dependencies - existing code continues to work without modification.
