# Contributing to amqp-contract

Thank you for your interest in contributing to amqp-contract!

## Development Setup

1. Install dependencies:

```bash
pnpm install
```

2. Build all packages:

```bash
pnpm build
```

3. Run tests:

```bash
# Run unit tests
pnpm test

# Run integration tests (requires Docker)
pnpm test:integration
```

## Testing Strategy

This project uses a **integration-first testing approach** that prioritizes testing against real RabbitMQ instances over mocked unit tests.

### Test Types

#### Integration Tests (`*.integration.spec.ts`)

- Test against **real RabbitMQ** instances using testcontainers
- Each test runs in an isolated vhost for complete test isolation
- Located alongside source files: `src/*.integration.spec.ts`
- Run with: `pnpm test:integration`
- **Preferred** for testing AMQP behavior, message flow, and contract setup

**Example packages with integration tests:**

- `packages/core` - 16 integration tests (AmqpClient, connection sharing)
- `packages/client` - 10 integration tests (publishing, validation, topology)
- `packages/worker` - 9 integration tests (consuming, error handling, bindings)

#### Unit Tests (`*.unit.spec.ts`)

- Test pure logic without external dependencies
- No mocking of AMQP libraries
- Located alongside source files: `src/*.unit.spec.ts`
- Run with: `pnpm test`
- **Only used** for testing pure functions, utilities, and simple logic

**Example packages with unit tests:**

- `packages/core` - 4 unit tests (logger utility)

### Why Integration Tests?

✅ **More Robust**: Tests validate actual AMQP behavior, not mocked assumptions
✅ **Catch Real Issues**: Detects problems with RabbitMQ integration that unit tests miss
✅ **Less Brittle**: No complex mock setup that breaks with implementation changes
✅ **Better Confidence**: Higher assurance that code works in production

### Running Tests

```bash
# Run all unit tests (fast, no Docker needed)
pnpm test

# Run integration tests for a specific package (requires Docker)
pnpm test:integration --filter @amqp-contract/core
pnpm test:integration --filter @amqp-contract/client
pnpm test:integration --filter @amqp-contract/worker

# Run all integration tests (requires Docker)
pnpm test:integration
```

### Writing New Tests

**For new AMQP features:**

1. Write integration tests using `@amqp-contract/testing/extension`
2. Use test fixtures: `amqpConnectionUrl`, `amqpChannel`, `publishMessage`, `initConsumer`
3. Place tests next to source: `feature.integration.spec.ts`

**For pure utility functions:**

1. Write unit tests without external dependencies
2. Place tests next to source: `utility.unit.spec.ts`

**Example integration test:**

```typescript
import { it } from "@amqp-contract/testing/extension";
import { defineContract, defineExchange } from "@amqp-contract/contract";

describe("Feature Integration", () => {
  it("should setup exchange", async ({ amqpConnectionUrl, amqpChannel }) => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        test: defineExchange("test", "topic", { durable: false }),
      },
    });

    // WHEN
    const client = new AmqpClient(contract, { urls: [amqpConnectionUrl] });
    await client.channel.waitForConnect();

    // THEN
    await expect(amqpChannel.checkExchange("test")).resolves.toBeDefined();

    // CLEANUP
    await client.close();
  });
});
```

## Project Structure

- `packages/contract` - Contract definition builder
- `packages/client` - Type-safe AMQP client
- `packages/worker` - Type-safe AMQP worker
- `packages/asyncapi` - AsyncAPI specification generator
- `samples/` - Example implementations

## Coding Guidelines

📋 **[Read the complete coding guidelines](.github/copilot-instructions.md)**

This project uses AI-assisted code review with GitHub Copilot. Our guidelines document:

- TypeScript & type safety requirements
- AMQP/RabbitMQ patterns & best practices
- Code style & formatting rules
- Testing conventions
- Error handling patterns

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `test:` - Test changes
- `refactor:` - Code refactoring

## Pull Request Process

1. Create a feature branch
2. Make your changes
3. Add tests for new functionality
4. Ensure all tests pass: `pnpm test`
5. Ensure code is formatted: `pnpm format`
6. Ensure code passes linting: `pnpm lint`
7. Submit a pull request

## Questions?

Feel free to open an issue for any questions or concerns.
