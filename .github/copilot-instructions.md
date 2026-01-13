# GitHub Copilot Instructions for amqp-contract

This guide provides coding standards and best practices for contributing to the **amqp-contract** project. Following these guidelines ensures consistency, type safety, and maintainability across the codebase.

---

## Project Overview

**amqp-contract** is a TypeScript monorepo that provides type-safe contracts for AMQP/RabbitMQ messaging. The project enables end-to-end type safety with automatic validation for AMQP publishers and consumers.

### Key Technologies

- **TypeScript 5.9+** - Strict type safety
- **Standard Schema v1** - Universal schema validation interface
- **Zod/Valibot/ArkType** - Schema validation libraries
- **amqplib** - AMQP 0.9.1 client for Node.js
- **Vitest** - Fast unit test framework
- **Turbo** - Monorepo build system
- **pnpm** - Fast, disk space efficient package manager
- **oxlint** - Fast linter
- **oxfmt** - Fast formatter

---

## Monorepo Structure

```
amqp-contract/
├── docs/                  # Documentation site
├── packages/
│   ├── contract/          # Core contract builder
│   ├── core/              # Core utilities for AMQP setup and management
│   ├── client/            # Type-safe AMQP client
│   ├── worker/            # Type-safe AMQP worker
│   ├── client-nestjs/     # NestJS integration for client
│   ├── worker-nestjs/     # NestJS integration for worker
│   ├── asyncapi/          # AsyncAPI 3.0 generator
│   └── testing/           # Testing utilities
├── samples/               # Example implementations
└── tools/                 # Development tools
```

### Package Structure

Each package follows this structure:

```
packages/[package-name]/
├── src/
│   ├── index.ts           # Public API exports
│   ├── [feature].ts       # Implementation
│   └── [feature].spec.ts  # Tests alongside code
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## AMQP/RabbitMQ Patterns

### ✅ Required Practices

1. **Contract Definition**
   - Always validate contracts at definition time
   - Use Standard Schema v1 compliant schemas (Zod, Valibot, ArkType)
   - Define exchanges, queues, messages, bindings, publishers, and consumers
   - Use composition pattern: define resources first, then reference them

   ```typescript
   import {
     defineContract,
     defineExchange,
     defineQueue,
     defineQueueBinding,
     definePublisher,
     defineConsumer,
     defineMessage,
   } from "@amqp-contract/contract";
   import { z } from "zod";

   // 1. Define exchanges and queues first
   const ordersExchange = defineExchange("orders", "topic", { durable: true });
   const orderProcessingQueue = defineQueue("order-processing", { durable: true });

   // 2. Define message schemas with metadata
   const orderMessage = defineMessage(
     z.object({
       orderId: z.string(),
       amount: z.number(),
     }),
     {
       summary: "Order created event",
       description: "Emitted when a new order is created",
     },
   );

   // 3. Compose the contract using object references
   const contract = defineContract({
     exchanges: {
       orders: ordersExchange,
     },
     queues: {
       orderProcessing: orderProcessingQueue,
     },
     bindings: {
       orderBinding: defineQueueBinding(orderProcessingQueue, ordersExchange, {
         routingKey: "order.created",
       }),
     },
     publishers: {
       orderCreated: definePublisher(ordersExchange, orderMessage, {
         routingKey: "order.created",
       }),
     },
     consumers: {
       processOrder: defineConsumer(orderProcessingQueue, orderMessage),
     },
   });
   ```

2. **Exchange Types**
   - Use appropriate exchange type: `direct`, `fanout`, `topic`, or `headers`
   - Topic exchanges are most flexible for routing patterns
   - Direct exchanges for simple point-to-point messaging
   - Fanout exchanges for broadcast messaging

3. **Queue Types**
   - **Quorum queues are the default** and recommended for most use cases
   - Use `type: 'quorum'` (default) for reliable, replicated queues
   - Use `type: 'classic'` only for special cases (priority queues, exclusive queues)
   - Quorum queues are always durable and cannot be exclusive
   - Configure `deliveryLimit` for native retry support

   ```typescript
   // Quorum queue (default, recommended)
   const orderQueue = defineQueue("orders", {
     type: "quorum", // default, can be omitted
     deliveryLimit: 3, // Native retry: dead-letter after 3 attempts
     deadLetter: { exchange: dlx },
   });

   // Classic queue for special cases only
   const priorityQueue = defineQueue("priority-tasks", {
     type: "classic",
     durable: true,
     maxPriority: 10, // Only supported with classic queues
   });
   ```

4. **Queue and Exchange Options**
   - Set `durable: true` for persistent queues and exchanges
   - Use `autoDelete` sparingly, primarily for temporary resources
   - Configure `prefetch` on consumers to control message flow

5. **Bindings**
   - Use `defineQueueBinding` for queue-to-exchange bindings
   - Use `defineExchangeBinding` for exchange-to-exchange bindings
   - Exchange-to-exchange bindings enable complex routing patterns
   - For fanout exchanges, routing keys are optional

   ```typescript
   // Queue-to-exchange binding
   const queueBinding = defineQueueBinding(orderProcessingQueue, ordersExchange, {
     routingKey: "order.created",
   });

   // Exchange-to-exchange binding for message routing
   const exchangeBinding = defineExchangeBinding(analyticsExchange, ordersExchange, {
     routingKey: "order.#", // Forward all order events
   });
   ```

6. **Routing Keys**
   - Use meaningful, hierarchical routing keys (e.g., `order.created`, `order.updated`)
   - Topic patterns: `#` matches zero or more words, `*` matches exactly one word
   - Document routing key patterns in comments

7. **Message Schemas**
   - Always validate both input and output messages
   - Use Standard Schema v1 compliant libraries (Zod, Valibot, ArkType)
   - Define schemas as const to enable type inference
   - Use `defineMessage` to wrap schemas with optional metadata

   ```typescript
   import { defineMessage } from "@amqp-contract/contract";
   import { z } from "zod";

   const orderMessage = defineMessage(
     z.object({
       orderId: z.string(),
       customerId: z.string(),
       items: z.array(
         z.object({
           productId: z.string(),
           quantity: z.number().int().positive(),
           price: z.number().positive(),
         }),
       ),
       totalAmount: z.number().positive(),
     }),
     {
       summary: "Order created event",
       description: "Emitted when a new order is created in the system",
     },
   );
   ```

8. **Publisher-First Pattern**
   - Use `definePublisherFirst` when one publisher feeds multiple consumers
   - Ensures schema consistency between publisher and all consumers
   - Returns `{ publisher, createConsumer }` for creating linked consumers

   ```typescript
   import { definePublisherFirst } from "@amqp-contract/contract";

   // Define publisher-first relationship
   const { publisher: publishLog, createConsumer: createLogConsumer } = definePublisherFirst(
     logsExchange,
     logMessage,
   );

   // Create multiple consumers with consistent schema
   const logsQueue1 = defineQueue("logs-queue-1");
   const logsQueue2 = defineQueue("logs-queue-2");

   const { consumer: consumer1, binding: binding1 } = createLogConsumer(logsQueue1);
   const { consumer: consumer2, binding: binding2 } = createLogConsumer(logsQueue2);

   // Use in contract
   const contract = defineContract({
     exchanges: { logs: logsExchange },
     queues: { logsQueue1, logsQueue2 },
     bindings: { logBinding1: binding1, logBinding2: binding2 },
     publishers: { publishLog },
     consumers: { consumeLog1: consumer1, consumeLog2: consumer2 },
   });
   ```

---

## Worker Handlers

### ✅ Required Practices

1. **Safe Handlers (Recommended)**
   - Use `defineHandler` for all new code
   - Returns `Future<Result<void, HandlerError>>` for explicit error handling
   - Use `RetryableError` for transient failures that should be retried
   - Use `NonRetryableError` for permanent failures that go to DLQ

   ```typescript
   import { defineHandler, RetryableError, NonRetryableError } from "@amqp-contract/worker";
   import { Future, Result } from "@swan-io/boxed";

   const processOrderHandler = defineHandler(contract, "processOrder", (message) =>
     Future.fromPromise(processPayment(message.orderId))
       .mapOk(() => undefined)
       .mapError((error) => new RetryableError("Payment service unavailable", error)),
   );

   // For permanent failures
   const validateOrderHandler = defineHandler(contract, "validateOrder", (message) => {
     if (message.amount < 1) {
       return Future.value(Result.Error(new NonRetryableError("Invalid amount")));
     }
     return Future.value(Result.Ok(undefined));
   });
   ```

2. **Unsafe Handlers (Deprecated)**
   - Use `defineUnsafeHandler` only for legacy code
   - Returns `Promise<void>` without explicit error handling
   - Thrown errors are automatically retried

   ```typescript
   // ❌ Deprecated - avoid in new code
   import { defineUnsafeHandler } from "@amqp-contract/worker";

   const legacyHandler = defineUnsafeHandler(contract, "processOrder", async (message) => {
     await processPayment(message.orderId);
   });
   ```

3. **Handler Options**
   - Configure `prefetch` for per-consumer message flow control
   - Use `batchSize` and `batchTimeout` for batch processing

   ```typescript
   const handlers = {
     processOrder: [
       processOrderHandler,
       { prefetch: 10 }, // Process up to 10 messages concurrently
     ],
     processBatch: [
       batchHandler,
       { batchSize: 5, batchTimeout: 1000 }, // Batch 5 messages or 1s timeout
     ],
   };
   ```

4. **Type Inference for Handlers**
   - Use `WorkerInferSafeConsumerHandler<Contract, Name>` for handler types
   - Use `WorkerInferSafeConsumerHandlers<Contract>` for all handlers

   ```typescript
   import type {
     WorkerInferSafeConsumerHandler,
     WorkerInferSafeConsumerHandlers,
   } from "@amqp-contract/worker";

   type OrderHandler = WorkerInferSafeConsumerHandler<typeof contract, "processOrder">;
   type AllHandlers = WorkerInferSafeConsumerHandlers<typeof contract>;
   ```

---

## Retry Strategies

### ✅ Required Practices

1. **Quorum-Native Mode (Recommended)**
   - Uses RabbitMQ's native `x-delivery-limit` feature
   - Messages requeued immediately with `nack(requeue=true)`
   - RabbitMQ tracks delivery count via `x-delivery-count` header
   - Requires quorum queues with `deliveryLimit` configured

   ```typescript
   // Queue with native retry support
   const orderQueue = defineQueue("orders", {
     type: "quorum",
     deliveryLimit: 3, // Dead-letter after 3 attempts
     deadLetter: { exchange: dlx },
   });

   // Worker with quorum-native retry
   const worker = await TypedAmqpWorker.create({
     contract,
     handlers,
     urls: ["amqp://localhost"],
     retry: {
       mode: "quorum-native",
     },
   });
   ```

2. **TTL-Backoff Mode (Legacy)**
   - Uses TTL + wait queue pattern for exponential backoff
   - Messages published to wait queue with per-message TTL
   - Supports configurable delays with jitter
   - More complex but allows delayed retries

   ```typescript
   const worker = await TypedAmqpWorker.create({
     contract,
     handlers,
     urls: ["amqp://localhost"],
     retry: {
       mode: "ttl-backoff",
       maxRetries: 3,
       initialDelay: 1000,
       maxDelay: 30000,
       backoffMultiplier: 2,
     },
   });
   ```

3. **When to Use Each Mode**
   - **Quorum-native**: Simple setup, immediate retries, recommended for most cases
   - **TTL-backoff**: When you need exponential backoff delays between retries

---

## NestJS Integration

### ✅ Required Practices

1. **Module Configuration**
   - Use `AmqpClientModule` for publishing messages
   - Use `AmqpWorkerModule` for consuming messages
   - Both modules provide automatic lifecycle management
   - Connection is managed automatically (connect on init, disconnect on destroy)

   ```typescript
   import { Module } from "@nestjs/common";
   import { AmqpClientModule } from "@amqp-contract/client-nestjs";
   import { AmqpWorkerModule } from "@amqp-contract/worker-nestjs";
   import { contract } from "./contract";

   @Module({
     imports: [
       AmqpClientModule.forRoot({
         contract,
         urls: ["amqp://localhost"],
       }),
       AmqpWorkerModule.forRoot({
         contract,
         handlers: {
           processOrder: async (message) => {
             console.log("Processing:", message.orderId);
           },
         },
         urls: ["amqp://localhost"],
       }),
     ],
   })
   export class AppModule {}
   ```

2. **Dependency Injection**
   - Inject `AmqpClientService<typeof contract>` directly via constructor injection
   - The client is fully typed and ready to use (methods are inferred from your contract)
   - No manual connection management needed; the service is provided by `AmqpClientModule`

   ```typescript
   import { AmqpClientService } from "@amqp-contract/client-nestjs";

   @Injectable()
   export class OrderService {
     constructor(private readonly amqpClient: AmqpClientService<typeof contract>) {}

     async createOrder(order: Order) {
       await this.amqpClient
         .publish("orderCreated", {
           orderId: order.id,
           amount: order.total,
         })
         .resultToPromise();
     }
   }
   ```

3. **Connection Sharing**
   - If using both client and worker, they can share a connection
   - See Architecture Decision Records for connection sharing strategies
   - For most cases, separate modules with separate connections is simpler

4. **Error Handling**
   - Worker errors are logged automatically
   - Use try/catch in handlers for custom error handling
   - Failed messages can be nacked or sent to dead letter exchanges

---

## Type Safety Requirements

### ✅ Required Practices

1. **Strict TypeScript**
   - Enable strict mode in tsconfig.json
   - Never use `any` type (enforced by oxlint)
   - Use `unknown` for truly dynamic data, then narrow the type
   - Prefer `readonly` arrays and properties where appropriate
   - **Use type aliases instead of interfaces** for consistency

   ```typescript
   // ❌ Bad
   function process(data: any): any {}

   // ❌ Bad - using interface
   export interface PublishOptions extends Options.Publish {
     compression?: string;
   }

   // ✅ Good
   function process(data: unknown): string {
     if (typeof data === "string") {
       return data.toUpperCase();
     }
     throw new Error("Invalid data");
   }

   // ✅ Good - using type alias
   export type PublishOptions = Options.Publish & {
     compression?: CompressionAlgorithm;
   };
   ```

2. **Type Inference**
   - Leverage TypeScript's type inference from contracts
   - Use helper types: `InferSchemaInput`, `InferSchemaOutput`
   - Client and Worker types are automatically inferred

   ```typescript
   import type {
     ClientInferPublisherInput,
     WorkerInferConsumerInput,
   } from "@amqp-contract/contract";

   type OrderInput = ClientInferPublisherInput<typeof contract, "orderCreated">;
   type OrderMessage = WorkerInferConsumerInput<typeof contract, "processOrder">;
   ```

3. **Import Extensions**
   - Always use `.js` extensions in imports (ESM requirement)
   - This is required even for TypeScript files

   ```typescript
   // ❌ Bad
   import { helper } from "./utils";

   // ✅ Good
   import { helper } from "./utils.js";
   ```

---

## Error Handling

### ✅ Required Practices

1. **Worker Error Classes**
   - Use `RetryableError` for transient failures that should be retried
   - Use `NonRetryableError` for permanent failures that go directly to DLQ
   - Both extend `HandlerError` base class

   ```typescript
   import { RetryableError, NonRetryableError } from "@amqp-contract/worker";

   // Transient failure - will be retried
   throw new RetryableError("Database connection timeout", originalError);

   // Permanent failure - goes to DLQ immediately
   throw new NonRetryableError("Invalid message format - cannot process");
   ```

2. **Error Handling in Safe Handlers**
   - Return `Future<Result<void, HandlerError>>` from handlers
   - Use `Result.Ok(undefined)` for success
   - Use `Result.Error(new RetryableError(...))` for retryable failures
   - Use `Result.Error(new NonRetryableError(...))` for permanent failures

   ```typescript
   import { defineHandler, RetryableError, NonRetryableError } from "@amqp-contract/worker";
   import { Future, Result } from "@swan-io/boxed";

   const handler = defineHandler(contract, "processOrder", (message) => {
     if (!isValidOrder(message)) {
       // Won't be retried
       return Future.value(Result.Error(new NonRetryableError("Invalid order")));
     }

     return Future.fromPromise(processOrder(message))
       .mapOk(() => undefined)
       .mapError((err) => new RetryableError("Processing failed", err));
   });
   ```

3. **Validation Errors**
   - Use Standard Schema v1 for validation
   - `MessageValidationError` is thrown for schema validation failures
   - Validation errors are not retried (permanent failure)

   ```typescript
   import type { StandardSchemaV1 } from "@standard-schema/spec";

   async function validateAndPublish(schema: StandardSchemaV1, data: unknown) {
     const validation = await schema["~standard"].validate(data);
     if (validation.issues) {
       // Validation failed
       throw new Error(`Validation failed: ${JSON.stringify(validation.issues)}`);
     }
     // Validation succeeded
     return validation.value;
   }
   ```

4. **Custom Error Classes**
   - Extend base Error class appropriately
   - Include helpful context (consumer name, queue name, etc.)
   - Use `Error.captureStackTrace` for V8 compatibility

   ```typescript
   export class ConsumerNotFoundError extends Error {
     constructor(
       public readonly consumerName: string,
       public readonly availableConsumers: readonly string[] = [],
     ) {
       const available = availableConsumers.length > 0 ? availableConsumers.join(", ") : "none";
       super(`Consumer not found: "${consumerName}". Available consumers: ${available}`);
       this.name = "ConsumerNotFoundError";
       if (Error.captureStackTrace) {
         Error.captureStackTrace(this, this.constructor);
       }
     }
   }
   ```

5. **AMQP Connection Errors**
   - Handle connection failures gracefully
   - Implement reconnection logic where appropriate
   - Log connection issues for debugging

6. **Message Processing Errors**
   - Use `RetryableError` / `NonRetryableError` in safe handlers
   - Failed messages are sent to dead letter exchange based on error type
   - Log processing errors with context

---

## Testing Requirements

### ✅ Required Practices

1. **Test Framework**
   - Use `vitest` for all tests
   - Place tests alongside source: `feature.spec.ts`
   - Use integration tests in `__tests__` directories

2. **Integration Test Setup**
   - Use `@amqp-contract/testing` for RabbitMQ integration tests
   - Configure `globalSetup` in vitest.config.ts for container lifecycle
   - Each test gets an isolated vhost automatically

   ```typescript
   // vitest.config.ts
   import { defineConfig } from "vitest/config";

   export default defineConfig({
     test: {
       globalSetup: ["@amqp-contract/testing/global-setup"],
     },
   });
   ```

3. **Test Fixtures**
   - Import `it` from `@amqp-contract/testing/extension` for fixtures
   - Available fixtures: `vhost`, `amqpConnectionUrl`, `amqpConnection`, `amqpChannel`
   - Use `publishMessage` and `initConsumer` for message testing

   ```typescript
   import { describe, expect } from "vitest";
   import { it } from "@amqp-contract/testing/extension";

   describe("Order Processing", () => {
     it("should consume order messages", async ({ initConsumer, publishMessage, vhost }) => {
       // vhost is automatically created and isolated for this test
       const waitForMessages = await initConsumer("orders-exchange", "order.created");

       publishMessage("orders-exchange", "order.created", { orderId: "123" });

       const messages = await waitForMessages({ nbEvents: 1, timeout: 5000 });
       expect(messages).toHaveLength(1);
       expect(messages[0]).toMatchObject({ orderId: "123" });
     });
   });
   ```

4. **Test Structure**

   ```typescript
   import { describe, expect, it } from "vitest";

   describe("Feature Name", () => {
     describe("specific function/method", () => {
       it("should do something specific", () => {
         // GIVEN
         const input = {
           /* ... */
         };

         // WHEN
         const result = functionUnderTest(input);

         // THEN
         expect(result).toEqual(expectedValue);
       });
     });
   });
   ```

5. **Test Coverage**
   - Write tests for all exported functions
   - Test happy path and error cases
   - Test edge cases and boundary conditions
   - Use `expect.objectContaining()` for partial matching

6. **AMQP Integration Tests**
   - Prefer real RabbitMQ via testcontainers over mocking
   - Test actual AMQP connections for reliability
   - Place in separate test files or `__tests__` directories

7. **Test Naming**
   - Use descriptive test names: "should [expected behavior] when [condition]"
   - Group related tests in `describe` blocks
   - Keep tests focused on one thing

8. **Assertion Best Practices**
   - Merge multiple assertions into one whenever possible for clarity
   - Use `expect.objectContaining()` or `toMatchObject()` for complex object validation
   - Prefer single comprehensive assertions over multiple fragmented ones
   - When testing multiple calls to mocked functions, use `toHaveBeenNthCalledWith(n, ...)` to verify specific call order and arguments

   ```typescript
   // ❌ Bad - multiple fragmented assertions
   it("should create exchange definition", () => {
     const exchange = defineExchange("test", "topic", { durable: true });
     expect(exchange.name).toBe("test");
     expect(exchange.type).toBe("topic");
     expect(exchange.durable).toBe(true);
   });

   // ✅ Good - merged into comprehensive assertion
   it("should create exchange definition", () => {
     const exchange = defineExchange("test", "topic", { durable: true });
     expect(exchange).toEqual({
       name: "test",
       type: "topic",
       durable: true,
     });
   });

   // ❌ Bad - using toHaveBeenCalledWith without specifying order
   it("should call function multiple times", () => {
     mockFn("first");
     mockFn("second");
     expect(mockFn).toHaveBeenCalledWith("first");
     expect(mockFn).toHaveBeenCalledWith("second");
   });

   // ✅ Good - using toHaveBeenNthCalledWith for ordered calls
   it("should call function multiple times", () => {
     mockFn("first");
     mockFn("second");
     expect(mockFn).toHaveBeenCalledTimes(2);
     expect(mockFn).toHaveBeenNthCalledWith(1, "first");
     expect(mockFn).toHaveBeenNthCalledWith(2, "second");
   });
   ```

---

## Documentation Standards

### ✅ Required Practices

1. **README Files**
   - Every package must have a README.md
   - Include: description, installation, usage examples, API overview
   - Keep examples up-to-date with code

2. **Code Comments**
   - Use JSDoc for all public APIs
   - Explain "why" not "what" in inline comments
   - Keep comments concise and relevant
   - Document routing key patterns and AMQP topology

3. **Examples**
   - Provide working examples in `samples/` directory
   - Examples should demonstrate real-world usage
   - Include both basic and advanced patterns
   - Show different exchange types and routing strategies

4. **Website Documentation**
   - Keep `docs/` in sync with code changes
   - Update API documentation when signatures change
   - Add guides for new features

5. **Changelog**
   - Use Changesets for versioning: `pnpm changeset`
   - Describe user-facing changes clearly
   - Follow semantic versioning

---

## Performance & Best Practices

### ✅ Required Practices

1. **Validation**
   - Validate at boundaries (publisher/consumer inputs/outputs)
   - Use Standard Schema v1 validation interface
   - Cache validation schemas when possible

2. **Immutability**
   - Use `readonly` for data that shouldn't change
   - Prefer `const` over `let`
   - Use readonly arrays: `readonly string[]`
   - Contract definitions should be immutable

3. **Function Design**
   - Keep functions small and focused
   - Avoid side effects in pure functions
   - Use pure functions where possible
   - **Use nullish coalescing (`?? {}`) for optional object parameters** to provide safe defaults

   ```typescript
   // ❌ Bad - using || which treats empty object as falsy
   function process(options) {
     const { field, ...rest } = options || {};
   }

   // ✅ Good - using ?? which only checks for null/undefined
   function process(options) {
     const { field, ...rest } = options ?? {};
   }
   ```

4. **Dependencies**
   - Minimize external dependencies
   - Use peer dependencies for amqplib and schema libraries
   - Keep bundle size small
   - Use catalog-based dependencies from `pnpm-workspace.yaml` for consistent versions

5. **AMQP Best Practices**
   - Reuse channels when possible
   - Set appropriate prefetch values
   - Use connection pooling for high throughput
   - Close connections and channels properly

6. **Composition Pattern**
   - Define exchanges, queues, and messages as separate variables
   - Reference these objects (not strings) in bindings, publishers, and consumers
   - This enables better type safety and refactoring support
   - See Contract Definition examples above for the pattern

---

## Dependency Management

### ✅ Required Practices

1. **Catalog-Based Dependencies**
   - This project uses pnpm's catalog feature for dependency management
   - All shared dependencies are defined in `pnpm-workspace.yaml` under the `catalog` key
   - Reference catalog dependencies in package.json as: `"package-name": "catalog:"`
   - This ensures consistent versions across all packages

   ```json
   // ✅ Good in package.json
   "devDependencies": {
     "vitest": "catalog:",
     "typescript": "catalog:",
     "zod": "catalog:"
   }
   ```

2. **Workspace Protocol**
   - Use `workspace:*` for internal package dependencies
   - This ensures correct version resolution in the monorepo

   ```json
   // ✅ Good in package.json
   "dependencies": {
     "@amqp-contract/contract": "workspace:*"
   }
   ```

3. **Adding New Dependencies**
   - Add to the catalog in `pnpm-workspace.yaml` first
   - Then reference as `catalog:` in package.json
   - Run `pnpm install` to update lock file

---

## Common Review Issues

### ❌ Anti-Patterns to Avoid

1. **Using `any` type**

   ```typescript
   // ❌ Never do this
   function process(data: any): any {}
   ```

2. **Missing validation**

   ```typescript
   // ❌ Bad - no message definition
   const publisher = {
     exchange: ordersExchange,
     routingKey: "order.created",
   };

   // ✅ Good - with message definition and schema validation
   const orderMessage = defineMessage(
     z.object({
       orderId: z.string(),
       amount: z.number(),
     }),
   );

   const publisher = definePublisher(ordersExchange, orderMessage, {
     routingKey: "order.created",
   });
   ```

3. **Missing `.js` extensions in imports**

   ```typescript
   // ❌ Bad
   import { helper } from "./utils";

   // ✅ Good
   import { helper } from "./utils.js";
   ```

4. **Not using composition pattern**

   ```typescript
   // ❌ Bad - using strings directly
   const contract = defineContract({
     exchanges: {
       orders: defineExchange("orders", "topic", { durable: true }),
     },
     queues: {
       orderProcessing: defineQueue("order-processing", { durable: true }),
     },
     bindings: {
       // Cannot reference exchange/queue objects, must use strings
       orderBinding: defineQueueBinding("order-processing", "orders", {
         routingKey: "order.created",
       }),
     },
   });

   // ✅ Good - define first, then reference (composition pattern)
   const ordersExchange = defineExchange("orders", "topic", { durable: true });
   const orderProcessingQueue = defineQueue("order-processing", { durable: true });

   const contract = defineContract({
     exchanges: {
       orders: ordersExchange,
     },
     queues: {
       orderProcessing: orderProcessingQueue,
     },
     bindings: {
       // References the actual objects for better type safety
       orderBinding: defineQueueBinding(orderProcessingQueue, ordersExchange, {
         routingKey: "order.created",
       }),
     },
   });
   ```

5. **Not using catalog dependencies**

   ```json
   // ❌ Bad in package.json - hardcoded version
   "devDependencies": {
     "vitest": "^4.0.0",
     "typescript": "^5.9.0"
   }

   // ✅ Good in package.json - using catalog
   "devDependencies": {
     "vitest": "catalog:",
     "typescript": "catalog:"
   }
   ```

6. **Ignoring TypeScript errors**
   - Never use `@ts-ignore` or `@ts-expect-error` without explanation
   - Fix the root cause instead of suppressing errors

7. **Missing tests**
   - Every new feature needs tests
   - Every bug fix needs a regression test

8. **Not using Standard Schema v1**
   - Always use Standard Schema v1 compliant libraries
   - Don't create custom validation logic

9. **Incorrect exchange types**
   - Choose the right exchange type for your use case
   - Don't use topic exchanges when direct would suffice
   - Document routing patterns clearly

10. **Using unsafe handlers in new code**

    ```typescript
    // ❌ Bad - using deprecated unsafe handler
    const handler = defineUnsafeHandler(contract, "processOrder", async (message) => {
      await processOrder(message);
    });

    // ✅ Good - using safe handler with explicit error handling
    const handler = defineHandler(contract, "processOrder", (message) =>
      Future.fromPromise(processOrder(message))
        .mapOk(() => undefined)
        .mapError((err) => new RetryableError("Processing failed", err)),
    );
    ```

11. **Not using quorum queues**

    ```typescript
    // ❌ Bad - using classic queue without good reason
    const queue = defineQueue("orders", {
      type: "classic",
      durable: true,
    });

    // ✅ Good - using quorum queue (default)
    const queue = defineQueue("orders", {
      deliveryLimit: 3,
      deadLetter: { exchange: dlx },
    });
    ```

12. **Not running checks before PR**
    ```bash
    # Always run before submitting PR:
    pnpm typecheck
    pnpm lint
    pnpm format --check
    pnpm test
    ```

---

## Development Commands

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run in development mode
pnpm dev
```

### Code Quality

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Formatting
pnpm format           # Format files
pnpm format --check   # Check formatting

# Sort package.json files
pnpm sort-package-json
pnpm sort-package-json --check
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm -r test -- --watch

# Run tests with coverage
pnpm -r test -- --coverage
```

### Versioning

```bash
# Create a changeset
pnpm changeset

# Version packages
pnpm version

# Publish packages
pnpm release
```

---

## Pre-Commit Checklist

Before submitting code, ensure:

- [ ] TypeScript compiles without errors (`pnpm typecheck`)
- [ ] All tests pass (`pnpm test`)
- [ ] Code is properly formatted (`pnpm format`)
- [ ] No linting errors (`pnpm lint`)
- [ ] Package.json files are sorted (`pnpm sort-package-json --check`)
- [ ] Commit message follows conventional commits format
- [ ] Public APIs have JSDoc comments
- [ ] New features have tests
- [ ] Documentation is updated if needed
- [ ] No `any` types used
- [ ] Standard Schema v1 used for validation
- [ ] `.js` extensions in all imports
- [ ] Composition pattern used (define resources first, then reference)
- [ ] Catalog dependencies used for shared packages
- [ ] AMQP patterns documented (routing keys, exchange types, bindings)
- [ ] Message definitions use `defineMessage` with metadata
- [ ] Safe handlers used (`defineHandler`) instead of unsafe handlers
- [ ] Quorum queues used (default) unless classic queue is specifically needed
- [ ] Retry strategy configured appropriately (quorum-native or ttl-backoff)

---

## Questions or Clarifications?

If you're unsure about any guideline:

1. Check existing code for patterns
2. Look at the samples in `samples/` directory
3. Review recent PRs for examples
4. Check the documentation at https://btravers.github.io/amqp-contract
5. Open a discussion on GitHub

---

**Remember:** These guidelines help maintain code quality and consistency. They're not just rules—they're best practices learned from experience with AMQP/RabbitMQ and TypeScript!
