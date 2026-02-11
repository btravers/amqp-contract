---
"@amqp-contract/core": minor
"@amqp-contract/client": minor
"@amqp-contract/worker": minor
---

**BREAKING:** `MessageValidationError` is now defined in `@amqp-contract/core` and re-exported from `@amqp-contract/client` and `@amqp-contract/worker`.

The `publisherName` (client) and `consumerName` (worker) properties have been replaced with a unified `source` property. Update any code that accesses these properties:

```diff
- error.publisherName
- error.consumerName
+ error.source
```
