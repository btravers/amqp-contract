# @amqp-contract/client-nestjs

## 0.3.3

### Patch Changes

- @amqp-contract/client@0.3.3
- @amqp-contract/contract@0.3.3

## 0.3.2

### Patch Changes

- Add optional Logger interface for message publishing and consumption

  This release introduces an optional Logger interface that allows users to integrate their preferred logging framework with amqp-contract:

  **New Features:**

  - Added `Logger` interface in `@amqp-contract/core` with debug, info, warn, and error methods
  - Added `LoggerContext` type for structured logging context
  - Client and Worker now accept an optional `logger` option to enable message logging
  - NestJS modules support logger injection

  **Usage:**

  ```typescript
  // Simple console logger implementation
  const logger: Logger = {
    debug: (message, context) => console.debug(message, context),
    info: (message, context) => console.info(message, context),
    warn: (message, context) => console.warn(message, context),
    error: (message, context) => console.error(message, context),
  };

  // Use with client
  const client = await TypedAmqpClient.create({
    contract,
    urls,
    logger,
  });

  // Use with worker
  const worker = await TypedAmqpWorker.create({
    contract,
    urls,
    logger,
  });
  ```

- Updated dependencies
  - @amqp-contract/client@0.3.2
  - @amqp-contract/contract@0.3.2

## 0.3.1

### Patch Changes

- Re-export types from base packages in NestJS integration libraries

  The NestJS integration packages now re-export key types from their base packages:

  - `@amqp-contract/client-nestjs` now re-exports `ClientInferPublisherInput`
  - `@amqp-contract/worker-nestjs` now re-exports `WorkerInferConsumerInput`, `WorkerInferConsumerHandler`, and `WorkerInferConsumerHandlers`

  This improves developer experience by allowing all necessary types to be imported from a single package.

  - @amqp-contract/client@0.3.1
  - @amqp-contract/contract@0.3.1

## 0.3.0

### Minor Changes

- Add waitForConnectionReady feature

  This release introduces connection readiness handling with the following changes:

  **Breaking Changes:**

  - `TypedAmqpClient.create()` now returns `Future<Result<TypedAmqpClient, TechnicalError>>` instead of directly returning the client instance
  - `TypedAmqpWorker.create()` now returns `Future<Result<TypedAmqpWorker, TechnicalError>>` instead of directly returning the worker instance

  **New Features:**

  - Added `waitForConnectionReady()` method to ensure AMQP connection is established before operations
  - Improved error handling with explicit Result types for connection failures

  **Migration Guide:**
  Update your client/worker creation code to handle the new async Result type:

  Before:

  ```typescript
  const client = TypedAmqpClient.create({ contract, urls });
  ```

  After:

  ```typescript
  const result = await TypedAmqpClient.create({ contract, urls });
  if (result.isError()) {
    // Handle connection error
    console.error("Failed to create client:", result.getError());
    return;
  }
  const client = result.get();
  ```

### Patch Changes

- Updated dependencies
  - @amqp-contract/client@0.3.0
  - @amqp-contract/contract@0.3.0

## 0.2.1

### Patch Changes

- Documentation improvements including TypeDoc-generated API documentation and standardized package READMEs with badges and documentation links.
- Updated dependencies
  - @amqp-contract/client@0.2.1
  - @amqp-contract/contract@0.2.1

## 0.2.0

### Minor Changes

- Extract AMQP setup logic into core package

  This release introduces a new `@amqp-contract/core` package that centralizes AMQP infrastructure setup logic. The core package provides a `setupInfra` function that handles the creation of exchanges, queues, and bindings, eliminating code duplication across client and worker packages.

  **New Features:**

  - New `@amqp-contract/core` package with centralized AMQP setup logic
  - `setupInfra` function for creating exchanges, queues, and bindings from contract definitions

  **Changes:**

  - Updated `@amqp-contract/client` to use core setup function
  - Updated `@amqp-contract/worker` to use core setup function
  - All packages are now versioned together as a fixed group

  **Migration:**
  No breaking changes. Existing code will continue to work as before. The core package is used internally by client and worker packages.

### Patch Changes

- Updated dependencies
  - @amqp-contract/client@0.2.0
  - @amqp-contract/contract@0.2.0

## 0.1.4

### Patch Changes

- Refactor: split NestJS module files into ConfigurableModuleBuilder and Module definitions for better code organization
  - @amqp-contract/client@0.1.4
  - @amqp-contract/contract@0.1.4

## 0.1.3

### Patch Changes

- Add exchange-to-exchange binding support
- Updated dependencies
  - @amqp-contract/contract@0.1.3
  - @amqp-contract/client@0.1.3

## 0.1.2

### Patch Changes

- Fix: configurable module type
- Updated dependencies
  - @amqp-contract/contract@0.1.2
  - @amqp-contract/client@0.1.2

## 0.1.1

### Patch Changes

- 498358d: Patch version bump for all packages
- Updated dependencies [498358d]
  - @amqp-contract/client@0.1.1
  - @amqp-contract/contract@0.1.1

## 0.1.0

### Minor Changes

- Replace exceptions with explicit Result error handling for client

  **BREAKING CHANGE**: The client `publish()` method now returns a `Result<void, MessageValidationError>` instead of throwing exceptions. Update your code to handle the Result type:

  ```typescript
  // Before (0.0.6)
  try {
    await client.publish.orderCreated({ orderId: "123", amount: 100 });
  } catch (error) {
    // Handle error
  }

  // After (0.1.0)
  const result = client.publish.orderCreated({ orderId: "123", amount: 100 });
  if (result.isError()) {
    // Handle error: result.error
  }
  ```

  This change provides more explicit and type-safe error handling, making it easier to handle validation failures at compile time.

### Patch Changes

- Updated dependencies
  - @amqp-contract/client@0.1.0
  - @amqp-contract/contract@0.1.0
