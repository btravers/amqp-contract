# @amqp-contract/testing

## 0.9.0

### Minor Changes

- Add OpenTelemetry instrumentation for spans and metrics

  This release adds comprehensive OpenTelemetry instrumentation support for AMQP operations:
  - **Automatic tracing**: Distributed tracing spans for publish and consume operations with semantic conventions following OpenTelemetry standards
  - **Metrics collection**: Counters and histograms for message throughput and latency monitoring
  - **Optional dependency**: OpenTelemetry is an optional peer dependency that is gracefully loaded when available
  - **Zero configuration**: Instrumentation automatically integrates with your existing OpenTelemetry setup
  - **Semantic conventions**: Follows OpenTelemetry messaging semantic conventions for AMQP/RabbitMQ

  Key features:
  - Producer and consumer spans with proper span kinds
  - Message metadata tracking (message ID, routing key, delivery tag, payload size)
  - Error tracking with error types and attributes
  - Performance metrics for publish and consume operations
  - Compatible with any OpenTelemetry-compliant APM solution

  See the documentation for configuration details and usage examples.

## 0.8.0

## 0.7.0

### Minor Changes

- Release version 0.7.0 with runtime message compression support for AMQP payloads.

  This release adds the ability to compress messages at runtime using gzip or deflate algorithms. Key features include:
  - Added `CompressionAlgorithm` type supporting 'gzip' and 'deflate'
  - Added optional `compression` parameter to the `publish()` method for runtime compression
  - Automatic decompression in workers based on content-encoding header
  - Backward compatible - no compression by default
  - New sample demonstrating compression usage

  See PR #225 for complete details.

## 0.6.0

### Minor Changes

- Restructure repository to follow vitest pattern with docs as workspace package

  This release includes a major refactoring of the repository structure:
  - Move documentation to workspace package for better integration
  - Simplify docs build workflow
  - Remove orchestration scripts in favor of turbo
  - Improve overall project organization following vitest pattern

## 0.5.0

### Minor Changes

- Add routing key parameters with type validation for all exchange types

  This release introduces comprehensive routing key parameter support with compile-time type validation:

  **New Features:**
  - Added routing key parameter support for topic and direct exchanges
  - Implemented type-level validation for routing keys and binding patterns
    - `RoutingKey<T>` type validates routing key format and character set
    - `BindingPattern<T>` type validates AMQP pattern syntax (\*, #)
    - `MatchingRoutingKey<Pattern, Key>` validates key matches pattern
  - Enhanced `definePublisherFirst` and `defineConsumerFirst` functions:
    - `createPublisher()` accepts routing key parameter for topic exchanges
    - `createConsumer()` accepts optional routing key pattern
  - Routing key validation ensures AMQP compliance at compile-time:
    - Validates allowed characters (a-z, A-Z, 0-9, -, \_)
    - Validates proper segment formatting with dot separators
    - Implements AMQP topic exchange pattern matching logic

  **Type Safety Improvements:**
  - When consumer uses pattern with wildcards (e.g., "order.\*"), publishers can use any matching string
  - When consumer uses concrete key, publishers must use exact same key
  - When publisher uses concrete key, consumers can use any pattern
  - Pattern matching logic:
    - `*` matches exactly one word
    - `#` matches zero or more words

  **Usage Example:**

  ```typescript
  // Topic exchange with routing key parameters
  const consumer = defineConsumerFirst(
    topicExchange,
    "order.*", // Pattern with wildcard
    orderSchema,
  );

  // Publishers can specify concrete keys matching the pattern
  const publisher = consumer.createPublisher("order.created");

  // Or define publisher first with concrete key
  const publisher2 = definePublisherFirst(
    topicExchange,
    "order.updated", // Concrete routing key
    orderSchema,
  );

  // Consumers can subscribe with any pattern
  const consumer2 = publisher2.createConsumer("order.*");
  ```

  This feature provides end-to-end type safety for routing keys and binding patterns, catching configuration errors at compile time rather than runtime.

## 0.4.0

### Minor Changes

- Release version 0.4.0

  This release includes stability improvements and prepares the packages for wider adoption.

## 0.3.5

## 0.3.4

### Patch Changes

- Add generic type parameters to NestJS module forRoot/forRootAsync methods

  This change replaces ConfigurableModuleBuilder with manual forRoot/forRootAsync implementations that support generic type parameters. This enables full type safety for worker handlers and client publishers based on the specific contract type.

  **BREAKING CHANGE**: MODULE_OPTIONS_TOKEN is now a Symbol instead of string|symbol union

## 0.3.3

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

## 0.3.1

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

## 0.2.1

### Patch Changes

- Documentation improvements including TypeDoc-generated API documentation and standardized package READMEs with badges and documentation links.

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

## 0.1.4

## 0.1.3

### Patch Changes

- Add exchange-to-exchange binding support

## 0.1.2

### Patch Changes

- Fix: configurable module type

## 0.1.1

### Patch Changes

- 498358d: Patch version bump for all packages

## 0.1.0

## 0.0.6

### Patch Changes

- Release version 0.0.6 for all packages

## 0.0.5

### Patch Changes

- Refactor to use factory pattern with static create() methods. Remove unnecessary type casts and improve internal implementation.

## 0.0.4

### Patch Changes

- Release version 0.0.4

## 0.0.3

### Patch Changes

- Documentation updates and API improvements for 0.0.4 release

## 0.0.2

### Patch Changes

- Release version 0.0.2
