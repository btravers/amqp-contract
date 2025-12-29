# OpenTelemetry Integration

Add distributed tracing and metrics to your AMQP message flows for complete observability across microservices.

## Overview

The `@amqp-contract/opentelemetry` package provides OpenTelemetry instrumentation for both client (publisher) and worker (consumer) operations, enabling:

- **Distributed tracing** with W3C Trace Context propagation via message headers
- **Metrics collection** tracking message counts, durations, errors, and batch sizes
- **Semantic conventions** following OpenTelemetry messaging standards
- **Automatic instrumentation** with minimal code changes

## Installation

```bash
pnpm add @amqp-contract/opentelemetry @opentelemetry/api
```

The OpenTelemetry API is a peer dependency that provides the core tracing and metrics interfaces.

## Quick Start

### Client (Publisher) Instrumentation

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { ClientInstrumentation, ClientMetrics } from '@amqp-contract/opentelemetry';
import { trace, metrics } from '@opentelemetry/api';

// Create instrumentation and metrics instances
const instrumentation = new ClientInstrumentation({
  tracer: trace.getTracer('my-service'),
  enableTracing: true
});
const clientMetrics = new ClientMetrics({
  meter: metrics.getMeter('my-service')
});

// Pass them to the client
const client = await TypedAmqpClient.create({
  contract,
  urls: ['amqp://localhost'],
  instrumentation,
  metrics: clientMetrics
}).resultToPromise();

// Publish messages - automatically instrumented
await client.publish('orderCreated', {
  orderId: '123',
  amount: 99.99
});
```

### Worker (Consumer) Instrumentation

```typescript
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { WorkerInstrumentation, WorkerMetrics } from '@amqp-contract/opentelemetry';
import { trace, metrics } from '@opentelemetry/api';

// Create instrumentation and metrics instances
const instrumentation = new WorkerInstrumentation({
  tracer: trace.getTracer('my-service'),
  enableTracing: true
});
const workerMetrics = new WorkerMetrics({
  meter: metrics.getMeter('my-service')
});

// Pass them to the worker
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log('Processing:', message.orderId);
      // Your business logic here
    }
  },
  urls: ['amqp://localhost'],
  instrumentation,
  metrics: workerMetrics
}).resultToPromise();
```

## NestJS Integration

The NestJS modules support OpenTelemetry out of the box:

```typescript
import { Module } from '@nestjs/common';
import { AmqpClientModule } from '@amqp-contract/client-nestjs';
import { AmqpWorkerModule } from '@amqp-contract/worker-nestjs';
import { ClientInstrumentation, ClientMetrics, WorkerInstrumentation, WorkerMetrics } from '@amqp-contract/opentelemetry';
import { trace, metrics } from '@opentelemetry/api';
import { contract } from './contract';

@Module({
  imports: [
    AmqpClientModule.forRoot({
      contract,
      urls: ['amqp://localhost'],
      instrumentation: new ClientInstrumentation({
        tracer: trace.getTracer('my-service'),
        enableTracing: true
      }),
      metrics: new ClientMetrics({
        meter: metrics.getMeter('my-service')
      })
    }),
    AmqpWorkerModule.forRoot({
      contract,
      handlers: {
        processOrder: async (message) => {
          console.log('Processing:', message.orderId);
        }
      },
      urls: ['amqp://localhost'],
      instrumentation: new WorkerInstrumentation({
        tracer: trace.getTracer('my-service')
      }),
      metrics: new WorkerMetrics({
        meter: metrics.getMeter('my-service')
      })
    })
  ]
})
export class AppModule {}
```

## Distributed Tracing

### Trace Context Propagation

The client automatically injects W3C Trace Context into message headers:

```typescript
// Client publishes message
await client.publish('orderCreated', { orderId: '123', amount: 99.99 });
// → Trace context automatically injected into message headers
```

The worker extracts the trace context and creates child spans:

```typescript
// Worker receives message
// → Trace context extracted from headers
// → New span created as child of publisher span
handlers: {
  processOrder: async (message) => {
    // This handler execution is traced
    // Any operations here are part of the distributed trace
  }
}
```

### Span Attributes

Spans are automatically enriched with semantic attributes following OpenTelemetry conventions:

**Client (Publisher) Spans:**

- `messaging.system`: `"amqp"`
- `messaging.destination.name`: Exchange name
- `messaging.operation.type`: `"publish"`
- `messaging.operation.name`: Publisher name
- `messaging.message.routing_key`: Routing key

**Worker (Consumer) Spans:**

- `messaging.system`: `"amqp"`
- `messaging.source.name`: Queue name
- `messaging.operation.type`: `"process"` or `"process_batch"`
- `messaging.operation.name`: Consumer name
- `messaging.batch.message_count`: Batch size (for batch processing)

### Error Recording

Validation and processing errors are automatically recorded in spans:

```typescript
// Validation errors are traced with error status
await client.publish('orderCreated', { invalid: 'data' });
// → Span marked with error status
// → Error details recorded

// Processing errors in handlers are traced
handlers: {
  processOrder: async (message) => {
    throw new Error('Processing failed');
    // → Span marked with error status
    // → Exception recorded
  }
}
```

## Metrics

### Client (Publisher) Metrics

**`amqp.client.publish.count`** (Counter)

- Tracks number of publish attempts
- Attributes: `publisher_name`, `exchange_name`, `routing_key`, `status` (`success`/`error`)

**`amqp.client.publish.duration`** (Histogram)

- Measures publish operation duration in milliseconds
- Attributes: `publisher_name`, `exchange_name`, `routing_key`

**`amqp.client.validation.error.count`** (Counter)

- Tracks message validation failures
- Attributes: `publisher_name`, `exchange_name`, `routing_key`

### Worker (Consumer) Metrics

**`amqp.worker.consume.count`** (Counter)

- Tracks number of messages consumed
- Attributes: `consumer_name`, `queue_name`, `status` (`success`/`error`)

**`amqp.worker.consume.duration`** (Histogram)

- Measures message processing duration in milliseconds
- Attributes: `consumer_name`, `queue_name`

**`amqp.worker.validation.error.count`** (Counter)

- Tracks message validation failures
- Attributes: `consumer_name`, `queue_name`

**`amqp.worker.batch.size`** (Histogram)

- Tracks batch sizes for batch processing
- Attributes: `consumer_name`, `queue_name`

## Configuration

### Client Instrumentation Options

```typescript
interface InstrumentationConfig {
  /** Custom tracer instance (defaults to global tracer) */
  tracer?: Tracer;
  /** Enable/disable tracing (default: true) */
  enableTracing?: boolean;
}

const instrumentation = new ClientInstrumentation({
  tracer: trace.getTracer('my-service', '1.0.0'),
  enableTracing: true
});
```

### Client Metrics Options

```typescript
interface MetricsConfig {
  /** Custom meter instance (defaults to global meter) */
  meter?: Meter;
}

const metrics = new ClientMetrics({
  meter: metrics.getMeter('my-service', '1.0.0')
});
```

### Worker Instrumentation and Metrics

Worker instrumentation and metrics use the same configuration interfaces as the client.

## OpenTelemetry Setup

To use OpenTelemetry instrumentation, you need to configure the OpenTelemetry SDK in your application:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

const sdk = new NodeSDK({
  serviceName: 'my-service',
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces'
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: 'http://localhost:4318/v1/metrics'
    }),
    exportIntervalMillis: 60000
  })
});

sdk.start();

// Your application code here
```

### Exporter Options

OpenTelemetry supports various exporters:

- **Jaeger**: For trace visualization
- **Zipkin**: Alternative trace visualization
- **Prometheus**: For metrics collection
- **OTLP**: OpenTelemetry Protocol for unified telemetry

See the [OpenTelemetry documentation](https://opentelemetry.io/docs/languages/js/exporters/) for more exporter options.

## Example: End-to-End Tracing

Here's a complete example showing distributed tracing across services:

```typescript
// Service A: Order Service (Publisher)
import { TypedAmqpClient } from '@amqp-contract/client';
import { ClientInstrumentation, ClientMetrics } from '@amqp-contract/opentelemetry';

const client = await TypedAmqpClient.create({
  contract,
  urls: ['amqp://localhost'],
  instrumentation: new ClientInstrumentation({ enableTracing: true }),
  metrics: new ClientMetrics()
}).resultToPromise();

// Creates a span: "orders publish"
await client.publish('orderCreated', {
  orderId: '123',
  amount: 99.99
});
// Trace context injected into message headers

// Service B: Inventory Service (Consumer)
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { WorkerInstrumentation, WorkerMetrics } from '@amqp-contract/opentelemetry';

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      // Creates a child span: "order-processing process"
      // Trace context extracted from headers
      console.log('Reserving inventory for:', message.orderId);

      // Any operations here are part of the distributed trace
      await reserveInventory(message);
    }
  },
  urls: ['amqp://localhost'],
  instrumentation: new WorkerInstrumentation(),
  metrics: new WorkerMetrics()
}).resultToPromise();
```

The resulting trace will show:

1. **Span 1**: `orders publish` (Service A)
   - Publisher: `orderCreated`
   - Exchange: `orders`
   - Routing key: `order.created`
2. **Span 2**: `order-processing process` (Service B, child of Span 1)
   - Consumer: `processOrder`
   - Queue: `order-processing`

## Best Practices

1. **Use Consistent Service Names**: Use the same service name across tracer and meter creation for better correlation
2. **Enable Tracing Selectively**: In high-throughput scenarios, consider sampling to reduce overhead
3. **Monitor Metrics**: Set up alerts on error count and duration metrics
4. **Correlate Traces**: Use trace IDs to correlate logs, traces, and metrics
5. **Test Instrumentation**: Verify traces appear in your backend before production deployment

## Semantic Conventions

This package follows [OpenTelemetry Semantic Conventions for Messaging](https://opentelemetry.io/docs/specs/semconv/messaging/):

- Uses `messaging.system = "amqp"` for all operations
- Distinguishes between `publish` and `process` operations
- Includes destination/source information (exchange/queue names)
- Records routing keys and batch sizes where applicable

## Troubleshooting

**Q: Traces not appearing in backend?**

- Verify OpenTelemetry SDK is properly initialized before creating clients/workers
- Check exporter configuration and connectivity
- Ensure `enableTracing: true` is set in instrumentation config

**Q: Metrics not being collected?**

- Verify meter is properly configured with a metric reader
- Check metric export interval settings
- Ensure metrics are being scraped/pulled by your backend

**Q: High overhead from instrumentation?**

- Consider using sampling for traces in high-throughput scenarios
- Adjust metric export intervals to reduce frequency
- Profile your application to identify specific bottlenecks

## API Reference

For detailed API documentation, see the [@amqp-contract/opentelemetry API docs](https://btravers.github.io/amqp-contract/api/opentelemetry).

## Related

- [Client Usage Guide](./client-usage.md)
- [Worker Usage Guide](./worker-usage.md)
- [NestJS Client Usage](./client-nestjs-usage.md)
- [NestJS Worker Usage](./worker-nestjs-usage.md)
