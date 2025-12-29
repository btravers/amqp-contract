# OpenTelemetry Tracing Sample

This sample demonstrates distributed tracing and metrics collection for AMQP message flows using OpenTelemetry.

## Features

- **Distributed Tracing**: End-to-end trace visibility from publisher to consumer
- **W3C Trace Context Propagation**: Automatic trace context injection/extraction via message headers
- **Metrics Collection**: Message counts, durations, errors, and batch sizes
- **Custom Spans**: Business logic instrumentation with custom spans and events
- **Parent-Child Relationships**: Automatic span hierarchy showing message flow

## Prerequisites

1. **RabbitMQ** running on `localhost:5672` (or set `AMQP_URL` environment variable)
2. **Jaeger** or another OTLP-compatible backend running on `localhost:4318`

### Quick Start with Docker

```bash
# Start RabbitMQ
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# Start Jaeger (supports OTLP natively)
docker run -d --name jaeger \
  -p 4318:4318 \
  -p 16686:16686 \
  jaegertracing/all-in-one:latest
```

Access the Jaeger UI at http://localhost:16686

## Running the Sample

### Terminal 1: Start the Worker

```bash
pnpm --filter @amqp-contract-samples/opentelemetry-tracing dev:worker
```

The worker will:
- Connect to RabbitMQ with OpenTelemetry instrumentation
- Start consuming messages from the order queues
- Extract trace context from message headers
- Create child spans for message processing
- Record metrics for consumed messages

### Terminal 2: Start the Client

```bash
pnpm --filter @amqp-contract-samples/opentelemetry-tracing dev:client
```

The client will:
- Connect to RabbitMQ with OpenTelemetry instrumentation
- Publish 10 orders every 2 seconds
- Inject trace context into message headers
- Create spans for publish operations
- Record metrics for published messages
- Shut down automatically after 10 orders

### Terminal 3: View Traces in Jaeger

Open http://localhost:16686 and:

1. Select "order-service-client" or "order-service-worker" from the Service dropdown
2. Click "Find Traces"
3. Click on a trace to see the full distributed trace

You should see traces with spans like:
```
create-order (order-service-client)
  └─ orders publish (order-service-client) [AMQP publish span]
      └─ order-processing process (order-service-worker) [AMQP process span]
          ├─ check-inventory (order-service-worker)
          └─ process-payment (order-service-worker)
```

## Trace Structure

Each published message creates a trace with the following structure:

1. **create-order** (client business logic span)
   - Custom attributes: `order.id`, `order.count`
   - Duration: includes publish operation

2. **orders publish** (automatic AMQP client span)
   - Attributes: `messaging.system=amqp`, `messaging.destination.name=orders`
   - Routing key: `order.created`
   - Trace context injected into headers

3. **order-processing process** (automatic AMQP worker span)
   - Attributes: `messaging.system=amqp`, `messaging.source.name=order-processing`
   - Parent span: "orders publish"
   - Trace context extracted from headers

4. **check-inventory** (worker business logic span)
   - Custom events: `inventory-available` or `inventory-shortage`
   - Attributes: `order.id`, `order.amount`

5. **process-payment** (worker business logic span)
   - Custom events: `payment-captured`
   - Attributes: `order.id`, `payment.amount`

## Metrics

The sample records the following metrics:

### Client Metrics
- **amqp.client.publish.count**: Number of publish attempts (success/error)
- **amqp.client.publish.duration**: Publish operation duration in ms
- **amqp.client.validation.error.count**: Message validation failures

### Worker Metrics
- **amqp.worker.consume.count**: Number of messages consumed (success/error)
- **amqp.worker.consume.duration**: Message processing duration in ms
- **amqp.worker.validation.error.count**: Message validation failures
- **amqp.worker.batch.size**: Batch sizes for batch processing

## Configuration

### Environment Variables

- `AMQP_URL`: RabbitMQ connection URL (default: `amqp://localhost`)
- `OTEL_EXPORTER_OTLP_ENDPOINT`: OTLP collector base URL (default: `http://localhost:4318`)
- `SERVICE_NAME`: Service name for telemetry (set in code)

### OpenTelemetry Setup

The sample uses the OpenTelemetry Node SDK with:
- **OTLP HTTP exporter** for traces and metrics
- **Periodic metric reader** with 10-second export interval
- **Resource attributes** for service identification

See `src/telemetry.ts` for the full configuration.

## Alternative Backends

### Zipkin

```bash
# Start Zipkin
docker run -d -p 9411:9411 openzipkin/zipkin

# Update telemetry.ts to use Zipkin exporter
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
// ... update traceExporter configuration
```

### Prometheus (Metrics Only)

```bash
# Install Prometheus exporter
pnpm add @opentelemetry/exporter-prometheus

# Update telemetry.ts
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
const prometheusExporter = new PrometheusExporter({ port: 9464 });
```

## Troubleshooting

### Traces not appearing in Jaeger?

1. Check that Jaeger is running: `docker ps | grep jaeger`
2. Verify OTLP endpoint: `curl http://localhost:4318/v1/traces`
3. Check client/worker logs for errors
4. Ensure OpenTelemetry SDK is initialized before creating clients/workers

### Worker not receiving messages?

1. Check RabbitMQ is running: `docker ps | grep rabbitmq`
2. Access RabbitMQ management UI: http://localhost:15672 (guest/guest)
3. Verify queues are created and bound correctly
4. Check worker logs for connection errors

### High memory usage?

1. Reduce metric export interval in `telemetry.ts`
2. Use trace sampling for high-throughput scenarios
3. Adjust batch size limits if using batch processing

## Related Documentation

- [OpenTelemetry Guide](../../docs/guide/opentelemetry.md)
- [Client Usage](../../docs/guide/client-usage.md)
- [Worker Usage](../../docs/guide/worker-usage.md)
- [OpenTelemetry JS Documentation](https://opentelemetry.io/docs/languages/js/)
