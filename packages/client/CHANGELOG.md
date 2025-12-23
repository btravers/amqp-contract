# @amqp-contract/client

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
  - @amqp-contract/core@0.2.0
  - @amqp-contract/contract@0.2.0

## 0.1.4

### Patch Changes

- @amqp-contract/contract@0.1.4

## 0.1.3

### Patch Changes

- Add exchange-to-exchange binding support
- Updated dependencies
  - @amqp-contract/contract@0.1.3

## 0.1.2

### Patch Changes

- Fix: configurable module type
- Updated dependencies
  - @amqp-contract/contract@0.1.2

## 0.1.1

### Patch Changes

- 498358d: Patch version bump for all packages
- Updated dependencies [498358d]
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

- @amqp-contract/contract@0.1.0

## 0.0.6

### Patch Changes

- Release version 0.0.6 for all packages
- Updated dependencies
  - @amqp-contract/contract@0.0.6

## 0.0.5

### Patch Changes

- Refactor to use factory pattern with static create() methods. Remove unnecessary type casts and improve internal implementation.
- Updated dependencies
  - @amqp-contract/contract@0.0.5

## 0.0.4

### Patch Changes

- Release version 0.0.4
- Updated dependencies
  - @amqp-contract/contract@0.0.4

## 0.0.3

### Patch Changes

- Refactor createClient and createWorker to accept options object and auto-connect
  - createClient now accepts { contract, connection } and auto-connects
  - createWorker now accepts { contract, handlers, connection } and auto-connects/consumeAll
  - Updated all tests and samples to use new API

- Documentation updates and API improvements for 0.0.4 release
- Updated dependencies
  - @amqp-contract/contract@0.0.3

## 0.0.2

### Patch Changes

- Release version 0.0.2
- Updated dependencies
  - @amqp-contract/contract@0.0.2
