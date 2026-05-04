---
"@amqp-contract/asyncapi": minor
"@amqp-contract/client": minor
"@amqp-contract/contract": minor
"@amqp-contract/core": minor
"@amqp-contract/testing": minor
"@amqp-contract/worker": minor
---

Close public-API gaps surfaced by the audit:

- `defineHandler` / `defineHandlers` now accept RPC names in addition to consumer names. The handler type for `defineHandler` is inferred from the contract — consumer names yield `WorkerInferConsumerHandler`, RPC names yield `WorkerInferRpcHandler`. `defineHandlers` is typed against `WorkerInferHandlers<TContract>`, which already spans `consumers ∪ rpcs`. Runtime validation walks both sets and the error message lists both.
- The RPC-side `Infer*` helpers and the unified handlers type are now re-exported from `@amqp-contract/worker`: `WorkerInferHandlers`, `WorkerInferRpcHandler`, `WorkerInferRpcHandlerEntry`, `WorkerInferRpcConsumedMessage`, `WorkerInferRpcRequest`, `WorkerInferRpcResponse`, `WorkerInferRpcHeaders`. This makes the worker package symmetrical with the client package's RPC-side exports.
- `HandlerError` is now an abstract base class (`error instanceof HandlerError` works). `RetryableError` and `NonRetryableError` extend it, and the `name` property still discriminates so exhaustive narrowing in user code keeps working. Public type signature is unchanged (a class can be used as a type).
- **Removed** `WorkerInferConsumerHandlers` (was `@deprecated` for one cycle). Use `WorkerInferHandlers` instead — same shape, accurate name.
