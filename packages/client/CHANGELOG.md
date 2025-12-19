# @amqp-contract/client

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
