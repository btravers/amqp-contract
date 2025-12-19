# @amqp-contract/testing

Testing utilities for AMQP contracts using testcontainers.

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/guide/getting-started)**

## Features

- 🐳 Automatically starts RabbitMQ container for tests
- ✅ Works with Vitest globalSetup
- 🚀 Fast and reliable integration testing
- 📊 Includes RabbitMQ management console

## Installation

```bash
pnpm add -D @amqp-contract/testing
```

## Usage

### 1. Configure Vitest

Add to your `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["@amqp-contract/testing/global-setup"],
  },
});
```

### 2. TypeScript Support

For TypeScript projects, reference the type definitions in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["@amqp-contract/testing/types/vitest"]
  }
}
```

Or add a triple-slash reference in your test files:

```typescript
/// <reference types="@amqp-contract/testing/types/vitest" />
```

This provides type-safe access to the test container context variables.

### 3. Use Vitest Extension in Tests

The package provides a Vitest extension that automatically manages RabbitMQ connections:

```typescript
import { describe, expect } from "vitest";
import { it } from "@amqp-contract/testing/extension";

describe("Order Processing", () => {
  it("should publish and consume messages", async ({ amqpConnection }) => {
    // amqpConnection is automatically provided and cleaned up
    // Your test code here using amqpConnection
  });
});
```

The extension provides:

- `amqpConnection`: An established connection to the RabbitMQ testcontainer
- Automatic connection cleanup after each test

## What It Does

The global setup:

1. Starts a RabbitMQ container with management plugin
2. Waits for RabbitMQ to be healthy
3. Provides connection details to your tests
4. Cleans up the container after tests complete

## Container Details

- **Image**: `rabbitmq:3-management-alpine`
- **Ports**:
  - 5672 (AMQP)
  - 15672 (Management console)
- **Credentials**:
  - User: `guest`
  - Password: `guest`

## Environment Variables

The following variables are provided to tests:

- `__TESTCONTAINERS_RABBITMQ_IP__` - Container host IP
- `__TESTCONTAINERS_RABBITMQ_PORT_5672__` - Mapped AMQP port
- `__TESTCONTAINERS_RABBITMQ_PORT_15672__` - Mapped management port
