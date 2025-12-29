# @amqp-contract/opentelemetry

**OpenTelemetry integration for distributed tracing and metrics in amqp-contract.**

[![CI](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml/badge.svg)](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@amqp-contract/opentelemetry.svg?logo=npm)](https://www.npmjs.com/package/@amqp-contract/opentelemetry)
[![npm downloads](https://img.shields.io/npm/dm/@amqp-contract/opentelemetry.svg)](https://www.npmjs.com/package/@amqp-contract/opentelemetry)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/guides/observability)**

## Features

- ✅ **Distributed Tracing** - Automatic trace context propagation across AMQP messages
- ✅ **Metrics Collection** - Track message counts, error rates, and processing durations
- ✅ **Semantic Conventions** - Follow OpenTelemetry semantic conventions for messaging systems
- ✅ **Non-intrusive** - Minimal performance overhead and optional instrumentation

## Installation

```bash
pnpm add @amqp-contract/opentelemetry @opentelemetry/api
```

## Quick Start

### Client Instrumentation

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { ClientInstrumentation, ClientMetrics } from '@amqp-contract/opentelemetry';

const instrumentation = new ClientInstrumentation({ enableTracing: true });
const metrics = new ClientMetrics();

const client = await TypedAmqpClient.create({
  contract,
  urls: ['amqp://localhost'],
  instrumentation,
  metrics,
}).resultToPromise();
```

### Worker Instrumentation

```typescript
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { WorkerInstrumentation, WorkerMetrics } from '@amqp-contract/opentelemetry';

const instrumentation = new WorkerInstrumentation({ enableTracing: true });
const metrics = new WorkerMetrics();

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: { /* ... */ },
  urls: ['amqp://localhost'],
  instrumentation,
  metrics,
}).resultToPromise();
```

## Documentation

For detailed usage, configuration options, and best practices, see the [full documentation](https://btravers.github.io/amqp-contract/guides/observability).

## License

MIT © [Benjamin Travers](https://github.com/btravers)
