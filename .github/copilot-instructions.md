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

3. **Queue and Exchange Options**
   - Set `durable: true` for persistent queues and exchanges
   - Use `autoDelete` sparingly, primarily for temporary resources
   - Configure `prefetch` on consumers to control message flow

4. **Bindings**
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

5. **Routing Keys**
   - Use meaningful, hierarchical routing keys (e.g., `order.created`, `order.updated`)
   - Topic patterns: `#` matches zero or more words, `*` matches exactly one word
   - Document routing key patterns in comments

6. **Message Schemas**
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

1. **Validation Errors**
   - Use Standard Schema v1 for validation
   - Handle validation failures gracefully
   - Provide clear, actionable error messages

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

2. **Custom Error Classes**
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

3. **AMQP Connection Errors**
   - Handle connection failures gracefully
   - Implement reconnection logic where appropriate
   - Log connection issues for debugging

4. **Message Processing Errors**
   - Handle message processing failures
   - Consider using dead letter exchanges for failed messages
   - Log processing errors with context

---

## Testing Requirements

### ✅ Required Practices

1. **Test Framework**
   - Use `vitest` for all tests
   - Place tests alongside source: `feature.spec.ts`
   - Use integration tests in `__tests__` directories

2. **Test Structure**

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

3. **Test Coverage**
   - Write tests for all exported functions
   - Test happy path and error cases
   - Test edge cases and boundary conditions
   - Use `expect.objectContaining()` for partial matching

4. **AMQP Integration Tests**
   - Use `@amqp-contract/testing` utilities when available
   - Test actual AMQP connections with appropriate mocks or test containers
   - Place in separate test files or `__tests__` directories

5. **Test Naming**
   - Use descriptive test names: "should [expected behavior] when [condition]"
   - Group related tests in `describe` blocks
   - Keep tests focused on one thing

6. **Assertion Best Practices**
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
   - README files should stay simple with just an introduction to concepts
   - Keep READMEs concise: key features, quick examples, and links to full documentation
   - Full documentation belongs in the `docs/` directory to maintain a single source of truth
   - README example: brief feature list → quick code snippet → link to docs site
   - This prevents documentation drift and duplication

   ```markdown
   ## Feature Name

   Brief introduction to the feature (1-2 sentences).

   **Quick Example:**

   \`\`\`typescript
   // Minimal working example
   \`\`\`

   📖 **[Learn more →](https://btravers.github.io/amqp-contract/guide/feature)**
   ```

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

10. **Not running checks before PR**
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
