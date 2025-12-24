# @amqp-contract/contract

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
