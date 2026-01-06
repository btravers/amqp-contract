# Integration Tests

This workspace contains integration tests for the `@amqp-contract` library that test the interaction between multiple packages.

## Purpose

Unlike the integration tests in individual packages (which test each package in isolation), these tests verify:

- End-to-end workflows across multiple packages
- Client and Worker interactions
- NestJS integration with both client and worker
- Contract validation across the full stack
- Real AMQP messaging scenarios using RabbitMQ via testcontainers

## Running Tests

```bash
# Run all integration tests
pnpm --filter @amqp-contract/tests test

# Run tests in watch mode
pnpm --filter @amqp-contract/tests test:watch

# From the root
pnpm test:integration
```

## Test Structure

Tests are organized by scenario:

- `client-worker.integration.spec.ts` - Tests client and worker interaction

Planned for future implementation:
- `nestjs-integration.integration.spec.ts` - Tests NestJS modules integration
- `publisher-consumer.integration.spec.ts` - Tests full publisher-consumer workflows

## Dependencies

This workspace depends on:

- `@amqp-contract/contract` - Contract definitions
- `@amqp-contract/client` - Type-safe AMQP client
- `@amqp-contract/worker` - Type-safe AMQP worker
- `@amqp-contract/client-nestjs` - NestJS client integration
- `@amqp-contract/worker-nestjs` - NestJS worker integration
- `@amqp-contract/core` - Core utilities
- `@amqp-contract/testing` - Testing utilities (testcontainers setup)

## Configuration

Tests use:

- **Vitest** as the test framework
- **Testcontainers** for running RabbitMQ in Docker
- **Global setup** from `@amqp-contract/testing` to manage the RabbitMQ container
