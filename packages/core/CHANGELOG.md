# @amqp-contract/core

## 0.3.5

### Patch Changes

- @amqp-contract/contract@0.3.5

## 0.3.4

### Patch Changes

- Add generic type parameters to NestJS module forRoot/forRootAsync methods

  This change replaces ConfigurableModuleBuilder with manual forRoot/forRootAsync implementations that support generic type parameters. This enables full type safety for worker handlers and client publishers based on the specific contract type.

  **BREAKING CHANGE**: MODULE_OPTIONS_TOKEN is now a Symbol instead of string|symbol union

- Updated dependencies
  - @amqp-contract/contract@0.3.4

## 0.3.3

### Patch Changes

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
  - @amqp-contract/contract@0.3.2

## 0.3.1

### Patch Changes

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
  - @amqp-contract/contract@0.3.0

## 0.2.1

### Patch Changes

- Documentation improvements including TypeDoc-generated API documentation and standardized package READMEs with badges and documentation links.
- Updated dependencies
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
  - @amqp-contract/contract@0.2.0

## 0.1.4

### Minor Changes

- Initial release of @amqp-contract/core package
- Extract AMQP setup logic from client and worker packages
- Add setupInfra function for centralized exchange, queue, and bindings creation
