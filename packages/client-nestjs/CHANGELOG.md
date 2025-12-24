# @amqp-contract/client-nestjs

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
