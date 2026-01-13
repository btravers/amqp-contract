# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For detailed coding standards, anti-patterns, and comprehensive examples, see [.github/copilot-instructions.md](.github/copilot-instructions.md).

## Project Overview

**amqp-contract** is a TypeScript monorepo providing type-safe contracts for AMQP/RabbitMQ messaging with automatic runtime validation.

## Commands

### Development

```bash
pnpm build            # Build all packages
pnpm dev              # Watch mode for development
```

### Code Quality

```bash
pnpm typecheck        # Type check without emitting
pnpm lint             # Run oxlint (no any types, import sorting, type aliases)
pnpm lint --fix       # Auto-fix linting issues
pnpm format           # Format with oxfmt
pnpm format --check   # Check formatting only
```

### Testing

```bash
pnpm test             # Run unit tests (no Docker required)
pnpm test:integration # Run integration tests (requires Docker)

# Run specific package tests
pnpm test:integration --filter @amqp-contract/core
pnpm test:integration --filter @amqp-contract/client
pnpm test:integration --filter @amqp-contract/worker
```

### Versioning

```bash
pnpm changeset        # Create changeset entry for version bumps
```

## Architecture

### Core Packages

| Package                        | Purpose                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `@amqp-contract/contract`      | Contract definition builder and types (foundation)           |
| `@amqp-contract/core`          | AMQP connection management, topology setup, telemetry        |
| `@amqp-contract/client`        | Type-safe publishing via `TypedAmqpClient`                   |
| `@amqp-contract/worker`        | Type-safe consumption via `TypedAmqpWorker` with retry logic |
| `@amqp-contract/client-nestjs` | NestJS module for client                                     |
| `@amqp-contract/worker-nestjs` | NestJS module for worker                                     |
| `@amqp-contract/asyncapi`      | AsyncAPI 3.0 specification generator                         |
| `@amqp-contract/testing`       | Testcontainers setup and vitest fixtures                     |

### Contract Composition Pattern

Resources are defined individually then composed into a contract:

```typescript
const exchange = defineExchange("orders", "topic", { durable: true });
const queue = defineQueue("processing", { durable: true });
const message = defineMessage(z.object({ orderId: z.string() }));

const contract = defineContract({
  exchanges: { orders: exchange },
  queues: { processing: queue },
  publishers: { orderCreated: definePublisher(exchange, message, { routingKey: "order.created" }) },
  consumers: { processOrder: defineConsumer(queue, message) },
  bindings: { binding1: defineQueueBinding(queue, exchange, { routingKey: "order.#" }) },
});
```

### Type Inference Helpers

- `ClientInferPublisherInput<Contract, "publisherName">` - Publisher input type
- `WorkerInferConsumerInput<Contract, "consumerName">` - Consumer input type
- `WorkerInferSafeConsumerHandler<Contract, "consumerName">` - Handler type

### Error Hierarchy

- `ValidationError` - Schema validation failures
- `RetryableError` - Transient failures (retry via DLX)
- `NonRetryableError` - Permanent failures (nack without retry)
- `TechnicalError` - Connection/setup errors

## Code Style Requirements

- **No `any` types** - enforced by oxlint
- **Type aliases over interfaces** - use `type Foo = {}` not `interface Foo {}`
- **`.js` extensions required** - all imports must include `.js` extension (ESM requirement)
- **Standard Schema v1** - for runtime validation (zod, valibot, arktype supported)
- **Catalog dependencies** - use `pnpm-workspace.yaml` catalog, not hardcoded versions

## Testing Strategy

- **Integration tests preferred** - real RabbitMQ via testcontainers, not mocking
- **Test file naming**: `*.spec.ts` for unit tests, `src/__tests__/*.spec.ts` for integration
- **Test isolation** - each integration test uses separate RabbitMQ vhost

## Monorepo Tooling

- **Package manager**: pnpm 10.27.0
- **Build**: turbo + tsdown (generates CJS/ESM with TypeScript definitions)
- **Linting**: oxlint (Rust-based, enforces strict type rules)
- **Formatting**: oxfmt (Rust-based)
- **Pre-commit**: lefthook (runs format, lint, sort-package-json, commitlint)
- **Commits**: conventional commits required (feat, fix, docs, chore, test, refactor)
