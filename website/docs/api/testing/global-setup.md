[**@amqp-contract/testing**](index.md)

---

[@amqp-contract/testing](index.md) / global-setup

# global-setup

Global setup module for starting RabbitMQ test containers

This module provides a Vitest globalSetup function that automatically starts
a RabbitMQ container with the management plugin before tests run, and stops
it after all tests complete.

## Functions

### default()

```ts
function default(provide): Promise<() => Promise<void>>;
```

Defined in: [packages/testing/src/global-setup.ts:49](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/testing/src/global-setup.ts#L49)

Setup function for Vitest globalSetup

Starts a RabbitMQ container before all tests and provides connection details
to tests via Vitest's provide API. The container is automatically stopped
and cleaned up after all tests complete.

This function should be configured in your `vitest.config.ts`:

#### Parameters

| Parameter | Type          | Description                                 |
| --------- | ------------- | ------------------------------------------- |
| `provide` | `TestProject` | Function to provide context values to tests |

#### Returns

`Promise`\<() => `Promise`\<`void`\>\>

Cleanup function that stops the RabbitMQ container

#### Example

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["@amqp-contract/testing/global-setup"],
  },
});
```
