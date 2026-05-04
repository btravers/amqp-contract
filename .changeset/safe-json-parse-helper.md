---
"@amqp-contract/core": minor
---

Export `safeJsonParse(buffer, errorFn)` helper for parsing JSON message bodies into a typed `Result`. Both `@amqp-contract/worker` and `@amqp-contract/client` now share this helper instead of duplicating `JSON.parse` error handling.
