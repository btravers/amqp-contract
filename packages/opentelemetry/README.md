# @amqp-contract/opentelemetry

OpenTelemetry integration for observability in amqp-contract. This package provides automatic tracing and metrics collection for AMQP message publishing and consumption.

## Features

- ✅ **Distributed Tracing** - Automatic trace context propagation across AMQP messages
- ✅ **Metrics Collection** - Track message counts, error rates, and processing durations
- ✅ **Semantic Conventions** - Follow OpenTelemetry semantic conventions for messaging systems
- ✅ **Non-intrusive** - Minimal performance overhead and optional instrumentation

## Installation

```bash
pnpm add @amqp-contract/opentelemetry @opentelemetry/api
```

## Usage

### Client Instrumentation

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { ClientInstrumentation, ClientMetrics } from '@amqp-contract/opentelemetry';

// Create instrumentation
const instrumentation = new ClientInstrumentation({
  enableTracing: true,
});

const metrics = new ClientMetrics();

// Use with client (integration shown in @amqp-contract/client)
```

### Worker Instrumentation

```typescript
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { WorkerInstrumentation, WorkerMetrics } from '@amqp-contract/opentelemetry';

// Create instrumentation
const instrumentation = new WorkerInstrumentation({
  enableTracing: true,
});

const metrics = new WorkerMetrics();

// Use with worker (integration shown in @amqp-contract/worker)
```

## Metrics

### Client Metrics

- `amqp_contract.client.publish` - Counter for published messages
- `amqp_contract.client.publish.duration` - Histogram of publishing durations
- `amqp_contract.client.publish.errors` - Counter for publishing errors
- `amqp_contract.client.validation.errors` - Counter for validation errors

### Worker Metrics

- `amqp_contract.worker.consume` - Counter for consumed messages
- `amqp_contract.worker.consume.duration` - Histogram of processing durations
- `amqp_contract.worker.consume.errors` - Counter for processing errors
- `amqp_contract.worker.validation.errors` - Counter for validation errors
- `amqp_contract.worker.batch.size` - Histogram of batch sizes

## Trace Attributes

All spans include semantic attributes following OpenTelemetry conventions:

- `messaging.system` - Always "rabbitmq"
- `messaging.operation` - "publish", "receive", or "process"
- `messaging.destination.name` - Exchange or queue name
- `messaging.rabbitmq.routing_key` - Routing key used
- `messaging.rabbitmq.queue_name` - Queue name for consumers
- `amqp_contract.publisher.name` - Publisher name from contract
- `amqp_contract.consumer.name` - Consumer name from contract
- `amqp_contract.validation.success` - Whether message passed validation

## Context Propagation

Trace context is automatically propagated through AMQP message headers using the W3C Trace Context format:

- `traceparent` - Trace ID, span ID, and trace flags
- `tracestate` - Vendor-specific trace information

This ensures distributed traces flow correctly across service boundaries.

## License

MIT
